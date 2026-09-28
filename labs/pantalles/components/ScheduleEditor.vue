<script setup>
import { computed } from 'vue';
import {
  SCHEDULE_STATUS_LABELS,
  WEEKDAYS,
  describeSchedule,
  normalizeSchedule,
  scheduleForTomorrow,
  scheduleFromNow,
  scheduleStatus,
} from '../../../src/domain/schedule.js';
import { useClock } from '../composables/useClock.js';

// Edita la programació d'una vista al lloc i demana desar-la neta.
const props = defineProps({
  view: { type: Object, required: true },
});
const emit = defineEmits(['save']);
const { minute } = useClock();

const schedule = computed(() => props.view.schedule);
const scheduled = computed(() => schedule.value.mode === 'scheduled');
const status = computed(() => scheduleStatus(schedule.value, minute.value));
const QUICK = [
  { label: 'Ara · 15 min', minutes: 15 },
  { label: 'Ara · 1 hora', minutes: 60 },
  { label: 'Tot el dia d’avui', minutes: 0 },
];

function commit(changes = {}) {
  props.view.schedule = normalizeSchedule({ ...schedule.value, ...changes });
  emit('save');
}

function setMode(mode) {
  if (mode === schedule.value.mode) return;
  // Sense dates, es proposa demà: mai no ocupa la pantalla abans de triar el moment.
  commit(mode === 'scheduled' && !schedule.value.from && !schedule.value.days.length
    ? scheduleForTomorrow(minute.value)
    : { mode });
}

function toggleDay(value) {
  const days = schedule.value.days.includes(value)
    ? schedule.value.days.filter((day) => day !== value)
    : [...schedule.value.days, value];
  commit({ days });
}
</script>

<template>
  <fieldset class="schedule-editor">
    <legend>Quan es mostra</legend>
    <div class="segmented" role="radiogroup" aria-label="Quan es mostra">
      <button type="button" role="radio" :aria-checked="!scheduled" :class="{ active: !scheduled }" @click="setMode('always')">Sempre</button>
      <button type="button" role="radio" :aria-checked="scheduled" :class="{ active: scheduled }" @click="setMode('scheduled')">En un moment concret</button>
    </div>

    <template v-if="scheduled">
      <div class="schedule-quick" aria-label="Programació ràpida">
        <button v-for="option in QUICK" :key="option.label" type="button" class="chip-button" @click="commit(scheduleFromNow(minute, option.minutes))">{{ option.label }}</button>
      </div>

      <div class="field-grid">
        <label>Dia
          <input type="date" :value="schedule.from" @change="commit({ from: $event.target.value })" />
        </label>
        <label>Fins al dia
          <input type="date" :value="schedule.to" :min="schedule.from" @change="commit({ to: $event.target.value })" />
        </label>
        <label>Des de les
          <input type="time" :value="schedule.start" @change="commit({ start: $event.target.value })" />
        </label>
        <label>Fins a les
          <input type="time" :value="schedule.end" @change="commit({ end: $event.target.value })" />
        </label>
      </div>

      <p class="field-help">Sense «Fins al dia», només es mostra el dia triat. Sense hores, tot el dia. Sense dia, cada setmana els dies marcats.</p>

      <div class="weekday-picker">
        <span>Només aquests dies <small>(opcional)</small></span>
        <div role="group" aria-label="Dies de la setmana">
          <button
            v-for="day in WEEKDAYS"
            :key="day.value"
            type="button"
            :aria-pressed="schedule.days.includes(day.value)"
            :aria-label="day.name"
            :class="{ active: schedule.days.includes(day.value) }"
            @click="toggleDay(day.value)"
          >{{ day.short }}</button>
        </div>
      </div>

      <label class="switch-toggle">
        <input type="checkbox" :checked="schedule.exclusive" @change="commit({ exclusive: $event.target.checked })" />
        <span>Ocupa tota la pantalla mentre dura</span>
      </label>
      <p class="field-help">{{ schedule.exclusive ? 'Durant aquest temps no es mostra cap altra vista.' : 'Durant aquest temps s’alterna amb les altres vistes.' }}</p>

      <p class="schedule-summary" :class="`is-${status}`">
        <strong>{{ SCHEDULE_STATUS_LABELS[status] }}</strong>
        <span>{{ describeSchedule(schedule) }}</span>
      </p>
    </template>
  </fieldset>
</template>
