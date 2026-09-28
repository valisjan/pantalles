<script setup>
import { computed } from 'vue';

const props = defineProps({
  view: { type: Object, required: true },
});

const source = computed(() => (props.view.type === 'canva' ? props.view.canvaUrl : props.view.driveUrl));
const missing = computed(() => (props.view.type === 'canva'
  ? 'Enganxa l’enllaç de Canva des de la gestió de la pantalla'
  : 'Enganxa l’enllaç compartit de Drive des de la gestió de la pantalla'));
</script>

<template>
  <section class="media-view" :class="`${view.type}-view`">
    <iframe v-if="source" :src="source" :title="view.name" allowfullscreen></iframe>
    <strong v-else>{{ missing }}</strong>
  </section>
</template>
