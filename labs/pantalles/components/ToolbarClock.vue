<script setup>
import { computed } from 'vue';
import { formatClock } from '../../../src/domain/calendar.js';
import { useClock } from '../composables/useClock.js';

// El segon només actualitza el rellotge, no tots els controls de la barra.
const { now } = useClock();
const time = computed(() => formatClock(now.value));
</script>

<template>
  <div class="toolbar-clock" aria-live="off">
    <span>Hora actual</span>
    <time :datetime="time">{{ time }}</time>
  </div>
</template>
