<script setup>
import { computed, ref } from 'vue';

const dayIndex = ref(0);
const scale = ref(100);
const selectedHour = ref('3a');
const days = ['Dimecres, 16 de setembre', 'Dijous, 17 de setembre', 'Divendres, 18 de setembre'];
const displayedDay = computed(() => days[dayIndex.value]);
const guardies = [
  { hour: '3a hora · 9:50', group: '4ESO-B', subject: 'Anglès', room: 'Aula 16', absent: 'Alejandro Rueda', cover: 'Margalida Colom', status: 'Queda amb el grup', type: 'covered' },
  { hour: '4a hora · 11:15', group: '1ESO-C', subject: 'Llengua catalana', room: 'Aula 05', absent: 'Marta Serra', cover: 'Pendent', status: 'Cal cobrir-la', type: 'pending' },
  { hour: '5a hora · 12:10', group: '2ESO-A', subject: 'Matemàtiques', room: 'Aula 12', absent: 'Joan Mas', cover: 'Joana Ribes', status: 'Guàrdia assignada', type: 'covered' },
];
function changeDay(amount) { dayIndex.value = Math.max(0, Math.min(days.length - 1, dayIndex.value + amount)); }
function resetDay() { dayIndex.value = 0; }
function changeScale(amount) { scale.value = Math.max(80, Math.min(130, scale.value + amount)); }
</script>

<template>
  <section class="guardies-kiosk-prototype" :style="{ '--prototype-scale': scale / 100 }" aria-label="Simulació de pantalla de guàrdies">
    <header class="prototype-header"><div class="prototype-brand"><img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" /><div><span>IES Josep Sureda i Blanes</span><h1>Guàrdies d’avui</h1></div></div><div class="prototype-time"><span>{{ displayedDay }}</span><strong>10:05</strong><em>3a hora en curs</em></div></header>
    <nav class="prototype-toolbar" aria-label="Controls simulats del quiosc"><div class="prototype-session-nav"><button v-for="hour in ['1a', '2a', '3a', '4a', '5a', '6a']" :key="hour" type="button" :class="{ active: selectedHour === hour }" @click="selectedHour = hour">{{ hour }}<small>{{ hour === '3a' ? '2 G' : hour === '4a' ? '1 G' : '0 G' }}</small></button></div><div class="prototype-actions"><button type="button" aria-label="Dia anterior" :disabled="dayIndex === 0" @click="changeDay(-1)">←</button><button type="button" class="prototype-today" @click="resetDay">Avui</button><button type="button" aria-label="Dia següent" :disabled="dayIndex === days.length - 1" @click="changeDay(1)">→</button><i></i><button type="button" aria-label="Redueix el text" @click="changeScale(-10)">−</button><button type="button" class="prototype-percent" @click="scale = 100">{{ scale }}%</button><button type="button" aria-label="Augmenta el text" @click="changeScale(10)">+</button></div></nav>
    <div class="prototype-content"><div class="prototype-summary"><div><span>Situació actual</span><strong>1 guàrdia pendent</strong></div><p>Absències i cobertures del dia · actualització automàtica</p></div><main class="prototype-layout"><section class="prototype-guards"><header><h2>Guàrdies</h2><span>3 incidències</span></header><article v-for="item in guardies" :key="item.hour + item.group" class="prototype-guard" :class="[item.type, { highlighted: item.hour.startsWith(selectedHour) }]" @click="selectedHour = item.hour.slice(0, 2)"><div class="prototype-hour">{{ item.hour }}</div><div class="prototype-class"><strong>{{ item.group }}</strong><span>{{ item.subject }} · {{ item.room }}</span></div><div class="prototype-absence"><span>Absència</span><strong>{{ item.absent }}</strong></div><div class="prototype-cover"><span>{{ item.status }}</span><strong>{{ item.cover }}</strong></div></article></section><aside class="prototype-side"><section><header><h2>Pati</h2><span>10:45–11:15</span></header><div class="prototype-patio"><strong>Pista</strong><span>Antònia Pons</span></div><div class="prototype-patio"><strong>Porxo</strong><span>Gabriel Fuentes</span></div></section><section><header><h2>Grups fora</h2><span>2</span></header><div class="prototype-out"><strong>3ESO-A</strong><span>Fora del centre</span></div><div class="prototype-out"><strong>1BAT-B</strong><span>Sortida parcial</span></div></section></aside></main></div>
    <footer class="prototype-footer"><span class="prototype-online"></span> Informació actualitzada · pantalla de consulta</footer>
  </section>
</template>
