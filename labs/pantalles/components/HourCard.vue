<script setup>
import { computed } from 'vue';
import { ROW_STATUS_LABELS, isPatioHour, rowCoverText, rowStatus } from '../../../src/domain/publicDay.js';

const props = defineProps({
  hour: { type: Object, required: true },
  current: { type: Boolean, default: false },
  past: { type: Boolean, default: false },
});

const patio = computed(() => isPatioHour(props.hour));
const rows = computed(() => (props.hour.rows || []).map((row) => {
  const status = rowStatus(row);
  return {
    ...row,
    status,
    statusLabel: ROW_STATUS_LABELS[status],
    cover: rowCoverText(row),
    detail: [row.subject !== row.group ? row.subject : '', row.room].filter(Boolean).join(' · '),
  };
}));
const zones = computed(() => props.hour.patio?.zones || []);
const meta = computed(() => {
  if (patio.value) return '10:45–11:15';
  const count = rows.value.length;
  return count ? `${count} ${count === 1 ? 'absència' : 'absències'}` : 'Sense absències';
});
</script>

<template>
  <section
    class="hour-card"
    :data-hour-key="hour.key"
    :class="{ 'patio-card': patio, 'current-session': current, past, empty: !patio && !rows.length }"
  >
    <header class="hour-card-head">
      <h2>{{ hour.label }}</h2>
      <div class="session-meta">
        <strong v-if="current" class="now-badge">Ara</strong>
        <span>{{ meta }}</span>
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

    <div v-else-if="rows.length" class="guard-list">
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
          <strong>{{ row.cover }}</strong>
        </div>
        <p v-if="row.comment" class="row-comment">{{ row.comment }}</p>
      </article>
    </div>
  </section>
</template>
