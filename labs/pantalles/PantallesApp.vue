<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { isIsoDate } from '../../src/domain/calendar.js';
import { signInPantalles } from '../../src/services/auth.js';
import { DEFAULT_SCREEN_ID, isPantallesAdmin } from '../../src/services/pantallesStorage.js';
import AppTopBar from './components/AppTopBar.vue';
import KioskScreen from './components/KioskScreen.vue';
import ManagementPanel from './components/ManagementPanel.vue';
import { useScreenConfig } from './composables/useScreenConfig.js';

const params = new URLSearchParams(window.location.search);
const screenId = params.get('pantalla') || DEFAULT_SCREEN_ID;
const managementMode = params.get('gestio') === '1';
const queryCourse = params.get('curs') || '';
const queryDate = isIsoDate(params.get('data')) ? params.get('data') : '';
// El quiosc és tàctil: sense zoom ni selecció accidentals ni "estirar per recarregar".
if (!managementMode) document.documentElement.classList.add('kiosk-mode');

const adminReady = ref(!managementMode);
const adminAllowed = ref(false);
const signingIn = ref(false);
const { config, status, scheduleSave, stop } = useScreenConfig(screenId, {
  canSave: () => managementMode && adminAllowed.value,
});

// Vista que s'edita a la gestió: és també la que mostra la vista prèvia.
const editingViewId = ref('');
watch(() => status.revision, () => {
  if (!config.views.some((view) => view.id === editingViewId.value)) editingViewId.value = config.views[0]?.id || '';
});

const kioskUrl = computed(() => {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('pantalla', screenId);
  return url.toString();
});
const managementHref = `/?gestio=1&pantalla=${encodeURIComponent(screenId)}`;

async function signIn() {
  signingIn.value = true;
  status.error = '';
  try {
    await signInPantalles();
    adminAllowed.value = await isPantallesAdmin();
    if (!adminAllowed.value) status.error = 'Aquest compte no té permís per gestionar les pantalles.';
  } catch (error) {
    status.error = error?.message || String(error);
  } finally {
    signingIn.value = false;
    adminReady.value = true;
  }
}

onMounted(async () => {
  if (!managementMode) return;
  adminAllowed.value = await isPantallesAdmin().catch(() => false);
  adminReady.value = true;
});
onBeforeUnmount(stop);
</script>

<template>
  <div v-if="managementMode" class="management-shell">
    <AppTopBar :home-href="managementHref" :kiosk-href="kioskUrl" />
    <div class="management-layout">
      <ManagementPanel
        v-model:editing-view-id="editingViewId"
        :config="config"
        :status="status"
        :admin-ready="adminReady"
        :admin-allowed="adminAllowed"
        :signing-in="signingIn"
        :kiosk-url="kioskUrl"
        @save="scheduleSave"
        @sign-in="signIn"
      />
      <div class="management-preview" aria-label="Vista prèvia de la pantalla">
        <KioskScreen
          :config="config"
          :config-revision="status.revision"
          :config-loading="status.loading"
          :preview-view-id="editingViewId || config.views[0]?.id || 'guardies'"
          :query-course="queryCourse"
          :query-date="queryDate"
        />
      </div>
    </div>
  </div>
  <KioskScreen
    v-else
    :config="config"
    :config-revision="status.revision"
    :config-loading="status.loading"
    :query-course="queryCourse"
    :query-date="queryDate"
  />
</template>
