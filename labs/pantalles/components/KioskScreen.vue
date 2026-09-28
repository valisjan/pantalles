<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  currentSlot,
  formatLongDate,
  isPastHour,
  isSlotHour,
  isWeekend,
  localDateString,
  shiftIsoDate,
} from '../../../src/domain/calendar.js';
import { daySummary, hourSummary, isPatioHour, shortHourLabel } from '../../../src/domain/publicDay.js';
import { DEFAULT_SCREEN_CONFIG } from '../../../src/services/pantallesStorage.js';
import { useClock } from '../composables/useClock.js';
import { usePageState } from '../composables/usePageState.js';
import { usePublicDay } from '../composables/usePublicDay.js';
import HourCard from './HourCard.vue';
import KioskHeader from './KioskHeader.vue';
import KioskToolbar from './KioskToolbar.vue';
import MediaView from './MediaView.vue';

const props = defineProps({
  config: { type: Object, required: true },
  configRevision: { type: Number, default: 0 },
  configLoading: { type: Boolean, default: false },
  // A la gestió, la pantalla és una vista prèvia de la vista que s'edita.
  previewViewId: { type: String, default: '' },
  queryCourse: { type: String, default: '' },
  queryDate: { type: String, default: '' },
});

const IDLE_RESET_MS = 90_000;
const preview = computed(() => Boolean(props.previewViewId));
const { minute } = useClock();
const { online } = usePageState();

// Data i mida del text: qualsevol canvi tàctil és temporal i torna a la
// configuració de la pantalla al cap d'una estona sense tocar-la.
const localDate = ref('');
const localScale = ref(null);
let idleTimer = null;
const today = computed(() => localDateString(minute.value));
const selectedDate = computed(() => localDate.value || props.queryDate || today.value);
const selectedCourse = computed(() => props.queryCourse || props.config.courseId || DEFAULT_SCREEN_CONFIG.courseId);
const scale = computed(() => localScale.value ?? props.config.scale ?? 100);
const viewingToday = computed(() => selectedDate.value === today.value);

function resetLocalViewSoon() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    localDate.value = '';
    localScale.value = null;
  }, IDLE_RESET_MS);
}

function shiftDay(amount) {
  localDate.value = shiftIsoDate(selectedDate.value, amount);
  resetLocalViewSoon();
}

function returnToday() {
  localDate.value = today.value;
  resetLocalViewSoon();
}

function changeScale(amount) {
  localScale.value = Math.min(140, Math.max(80, scale.value + amount));
  resetLocalViewSoon();
}

function resetScale() {
  localScale.value = null;
  resetLocalViewSoon();
}

// Vistes: rotació automàtica o vista fixa.
const views = computed(() => (Array.isArray(props.config.views) ? props.config.views : []));
const rotationIndex = ref(0);
let rotationTimer = null;
const activeView = computed(() => {
  if (preview.value) return views.value.find((view) => view.id === props.previewViewId) || views.value[0] || null;
  const forced = views.value.find((view) => view.id === props.config.forcedViewId);
  return forced || views.value[rotationIndex.value % Math.max(views.value.length, 1)] || null;
});
const viewType = computed(() => activeView.value?.type || 'guardies');

function scheduleRotation() {
  window.clearTimeout(rotationTimer);
  if (preview.value || props.config.forcedViewId || views.value.length < 2) return;
  const seconds = Math.min(300, Math.max(5, Number(activeView.value?.duration) || 20));
  rotationTimer = window.setTimeout(() => {
    rotationIndex.value = (rotationIndex.value + 1) % views.value.length;
  }, seconds * 1000);
}
watch([views, () => props.config.forcedViewId, rotationIndex], scheduleRotation, { deep: true, immediate: true });

// Una configuració nova (des de la gestió) torna a començar la pantalla.
watch(() => props.configRevision, () => {
  rotationIndex.value = 0;
  localDate.value = '';
  localScale.value = null;
});

// Jornada publicada.
const { day, loading: dayLoading, error: dayError } = usePublicDay(selectedCourse, selectedDate);
const hours = computed(() => (Array.isArray(day.value?.hours) ? day.value.hours : []));
const outings = computed(() => (Array.isArray(day.value?.groupsOut) ? day.value.groupsOut : []));
const summary = computed(() => daySummary(day.value));
const slot = computed(() => (viewingToday.value ? currentSlot(minute.value) : null));
const isCurrent = (hour) => isSlotHour(slot.value, hour.key);
const isPast = (hour) => viewingToday.value && isPastHour(minute.value, hour.key);
const sessions = computed(() => hours.value
  .filter((hour) => !isPatioHour(hour))
  .map((hour, index) => ({
    key: hour.key,
    label: shortHourLabel(hour, index),
    ...hourSummary(hour),
    current: isCurrent(hour),
    past: isPast(hour),
  })));
const ready = computed(() => !props.configLoading && !dayLoading.value);

const scroller = ref(null);
function centerHour(key, behavior = 'smooth') {
  nextTick(() => {
    const card = Array.from(scroller.value?.querySelectorAll('.hour-card') || [])
      .find((element) => element.dataset.hourKey === String(key));
    card?.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
  });
}
watch([() => slot.value?.key, day, viewType], () => {
  if (preview.value || viewType.value !== 'guardies' || !slot.value) return;
  const hour = hours.value.find(isCurrent);
  if (hour) centerHour(hour.key);
});

onBeforeUnmount(() => {
  window.clearTimeout(idleTimer);
  window.clearTimeout(rotationTimer);
});
</script>

<template>
  <section
    ref="scroller"
    class="kiosk"
    :class="config.theme === 'dark' ? 'dark' : 'light'"
    :style="{ '--display-scale': scale / 100 }"
    aria-live="polite"
  >
    <div class="kiosk-inner">
      <div v-if="!online" class="kiosk-banner is-offline">Sense connexió · es mostra la darrera informació disponible</div>

      <div v-if="!config.active && !preview" class="kiosk-state inactive-screen">
        <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
        <strong>Pantalla temporalment desactivada</strong>
      </div>

      <template v-else>
        <KioskHeader :title="activeView?.name || 'Pantalla informativa'" :screen-name="config.name" :date-label="formatLongDate(selectedDate)" />

        <template v-if="viewType === 'guardies'">
          <div v-if="ready && day" class="kiosk-summary" aria-label="Resum de la jornada">
            <div class="kiosk-kpi" :class="summary.open ? 'is-open' : 'is-covered'">
              <strong>{{ summary.open }}</strong>
              <span>{{ summary.open === 1 ? 'guàrdia sense cobrir' : 'guàrdies sense cobrir' }}</span>
            </div>
            <div class="kiosk-kpi">
              <strong>{{ summary.guards }}</strong>
              <span>{{ summary.guards === 1 ? 'guàrdia' : 'guàrdies' }}</span>
            </div>
            <div class="kiosk-kpi">
              <strong>{{ summary.absences }}</strong>
              <span>{{ summary.absences === 1 ? 'absència' : 'absències' }}</span>
            </div>
            <div v-if="summary.outings" class="kiosk-kpi">
              <strong>{{ summary.outings }}</strong>
              <span>{{ summary.outings === 1 ? 'grup fora' : 'grups fora' }}</span>
            </div>
          </div>

          <KioskToolbar
            :sessions="ready && day ? sessions : []"
            :scale="scale"
            :is-today="viewingToday"
            @jump="centerHour"
            @shift-day="shiftDay"
            @today="returnToday"
            @scale="changeScale"
            @reset-scale="resetScale"
          />
        </template>

        <p v-if="config.message" class="kiosk-banner screen-message">{{ config.message }}</p>

        <MediaView v-if="viewType !== 'guardies' && activeView" :view="activeView" />

        <section v-else-if="!ready" class="kiosk-state">
          <span class="spinner" aria-hidden="true"></span>
          <strong>Carregant la jornada…</strong>
        </section>

        <section v-else-if="!day" class="kiosk-state no-day">
          <span class="no-day-date">{{ formatLongDate(selectedDate) }}</span>
          <strong>{{ dayError || (isWeekend(selectedDate) ? 'Dia no lectiu' : "No s'ha publicat el full de guàrdies d'aquest dia") }}</strong>
        </section>

        <div v-else class="day-content">
          <HourCard v-for="hour in hours" :key="hour.key" :hour="hour" :current="isCurrent(hour)" :past="isPast(hour)" />

          <section v-if="outings.length" class="hour-card outings-card">
            <header class="hour-card-head">
              <h2>Grups de sortida</h2>
              <div class="session-meta"><span>{{ outings.length }} {{ outings.length === 1 ? 'grup' : 'grups' }}</span></div>
            </header>
            <div class="outings-grid">
              <article v-for="group in outings" :key="group.id">
                <strong>{{ group.label }}</strong>
                <span>{{ group.partial ? 'Sortida parcial' : 'Fora del centre' }}</span>
              </article>
            </div>
          </section>
        </div>

        <footer class="kiosk-footer">
          <span class="connection-dot" :class="{ online }" aria-hidden="true"></span>
          <span>{{ online ? 'Actualització automàtica' : 'Sense connexió' }}</span>
        </footer>
      </template>
    </div>
  </section>
</template>
