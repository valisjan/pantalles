<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { currentSlot, formatClock } from '../../../src/domain/calendar.js';
import { useClock } from '../composables/useClock.js';

const props = defineProps({
  title: { type: String, default: 'Pantalla informativa' },
  screenName: { type: String, default: '' },
  dateLabel: { type: String, default: '' },
  // Mantenir premut el rellotge 3 s recarrega la pantalla (només al quiosc).
  reloadable: { type: Boolean, default: false },
});

const HOLD_TO_RELOAD_MS = 3000;
const pressing = ref(false);
const reloading = ref(false);
let holdTimer = null;

function startHold() {
  if (!props.reloadable || reloading.value) return;
  pressing.value = true;
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => {
    reloading.value = true;
    window.location.reload();
  }, HOLD_TO_RELOAD_MS);
}

function cancelHold() {
  if (reloading.value) return;
  pressing.value = false;
  window.clearTimeout(holdTimer);
}

onBeforeUnmount(() => window.clearTimeout(holdTimer));

// Només aquest component depèn del segon: la resta de la pantalla no es repinta.
const { now, minute } = useClock();
const time = computed(() => formatClock(now.value));
const session = computed(() => currentSlot(minute.value)?.label || 'Fora de l’horari lectiu');
</script>

<template>
  <header class="kiosk-header">
    <div class="kiosk-brand">
      <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
      <div>
        <span class="kiosk-kicker">{{ screenName || 'IES Josep Sureda i Blanes' }}</span>
        <h1>{{ title }}</h1>
      </div>
    </div>
    <div class="kiosk-when">
      <strong class="kiosk-date">{{ dateLabel }}</strong>
      <div
        class="live-clock"
        :class="{ 'is-holding': pressing, 'is-reloading': reloading }"
        :title="reloadable ? 'Mantén premut el rellotge 3 segons per recarregar la pantalla' : undefined"
        @pointerdown="startHold"
        @pointerup="cancelHold"
        @pointerleave="cancelHold"
        @pointercancel="cancelHold"
        @contextmenu.prevent
      >
        <span class="live-clock-session" :role="pressing ? 'status' : undefined">{{ pressing ? (reloading ? 'Recarregant…' : 'Mantén premut…') : session }}</span>
        <strong class="live-clock-time">{{ time }}</strong>
        <span v-if="reloadable" class="hold-progress" aria-hidden="true"><span></span></span>
      </div>
    </div>
  </header>
</template>
