<script setup>
import { PANTALLES_RELEASES, PANTALLES_VERSION } from '../version.js';
</script>

<template>
  <details class="release-notes">
    <summary>
      <span>Novetats de Pantalles</span>
      <strong>v{{ PANTALLES_VERSION }}</strong>
    </summary>
    <div class="release-notes-body">
      <article v-for="release in PANTALLES_RELEASES" :key="release.version">
        <header>
          <strong>Versió {{ release.version }}</strong>
          <time>Publicada el {{ release.date }}</time>
        </header>
        <ul>
          <li v-for="change in release.changes" :key="change">{{ change }}</li>
        </ul>
      </article>
    </div>
  </details>
</template>
