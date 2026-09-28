import { ref } from 'vue';

// Estat de la pestanya i de la xarxa, compartit per tota l'aplicació. Amb la
// pestanya amagada es tanquen les subscripcions a Firestore per no fer lectures.
const visible = ref(!document.hidden);
const online = ref(navigator.onLine);

document.addEventListener('visibilitychange', () => { visible.value = !document.hidden; });
window.addEventListener('online', () => { online.value = true; });
window.addEventListener('offline', () => { online.value = false; });

export function usePageState() {
  return { visible, online };
}
