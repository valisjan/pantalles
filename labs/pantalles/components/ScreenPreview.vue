<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  screenId: { type: String, required: true },
  config: { type: Object, required: true },
  viewId: { type: String, default: 'guardies' },
  queryCourse: { type: String, default: '' },
  queryDate: { type: String, default: '' },
});

// Resolució del televisor: el quiosc es dibuixa sencer a aquesta mida i es redueix,
// perquè la vista prèvia es vegi igual que la pantalla de la sala.
const SIZES = Object.freeze({
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
});
const BEZEL = 8;
const storageKey = `pantalles-preview-orientation:${props.screenId}`;

function readOrientation() {
  try {
    return localStorage.getItem(storageKey) === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

const orientation = ref(readOrientation());
const size = computed(() => SIZES[orientation.value]);
const stage = ref(null);
const frame = ref(null);
const scale = ref(0.3);

// L'adreça només es fixa una vegada: els canvis arriben per missatge, sense recarregar.
const src = (() => {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('pantalla', props.screenId);
  url.searchParams.set('previsualitza', '1');
  url.searchParams.set('vista', props.viewId);
  if (props.queryCourse) url.searchParams.set('curs', props.queryCourse);
  if (props.queryDate) url.searchParams.set('data', props.queryDate);
  return `${url.pathname}${url.search}`;
})();

function fit() {
  if (!stage.value) return;
  const box = stage.value.getBoundingClientRect();
  const style = getComputedStyle(stage.value);
  const width = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - BEZEL * 2;
  const height = box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - BEZEL * 2;
  scale.value = Math.max(0.1, Math.min(width / size.value.width, height / size.value.height));
}

function post() {
  frame.value?.contentWindow?.postMessage({
    type: 'pantalles-preview',
    config: JSON.parse(JSON.stringify(props.config)),
    viewId: props.viewId,
  }, window.location.origin);
}

function onMessage(event) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return;
  if (event.data?.type === 'pantalles-preview-ready') post();
}

watch(() => props.config, post, { deep: true });
watch(() => props.viewId, post);
watch(orientation, (value) => {
  try { localStorage.setItem(storageKey, value); } catch { /* sense memòria, no passa res */ }
  nextTick(fit);
});

let observer = null;
onMounted(() => {
  window.addEventListener('message', onMessage);
  observer = new ResizeObserver(fit);
  observer.observe(stage.value);
  fit();
});
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  observer?.disconnect();
});
</script>

<template>
  <section class="management-preview" aria-label="Vista prèvia de la pantalla">
    <div class="preview-bar">
      <div class="segmented" role="group" aria-label="Orientació de la pantalla">
        <button type="button" :class="{ active: orientation === 'portrait' }" :aria-pressed="orientation === 'portrait'" @click="orientation = 'portrait'">Vertical</button>
        <button type="button" :class="{ active: orientation === 'landscape' }" :aria-pressed="orientation === 'landscape'" @click="orientation = 'landscape'">Horitzontal</button>
      </div>
      <span class="preview-size">{{ size.width }} × {{ size.height }}</span>
    </div>
    <div ref="stage" class="preview-stage">
      <div class="preview-device" :style="{ width: `${size.width * scale}px`, height: `${size.height * scale}px` }">
        <iframe
          ref="frame"
          :src="src"
          title="Vista prèvia de la pantalla"
          :style="{ width: `${size.width}px`, height: `${size.height}px`, transform: `scale(${scale})` }"
        ></iframe>
      </div>
    </div>
  </section>
</template>
