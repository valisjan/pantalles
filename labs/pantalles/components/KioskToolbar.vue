<script setup>
import { outingDetail } from '../../../src/domain/publicDay.js';
import ToolbarClock from './ToolbarClock.vue';

defineProps({
  // Controls del full de guàrdies; a les altres vistes només hi ha el selector.
  dayControls: { type: Boolean, default: true },
  sessions: { type: Array, default: () => [] },
  // Sortides complementàries: van a la barra perquè quedin a la vista en baixar per les hores.
  outings: { type: Array, default: () => [] },
  views: { type: Array, default: () => [] },
  activeViewId: { type: String, default: '' },
  // El rellotge de la barra només surt quan el de la capçalera ja no es veu.
  clock: { type: Boolean, default: true },
});
const emit = defineEmits(['jump', 'shift-day', 'select-view']);

function counterLabel(session) {
  return `${session.label}: ${session.guards} ${session.guards === 1 ? 'guàrdia' : 'guàrdies'}${session.open ? `, ${session.open} sense cobrir` : ''}`;
}
</script>

<template>
  <nav class="kiosk-toolbar" aria-label="Controls de la pantalla">
    <div v-if="views.length > 1" class="view-switcher" role="tablist" aria-label="Vistes">
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        role="tab"
        :aria-selected="view.id === activeViewId"
        :class="{ active: view.id === activeViewId }"
        @click="emit('select-view', view.id)"
      >{{ view.name }}</button>
    </div>

    <template v-if="dayControls">
      <div v-if="sessions.length" class="session-counters" aria-label="Guàrdies per hora">
        <!-- Què vol dir el color de cada hora: la llegenda substitueix el títol. -->
        <span class="session-legend" aria-hidden="true">
          <span class="legend-clear">sense guàrdies</span>
          <span class="legend-busy">cobertes</span>
          <span class="legend-pending">en falten</span>
        </span>
        <button
          v-for="session in sessions"
          :key="session.key"
          type="button"
          class="session-counter"
          :class="{
            clear: session.guards === 0,
            busy: session.guards > 0,
            pending: session.open > 0,
            current: session.current,
            past: session.past,
          }"
          :aria-label="counterLabel(session)"
          @click="emit('jump', session.key)"
        >
          <strong class="counter-hour">{{ session.label }}</strong>
          <span class="counter-time">{{ session.key }}</span>
          <span v-if="session.guards" class="counter-count" aria-hidden="true">{{ session.guards }}</span>
        </button>
      </div>
      <div class="kiosk-actions">
        <ToolbarClock v-if="clock" />
        <div class="kiosk-action-group" role="group" aria-label="Dia">
          <button type="button" aria-label="Dia anterior" @click="emit('shift-day', -1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" aria-label="Dia següent" @click="emit('shift-day', 1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <p v-if="outings.length" class="kiosk-outings" role="note">
        <span class="kiosk-outings-title">Sortides complementàries: </span>
        <template v-for="(group, index) in outings" :key="group.id">
          <span v-if="index" class="outing-separator" aria-hidden="true"> · </span>
          <span class="outing-item" :data-outing-group="group.id"><strong>{{ group.label }}</strong>{{ outingDetail(group) }}</span>
        </template>
      </p>
    </template>
  </nav>
</template>
