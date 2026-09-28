<script setup>
defineProps({
  view: { type: Object, required: true },
});
</script>

<template>
  <section class="notice-view">
    <p v-if="view.text">{{ view.text }}</p>
    <strong v-else class="notice-empty">Escriu el text de l’anunci des de la gestió de la pantalla</strong>
  </section>
</template>
