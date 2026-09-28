import { getCurrentScope, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { subscribePublicGuardiesDay } from '../../../src/services/pantallesStorage.js';
import { usePageState } from './usePageState.js';

// Jornada publicada per Guàrdies. Es torna a subscriure quan canvia el curs o
// la data, i es desconnecta mentre la pestanya és amagada.
export function usePublicDay(courseId, date) {
  const day = shallowRef(null);
  const loading = ref(true);
  const error = ref('');
  const { visible } = usePageState();
  let unsubscribe = () => {};

  function stop() {
    unsubscribe();
    unsubscribe = () => {};
  }

  watch([courseId, date, visible], ([course, value, isVisible], previous) => {
    if (!isVisible) {
      stop();
      return;
    }
    const sameDay = previous && previous[0] === course && previous[1] === value;
    stop();
    if (!sameDay) {
      day.value = null;
      loading.value = true;
    }
    unsubscribe = subscribePublicGuardiesDay(course, value, (next) => {
      day.value = next;
      loading.value = false;
      error.value = '';
    }, (reason) => {
      loading.value = false;
      error.value = reason?.code === 'permission-denied'
        ? 'No s’ha pogut carregar la jornada.'
        : 'No s’ha pogut connectar amb Guàrdies.';
    });
  }, { immediate: true });

  if (getCurrentScope()) onScopeDispose(stop);
  return { day, loading, error };
}
