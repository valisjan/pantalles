<script setup>
defineProps({
  // Controls del full de guàrdies; a les altres vistes només hi ha el selector.
  dayControls: { type: Boolean, default: true },
  sessions: { type: Array, default: () => [] },
  scale: { type: Number, default: 100 },
  isToday: { type: Boolean, default: true },
  views: { type: Array, default: () => [] },
  activeViewId: { type: String, default: '' },
});
const emit = defineEmits(['jump', 'shift-day', 'today', 'scale', 'reset-scale', 'select-view']);

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
      <div v-if="sessions.length" class="session-counters" aria-label="Guàrdies per sessió">
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
          <span>{{ session.label }}</span>
          <strong>{{ session.guards }} G</strong>
        </button>
      </div>
      <div class="kiosk-actions">
        <div class="kiosk-action-group" role="group" aria-label="Dia">
          <button type="button" aria-label="Dia anterior" @click="emit('shift-day', -1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" class="today-button" :class="{ 'is-today': isToday }" @click="emit('today')">Avui</button>
          <button type="button" aria-label="Dia següent" @click="emit('shift-day', 1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div class="kiosk-action-group" role="group" aria-label="Mida del text">
          <button type="button" aria-label="Redueix el text" @click="emit('scale', -10)">−</button>
          <button type="button" class="scale-button" @click="emit('reset-scale')">{{ scale }}%</button>
          <button type="button" aria-label="Augmenta el text" @click="emit('scale', 10)">+</button>
        </div>
      </div>
    </template>
  </nav>
</template>
