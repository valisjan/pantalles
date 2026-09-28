<script setup>
import { computed } from 'vue';
import { currentSlot, formatClock } from '../../../src/domain/calendar.js';
import { useClock } from '../composables/useClock.js';

defineProps({
  title: { type: String, default: 'Pantalla informativa' },
  screenName: { type: String, default: '' },
  dateLabel: { type: String, default: '' },
});

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
      <div class="live-clock">
        <span class="live-clock-session">{{ session }}</span>
        <strong class="live-clock-time">{{ time }}</strong>
      </div>
    </div>
  </header>
</template>
