<script setup>
import { computed } from 'vue';
import { hourProgress, hourRange } from '../../../src/domain/calendar.js';
import {
  ROW_STATUS_LABELS,
  isPatioHour,
  rowCoverText,
  rowSourceMark,
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
    statusLabel: ROW_STATUS_LABELS[status],
    cover: rowCoverText(row),
    mark: rowSourceMark(row),
    detail: [row.subject !== row.group ? row.subject : '', row.room].filter(Boolean).join(' · '),
  };
}));
const zones = computed(() => props.hour.patio?.zones || []);
const count = computed(() => {
  const total = rows.value.length;
  return total ? `${total} ${total === 1 ? 'absència' : 'absències'}` : 'Sense absències';
});
</script>

<template>
  <section
    class="hour-card"
    :data-hour-key="hour.key"
    :style="{ '--i': index }"
    :class="{ 'patio-card': patio, 'current-session': current, past, empty: !patio && !rows.length }"
  >
    <header class="hour-card-head">
      <div class="hour-title">
        <span class="hour-badge" aria-hidden="true">{{ patio ? 'P' : badge }}</span>
        <div>
          <h2>{{ title }}</h2>
          <span class="hour-range">{{ range }}</span>
        </div>
      </div>
      <div class="session-meta">
        <strong v-if="current" class="now-badge">Ara<template v-if="progress"> · queden {{ progress.remaining }} min</template></strong>
        <span v-if="!patio">{{ count }}</span>
      </div>
      <div v-if="progress" class="hour-progress" aria-hidden="true">
        <span :style="{ transform: `scaleX(${progress.ratio})` }"></span>
      </div>
    </header>

    <div v-if="patio" class="patio-grid">
      <article v-for="zone in zones" :key="`${zone.name}-${zone.teacher}`" class="patio-zone" :class="{ absent: zone.absent }">
        <strong>{{ zone.name }}</strong>
        <span>{{ zone.teacher }}</span>
        <em v-if="zone.absent">Absent</em>
      </article>
      <p v-if="hour.patio?.observation" class="patio-observation">{{ hour.patio.observation }}</p>
    </div>

    <TransitionGroup v-else-if="rows.length" name="row" tag="div" class="guard-list">
      <article v-for="row in rows" :key="row.id" class="guard-row" :class="`status-${row.status}`">
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
          <strong>
            {{ row.cover }}
            <abbr v-if="row.mark === 'guard'" class="source-mark is-guard" title="Professorat de guàrdia">G</abbr>
            <span v-else-if="row.mark === 'released'" class="source-mark is-released">Alliberat/ada</span>
          </strong>
        </div>
        <p v-if="row.comment" class="row-comment">{{ row.comment }}</p>
      </article>
    </TransitionGroup>
  </section>
</template>
