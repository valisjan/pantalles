<script setup>
import { computed } from 'vue';
import { hourProgress, hourRange } from '../../../src/domain/calendar.js';
import {
  isPatioHour,
  rowCoverLabel,
  rowCoverText,
  rowRole,
  rowStatus,
  shortHourLabel,
} from '../../../src/domain/publicDay.js';
import { useClock } from '../composables/useClock.js';

const props = defineProps({
  hour: { type: Object, required: true },
  index: { type: Number, default: 0 },
  current: { type: Boolean, default: false },
  past: { type: Boolean, default: false },
});

const { minute } = useClock();
const patio = computed(() => isPatioHour(props.hour));
const badge = computed(() => shortHourLabel(props.hour, props.index));
const title = computed(() => String(props.hour.label || '').split(' · ')[0] || badge.value);
const range = computed(() => hourRange(props.hour.key) || String(props.hour.label || '').split(' · ')[1] || '');
const progress = computed(() => (props.current ? hourProgress(minute.value, props.hour.key) : null));
const rows = computed(() => (props.hour.rows || []).map((row) => {
  const status = rowStatus(row);
  return {
    ...row,
    status,
    role: rowRole(row),
    statusLabel: rowCoverLabel(row),
    cover: rowCoverText(row),
    detail: [row.subject !== row.group ? row.subject : '', row.room].filter(Boolean).join(' · '),
  };
}));
const zones = computed(() => props.hour.patio?.zones || []);
const count = computed(() => {
  const total = rows.value.length;
  return total ? `${total} ${total === 1 ? 'absència' : 'absències'}` : 'Sense absències';
});
const open = computed(() => rows.value.filter((row) => row.status === 'open').length);
</script>

<template>
  <section
    class="hour-card"
    :data-hour-key="hour.key"
    :style="{ '--i': index }"
    :class="{ 'patio-card': patio, 'current-session': current, past, empty: !patio && !rows.length && !hour.observation }"
  >
    <header class="hour-card-head">
      <div class="hour-title">
        <span class="hour-badge" aria-hidden="true">{{ patio ? 'P' : badge }}</span>
        <div>
          <h2 v-if="patio">{{ title }}</h2>
          <!-- La insígnia ja diu l'hora ("1a"): el títol és la franja, i el nom queda per als lectors de pantalla. -->
          <h2 v-else><span v-if="range" class="visually-hidden">{{ title }}, </span>{{ range || title }}</h2>
          <span v-if="patio" class="hour-range">{{ range }}</span>
        </div>
      </div>
      <div class="session-meta">
        <strong v-if="current" class="now-badge">Ara<template v-if="progress"> · queden {{ progress.remaining }} min</template></strong>
        <em v-if="open" class="session-pending">{{ open }} sense cobrir</em>
        <span v-if="!patio">{{ count }}</span>
      </div>
      <div v-if="progress" class="hour-progress" aria-hidden="true">
        <span :style="{ transform: `scaleX(${progress.ratio})` }"></span>
      </div>
    </header>

    <template v-if="patio">
      <!-- L'observació va fora de la graella: si l'ocupés sencera, les zones no s'estirarien. -->
      <div class="patio-grid">
        <article v-for="zone in zones" :key="`${zone.name}-${zone.teacher}`" class="patio-zone" :class="{ absent: zone.absent }">
          <span class="zone-name">{{ zone.name }}</span>
          <strong class="zone-teacher">{{ zone.teacher }}</strong>
          <em v-if="zone.absent">Absent</em>
        </article>
      </div>
      <p v-if="hour.patio?.observation" class="patio-observation">
        <strong class="observation-label">Observacions del pati</strong>
        <span class="observation-text">{{ hour.patio.observation }}</span>
      </p>
    </template>

    <TransitionGroup v-else-if="rows.length" name="row" tag="div" class="guard-list">
      <article v-for="row in rows" :key="row.id" class="guard-row" :class="[`status-${row.status}`, row.role && `role-${row.role}`]">
        <div class="absent-person">
          <span class="cell-label">Absència</span>
          <strong>{{ row.absent }}</strong>
        </div>
        <div class="session-detail">
          <strong>{{ row.group || row.subject }}</strong>
          <span v-if="row.detail">{{ row.detail }}</span>
        </div>
        <div class="assigned-person">
          <span class="cell-label status-label">{{ row.statusLabel }}</span>
          <strong>{{ row.cover }}</strong>
        </div>
        <p v-if="row.comment" class="row-comment">
          <strong class="observation-label">Observacions</strong>
          <span class="observation-text">{{ row.comment }}</span>
        </p>
      </article>
    </TransitionGroup>
    <p v-if="hour.observation" class="hour-observation">
      <strong class="observation-label">Observacions de l’hora</strong>
      <span class="observation-text">{{ hour.observation }}</span>
    </p>
  </section>
</template>
