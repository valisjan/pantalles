<script setup>
import { onBeforeUnmount, ref } from 'vue';

// Mateixa barra que Guàrdies: logo, menú d'aplicacions i tema.
const netlifyMode = window.location.hostname.endsWith('.netlify.app');
const appLinks = [
  { name: 'Quota', description: 'Assignació de classes', href: netlifyMode ? 'https://chic-tartufo-68ee9c.netlify.app/' : 'https://quota.iessureda.com/' },
  { name: 'Guàrdies', description: 'Full de guàrdies del dia', href: netlifyMode ? 'https://guardies.netlify.app/' : 'https://guardies.iessureda.com/' },
  { name: 'Retards', description: "Retards de l'alumnat", href: netlifyMode ? 'https://spontaneous-gecko-a2703a.netlify.app/' : 'https://retards.iessureda.com/' },
];

defineProps({
  homeHref: { type: String, default: '/?gestio=1' },
  kioskHref: { type: String, default: '/' },
});

const dark = ref(document.documentElement.classList.contains('dark'));
function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle('dark', dark.value);
  localStorage.setItem('quota_theme', dark.value ? 'dark' : 'light');
  localStorage.setItem('darkMode', dark.value ? 'true' : 'false');
}

const appsOpen = ref(false);
const appsMenu = ref(null);
function closeAppsOnOutside(event) {
  if (appsMenu.value && !appsMenu.value.contains(event.target)) appsOpen.value = false;
}
function closeAppsOnEscape(event) {
  if (event.key === 'Escape') appsOpen.value = false;
}
document.addEventListener('click', closeAppsOnOutside);
document.addEventListener('keydown', closeAppsOnEscape);
onBeforeUnmount(() => {
  document.removeEventListener('click', closeAppsOnOutside);
  document.removeEventListener('keydown', closeAppsOnEscape);
});
</script>

<template>
  <nav class="app-nav" aria-label="Navegació principal">
    <div class="nav-inner">
      <a class="brand" :href="homeHref">
        <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
        <span class="brand-title">Pantalles</span>
      </a>

      <div ref="appsMenu" class="apps-menu">
        <button type="button" class="nav-chip-button" aria-label="Apps" aria-haspopup="true" :aria-expanded="appsOpen" aria-controls="apps-menu-list" @click="appsOpen = !appsOpen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>
          <span class="nav-chip-label">Apps</span>
        </button>
        <div v-if="appsOpen" id="apps-menu-list" class="apps-popover">
          <a v-for="app in appLinks" :key="app.name" :href="app.href" class="apps-link">
            <strong>{{ app.name }}</strong>
            <small>{{ app.description }}</small>
          </a>
        </div>
      </div>

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
