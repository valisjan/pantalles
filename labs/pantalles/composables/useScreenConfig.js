import { reactive, watch } from 'vue';
import {
  DEFAULT_SCREEN_CONFIG,
  saveScreenConfig,
  subscribeScreenConfig,
} from '../../../src/services/pantallesStorage.js';
import { usePageState } from './usePageState.js';

function defaultConfig() {
  return { ...DEFAULT_SCREEN_CONFIG, views: DEFAULT_SCREEN_CONFIG.views.map((view) => ({ ...view })) };
}

// Configuració d'una pantalla: una sola subscripció per a tota l'aplicació.
// La gestió hi escriu directament i `scheduleSave` en desa l'estat sencer.
export function useScreenConfig(screenId, { canSave = () => false } = {}) {
  const config = reactive(defaultConfig());
  const status = reactive({ loading: true, exists: false, save: 'idle', error: '', revision: 0 });
  const { visible } = usePageState();
  let unsubscribe = () => {};
  let saveTimer = null;

  function subscribe() {
    unsubscribe();
    unsubscribe = subscribeScreenConfig(screenId, (next, exists) => {
      // Una edició local pendent de desar no es trepitja amb la versió remota.
      if (status.save === 'saving') return;
      Object.assign(config, next);
      status.exists = exists;
      status.loading = false;
      status.revision += 1;
    }, (error) => {
      status.loading = false;
      status.error = error?.message || String(error);
    });
  }

  watch(visible, (isVisible) => {
    if (isVisible) subscribe();
    else {
      unsubscribe();
      unsubscribe = () => {};
    }
  }, { immediate: true });

  function scheduleSave() {
    if (!canSave()) return;
    window.clearTimeout(saveTimer);
    status.save = 'saving';
    saveTimer = window.setTimeout(async () => {
      try {
        await saveScreenConfig(screenId, { ...config });
        status.save = 'saved';
        status.error = '';
      } catch (error) {
        status.save = 'error';
        status.error = error?.message || String(error);
      }
    }, 350);
  }

  function stop() {
    window.clearTimeout(saveTimer);
    unsubscribe();
  }

  return { config, status, scheduleSave, stop };
}
