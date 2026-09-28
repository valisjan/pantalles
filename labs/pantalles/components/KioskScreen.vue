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
import { playlistFor } from '../../../src/domain/schedule.js';
import { DEFAULT_SCREEN_CONFIG } from '../../../src/services/pantallesStorage.js';
import { useClock } from '../composables/useClock.js';
import { useKioskUpdates } from '../composables/useKioskUpdates.js';
import { usePageState } from '../composables/usePageState.js';
import { usePublicDay } from '../composables/usePublicDay.js';
import HourCard from './HourCard.vue';
import KioskHeader from './KioskHeader.vue';
import KioskToolbar from './KioskToolbar.vue';
import MediaView from './MediaView.vue';
import NoticeView from './NoticeView.vue';

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

// Algú fa servir la pantalla: mentre toca, res no canvia sol (ni la vista ni
// el desplaçament). Al cap de 90 s sense tocar-la, tot torna a l'estat normal.
const interacting = ref(false);
const manualViewId = ref('');
const localDate = ref('');
const localScale = ref(null);
let idleTimer = null;

function registerInteraction() {
  interacting.value = true;
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    interacting.value = false;
    localDate.value = '';
    localScale.value = null;
    manualViewId.value = '';
  }, IDLE_RESET_MS);
}

// El quiosc real es posa al dia sol; la vista prèvia de la gestió, no.
if (!props.previewViewId) useKioskUpdates(computed(() => !interacting.value));

const today = computed(() => localDateString(minute.value));
const selectedDate = computed(() => localDate.value || props.queryDate || today.value);
const selectedCourse = computed(() => props.queryCourse || props.config.courseId || DEFAULT_SCREEN_CONFIG.courseId);
const scale = computed(() => localScale.value ?? props.config.scale ?? 100);
const viewingToday = computed(() => selectedDate.value === today.value);
// Només s'avisa quan algú ha canviat de dia a la pantalla, no amb una data fixada a l'adreça.
const browsingOtherDay = computed(() => Boolean(localDate.value) && !viewingToday.value);

function shiftDay(amount) {
  localDate.value = shiftIsoDate(selectedDate.value, amount);
  registerInteraction();
}

function returnToday() {
  localDate.value = today.value;
  registerInteraction();
}

function changeScale(amount) {
  localScale.value = Math.min(140, Math.max(80, scale.value + amount));
  registerInteraction();
}

function resetScale() {
  localScale.value = null;
  registerInteraction();
}

// Vistes: les que toquen ara segons la programació, alternades o fixes.
const views = computed(() => (Array.isArray(props.config.views) ? props.config.views : []));
const playlist = computed(() => playlistFor(views.value, props.config.forcedViewId, minute.value));
const playlistKey = computed(() => playlist.value.map((view) => view.id).join('|'));
const rotationIndex = ref(0);
let rotationTimer = null;
const activeView = computed(() => {
  if (preview.value) return views.value.find((view) => view.id === props.previewViewId) || views.value[0] || null;
  const manual = playlist.value.find((view) => view.id === manualViewId.value);
  return manual || playlist.value[rotationIndex.value % Math.max(playlist.value.length, 1)] || null;
});
const viewType = computed(() => activeView.value?.type || 'guardies');
const switcherViews = computed(() => (preview.value ? [] : playlist.value.map(({ id, name }) => ({ id, name }))));

function selectView(id) {
  manualViewId.value = id;
  registerInteraction();
}

function scheduleRotation() {
  window.clearTimeout(rotationTimer);
  if (preview.value || interacting.value || playlist.value.length < 2) return;
  const seconds = Math.min(300, Math.max(5, Number(activeView.value?.duration) || 20));
  rotationTimer = window.setTimeout(() => {
    rotationIndex.value = (rotationIndex.value + 1) % playlist.value.length;
  }, seconds * 1000);
}
// Quan comença o acaba una programació, la vista nova surt de seguida.
watch(playlistKey, () => {
  rotationIndex.value = 0;
  manualViewId.value = '';
});
watch([playlistKey, rotationIndex, interacting, () => activeView.value?.duration], scheduleRotation, { immediate: true });

// Una configuració nova (des de la gestió) torna a començar la pantalla.
watch(() => props.configRevision, () => {
  rotationIndex.value = 0;
  manualViewId.value = '';
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
function centerHour(key) {
  nextTick(() => {
    const card = Array.from(scroller.value?.querySelectorAll('.hour-card') || [])
      .find((element) => element.dataset.hourKey === String(key));
    card?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  });
}

function jumpToHour(key) {
  registerInteraction();
  centerHour(key);
}

// La sessió actual es posa al centre, però mai mentre algú llegeix la pantalla.
function centerCurrentHour() {
  if (preview.value || interacting.value || viewType.value !== 'guardies' || !slot.value) return;
  const hour = hours.value.find(isCurrent);
  if (hour) centerHour(hour.key);
}
watch([() => slot.value?.key, day, viewType, interacting], centerCurrentHour);

onBeforeUnmount(() => {
  window.clearTimeout(idleTimer);
  window.clearTimeout(rotationTimer);
});
</script>

<template>
  <section
    ref="scroller"
    class="kiosk"
    :class="[config.theme === 'dark' ? 'dark' : 'light', { 'is-preview': preview, 'is-interacting': interacting }]"
    :style="{ '--display-scale': scale / 100 }"
    aria-live="polite"
    @pointerdown.passive="registerInteraction"
    @wheel.passive="registerInteraction"
    @keydown="registerInteraction"
  >
    <div class="kiosk-inner">
      <div v-if="!online" class="kiosk-banner is-offline">Sense connexió · es mostra la darrera informació disponible</div>

      <div v-if="!config.active && !preview" class="kiosk-state inactive-screen">
        <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
        <strong>Pantalla temporalment desactivada</strong>
      </div>

      <template v-else>
        <KioskHeader :title="activeView?.name || 'Pantalla informativa'" :screen-name="config.name" :date-label="formatLongDate(selectedDate)" :reloadable="!preview" />

        <div v-if="viewType === 'guardies' && browsingOtherDay" class="kiosk-banner other-day" role="status">
          <span>Estàs veient el full del <strong>{{ formatLongDate(selectedDate).toLowerCase() }}</strong></span>
          <button type="button" @click="returnToday">Torna a avui</button>
        </div>

        <div v-if="viewType === 'guardies' && ready && day" class="kiosk-summary" aria-label="Resum de la jornada">
          <div class="kiosk-kpi" :class="summary.open ? 'is-open' : 'is-covered'">
            <strong :key="summary.open" class="kpi-value">{{ summary.open }}</strong>
            <span>{{ summary.open === 1 ? 'guàrdia sense cobrir' : 'guàrdies sense cobrir' }}</span>
          </div>
          <div class="kiosk-kpi">
            <strong :key="summary.guards" class="kpi-value">{{ summary.guards }}</strong>
            <span>{{ summary.guards === 1 ? 'guàrdia' : 'guàrdies' }}</span>
          </div>
          <div class="kiosk-kpi">
            <strong :key="summary.absences" class="kpi-value">{{ summary.absences }}</strong>
            <span>{{ summary.absences === 1 ? 'absència' : 'absències' }}</span>
          </div>
          <div v-if="summary.outings" class="kiosk-kpi">
            <strong :key="summary.outings" class="kpi-value">{{ summary.outings }}</strong>
            <span>{{ summary.outings === 1 ? 'grup fora' : 'grups fora' }}</span>
          </div>
        </div>

        <KioskToolbar
          v-if="viewType === 'guardies' || switcherViews.length > 1"
          :day-controls="viewType === 'guardies'"
          :sessions="ready && day ? sessions : []"
          :scale="scale"
          :is-today="viewingToday"
          :views="switcherViews"
          :active-view-id="activeView?.id || ''"
          @jump="jumpToHour"
          @shift-day="shiftDay"
          @today="returnToday"
          @scale="changeScale"
          @reset-scale="resetScale"
          @select-view="selectView"
        />

        <p v-if="config.message" class="kiosk-banner screen-message">{{ config.message }}</p>

        <Transition name="view" mode="out-in" @after-enter="centerCurrentHour">
        <NoticeView v-if="viewType === 'text' && activeView" :key="`notice-${activeView.id}`" :view="activeView" />

        <MediaView v-else-if="viewType !== 'guardies' && activeView" :key="`media-${activeView.id}`" :view="activeView" />

        <section v-else-if="!ready" key="loading" class="kiosk-state">
          <span class="spinner" aria-hidden="true"></span>
          <strong>Carregant la jornada…</strong>
        </section>

        <section v-else-if="!day" :key="`no-day-${selectedDate}`" class="kiosk-state no-day">
          <span class="no-day-date">{{ formatLongDate(selectedDate) }}</span>
          <strong>{{ dayError || (isWeekend(selectedDate) ? 'Dia no lectiu' : "No s'ha publicat el full de guàrdies d'aquest dia") }}</strong>
        </section>

        <div v-else :key="`day-${selectedDate}`" class="day-content">
          <HourCard v-for="(hour, index) in hours" :key="hour.key" :hour="hour" :index="index" :current="isCurrent(hour)" :past="isPast(hour)" />

          <section v-if="outings.length" class="hour-card outings-card" :style="{ '--i': hours.length }">
            <header class="hour-card-head">
              <div class="hour-title"><h2>Grups de sortida</h2></div>
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
        </Transition>

        <footer class="kiosk-footer">
          <span class="connection-dot" :class="{ online }" aria-hidden="true"></span>
          <span>{{ online ? 'Actualització automàtica' : 'Sense connexió' }}</span>
        </footer>
      </template>
    </div>
  </section>
</template>
