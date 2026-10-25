<script setup>
import { computed } from 'vue';
import { scheduleUntilLabel } from '../../../src/domain/schedule.js';
import { useClock } from '../composables/useClock.js';

const props = defineProps({
  view: { type: Object, required: true },
});

const TONE_LABELS = { important: 'Important', urgent: 'Urgent' };
const { minute } = useClock();
const tone = computed(() => (TONE_LABELS[props.view.tone] ? props.view.tone : 'info'));
// La lletra s'adapta a la llargada: un avís curt omple la pantalla i un de llarg hi cap.
const size = computed(() => {
  const length = String(props.view.text || '').trim().length;
  if (length <= 60) return 'is-short';
  return length <= 180 ? 'is-medium' : 'is-long';
});
const until = computed(() => scheduleUntilLabel(props.view.schedule, minute.value));
</script>

<template>
  <section class="notice-view" :class="[`tone-${tone}`, size]">
    <span v-if="TONE_LABELS[tone]" class="notice-tone">{{ TONE_LABELS[tone] }}</span>
    <p v-if="view.text">{{ view.text }}</p>
    <strong v-else class="notice-empty">Escriu el text de l’anunci des de la gestió de la pantalla</strong>
    <span v-if="until" class="notice-until">{{ until }}</span>
  </section>
</template>
