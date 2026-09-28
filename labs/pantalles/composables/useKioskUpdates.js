import { getCurrentScope, onScopeDispose, ref, watch } from 'vue';
import { bundleFromHtml, nextDailyReload } from '../../../src/domain/updates.js';
import { useClock } from './useClock.js';
import { usePageState } from './usePageState.js';

const CHECK_EVERY_MS = 5 * 60_000;
// Evita recarregar en bucle si el servidor encara serveix la versió anterior.
const RELOADED_FOR_KEY = 'pantalles:reloaded-for';

function loadedBundle() {
  return document.querySelector('script[type="module"][src]')?.getAttribute('src') || '';
}

function readReloadedFor() {
  try { return sessionStorage.getItem(RELOADED_FOR_KEY) || ''; } catch { return ''; }
}

function rememberReloadFor(bundle) {
  try { sessionStorage.setItem(RELOADED_FOR_KEY, bundle); } catch { /* sense emmagatzematge */ }
}

// El quiosc es posa al dia sol: quan es publica una versió nova i cada dia a
// les 6.30. Només recarrega quan ningú no l'està fent servir (`idle`).
export function useKioskUpdates(idle) {
  const { minute } = useClock();
  const { visible, online } = usePageState();
  const current = loadedBundle();
  const dailyReload = nextDailyReload(new Date());
  const pending = ref('');
  let timer = null;

  async function checkForUpdate() {
    if (!current || !visible.value || !online.value || pending.value) return;
    try {
      const response = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
      if (!response.ok) return;
      const latest = bundleFromHtml(await response.text());
      if (latest && latest !== current && latest !== readReloadedFor()) pending.value = latest;
    } catch {
      // Sense xarxa: ja es tornarà a provar.
    }
  }

  timer = window.setInterval(checkForUpdate, CHECK_EVERY_MS);
  watch(visible, (isVisible) => { if (isVisible) checkForUpdate(); });
  watch(minute, (now) => {
    if (!pending.value && now >= dailyReload) pending.value = 'daily';
  });
  watch([pending, idle], ([reason, isIdle]) => {
    if (!reason || !isIdle) return;
    if (reason !== 'daily') rememberReloadFor(reason);
    window.location.reload();
  });

  if (getCurrentScope()) onScopeDispose(() => window.clearInterval(timer));
  return { pending };
}
