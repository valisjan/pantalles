import { reactive, ref } from 'vue';
import { DEFAULT_SCREEN_CONFIG, normalizeScreenConfig } from '../../../src/services/pantallesStorage.js';

// Quiosc dins la vista prèvia de la gestió: la configuració (encara sense desar) i la
// vista que s'edita arriben de la pàgina que el conté. Avisa quan ja les pot rebre.
export function usePreviewGuest(initialViewId = '') {
  const config = reactive(structuredClone(DEFAULT_SCREEN_CONFIG));
  const status = reactive({ loading: true, exists: true, save: 'idle', error: '', revision: 0 });
  const viewId = ref(initialViewId || 'guardies');

  function onMessage(event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type !== 'pantalles-preview') return;
    Object.assign(config, normalizeScreenConfig(event.data.config || {}));
    viewId.value = String(event.data.viewId || viewId.value);
    status.loading = false;
    status.revision += 1;
  }

  window.addEventListener('message', onMessage);
  window.parent.postMessage({ type: 'pantalles-preview-ready' }, window.location.origin);

  function stop() {
    window.removeEventListener('message', onMessage);
  }

  return { config, status, viewId, scheduleSave: () => {}, stop };
}
