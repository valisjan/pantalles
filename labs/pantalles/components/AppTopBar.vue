<script setup>
import { ref } from 'vue';
import AppsMenu from '../../../src/shared/AppsMenu.vue';

// Mateixa barra que Guàrdies: logo, menú d'aplicacions comú i tema.

defineProps({
  homeHref: { type: String, default: '/?gestio=1' },
  kioskHref: { type: String, default: '/' },
  // El menú d'aplicacions només surt a l'administració que ha entrat.
  showApps: { type: Boolean, default: false },
});

const dark = ref(document.documentElement.classList.contains('dark'));
function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle('dark', dark.value);
  localStorage.setItem('quota_theme', dark.value ? 'dark' : 'light');
  localStorage.setItem('darkMode', dark.value ? 'true' : 'false');
}

</script>

<template>
  <nav class="app-nav" aria-label="Navegació principal">
    <div class="nav-inner">
      <a class="brand" :href="homeHref">
        <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
        <span class="brand-title">Pantalles</span>
      </a>

      <!-- A la gestió només hi entra l'administració. -->
      <AppsMenu current="pantalles" :signed-in="showApps" is-admin can-retards />

      <div class="nav-center"></div>

      <a class="nav-chip-button" :href="kioskHref" target="_blank" rel="noopener" aria-label="Obre el quiosc">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
        <span class="nav-chip-label">Obre el quiosc</span>
      </a>

      <button type="button" class="nav-icon-button" :aria-label="dark ? 'Activa el tema clar' : 'Activa el tema fosc'" :title="dark ? 'Tema clar' : 'Tema fosc'" @click="toggleTheme">
        <svg v-if="dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
      </button>
    </div>
  </nav>
</template>
