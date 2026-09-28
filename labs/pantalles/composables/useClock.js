import { getCurrentScope, onScopeDispose, ref } from 'vue';

// Dos rellotges compartits: `now` canvia cada segon i només el fa servir el
// rellotge visible; `minute` canvia cada minut i governa la franja actual i la
// data d'avui. Així la resta de la pantalla no es torna a pintar cada segon.
const now = ref(new Date());
const minute = ref(new Date());
let timer = null;
let users = 0;

function tick() {
  const current = new Date();
  now.value = current;
  if (Math.floor(current.getTime() / 60_000) !== Math.floor(minute.value.getTime() / 60_000)) {
    minute.value = current;
  }
}

export function useClock() {
  if (!timer) {
    tick();
    timer = window.setInterval(tick, 1000);
  }
  users += 1;
  if (getCurrentScope()) {
    onScopeDispose(() => {
      users -= 1;
      if (!users) {
        window.clearInterval(timer);
        timer = null;
      }
    });
  }
  return { now, minute };
}
