<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import GuardiesKioskPrototype from './GuardiesKioskPrototype.vue';
import { signInPantalles } from '../../src/services/auth.js';
import { PANTALLES_RELEASES, PANTALLES_VERSION } from './version.js';
import {
  DEFAULT_SCREEN_CONFIG,
  DEFAULT_SCREEN_ID,
  isPantallesAdmin,
  saveScreenConfig,
  subscribePublicGuardiesDay,
  subscribeScreenConfig,
} from '../../src/services/pantallesStorage.js';

const params = new URLSearchParams(window.location.search);
const screenId = params.get('pantalla') || DEFAULT_SCREEN_ID;
const managementMode = params.get('gestio') === '1';
const queryCourse = params.get('curs') || '';
const queryDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') || '') ? params.get('data') : '';
const prototypeMode = params.get('prototip') === 'quiosc-guardies';

const config = reactive({ ...DEFAULT_SCREEN_CONFIG });
const day = ref(null);
const loadingConfig = ref(true);
const loadingDay = ref(true);
const connected = ref(navigator.onLine);
const localDate = ref('');
const localScale = ref(null);
const configExists = ref(false);
const adminReady = ref(!managementMode);
const adminAllowed = ref(false);
const signingIn = ref(false);
const saveState = ref('idle');
const errorMessage = ref('');
const activeViewIndex = ref(0);
const editingViewId = ref('');
const clock = ref(new Date());
const showViewTypePicker = ref(false);
const adminTab = ref('views');
const managementDark = ref(localStorage.getItem('quota_theme') === 'dark' || document.documentElement.classList.contains('dark'));
let unsubscribeConfig = () => {};
let unsubscribeDay = () => {};
let saveTimer = null;
let idleTimer = null;
let rotationTimer = null;
let clockTimer = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const value = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${value}`;
}

function shiftIsoDate(value, amount) {
  const [year, month, date] = String(value).split('-').map(Number);
  const next = new Date(year, month - 1, date + amount, 12);
  return localDateString(next);
}

function configuredDate() {
  if (queryDate) return queryDate;
  return localDateString();
}

const selectedDate = computed(() => localDate.value || configuredDate());
const selectedCourse = computed(() => queryCourse || config.courseId || DEFAULT_SCREEN_CONFIG.courseId);
const activeScale = computed(() => localScale.value ?? config.scale ?? 100);
const views = computed(() => Array.isArray(config.views) ? config.views : []);
const editingView = computed(() => views.value.find((view) => view.id === editingViewId.value) || views.value[0] || null);
const activeView = computed(() => {
  if (managementMode) return editingView.value;
  const forced = views.value.find((view) => view.id === config.forcedViewId);
  return forced || views.value[activeViewIndex.value % Math.max(views.value.length, 1)] || null;
});
const activeViewType = computed(() => activeView.value?.type || 'guardies');
const enabledModules = computed(() => new Set(['guardies', 'pati', 'sortides']));
const isReady = computed(() => !loadingConfig.value && !loadingDay.value);
const hours = computed(() => Array.isArray(day.value?.hours) ? day.value.hours : []);
const outings = computed(() => Array.isArray(day.value?.groupsOut) ? day.value.groupsOut : []);
const guardSessionCounters = computed(() => hours.value
  .filter((hour) => !isPatio(hour) && hourVisible(hour))
  .map((hour, index) => ({
    key: hour.key,
    label: String(hour.label || '').match(/^\d+a/)?.[0] || `${index + 1}a`,
    count: (hour.rows || []).filter((row) => (
      !row.cancelled && !row.coTeacher && row.group !== 'Guàrdia'
    )).length,
    current: isCurrentHour(hour),
  })));
const formattedDate = computed(() => {
  const [year, month, date] = selectedDate.value.split('-').map(Number);
  return new Intl.DateTimeFormat('ca-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(year, month - 1, date, 12));
});
const selectedDayIsWeekend = computed(() => {
  const [year, month, date] = selectedDate.value.split('-').map(Number);
  const weekday = new Date(year, month - 1, date, 12).getDay();
  return weekday === 0 || weekday === 6;
});
const formattedTime = computed(() => new Intl.DateTimeFormat('ca-ES', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(clock.value));
const currentSlot = computed(() => {
  const now = clock.value;
  if (now.getDay() === 0 || now.getDay() === 6) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const slots = [
    [480, 535, '1a hora'], [535, 590, '2a hora'], [590, 645, '3a hora'],
    [645, 675, 'Pati'], [675, 730, '4a hora'], [730, 785, '5a hora'],
    [785, 840, '6a hora'], [840, 900, '7a hora'],
  ];
  return slots.find(([start, end]) => minutes >= start && minutes < end)?.[2] || null;
});
const currentSession = computed(() => currentSlot.value || 'Fora de l’horari lectiu');
const kioskUrl = computed(() => {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('pantalla', screenId);
  return url.toString();
});

function isPatio(hour) {
  return hour?.key === 'PATI' || hour?.kind === 'patio';
}

function hourVisible(hour) {
  return isPatio(hour) ? enabledModules.value.has('pati') : enabledModules.value.has('guardies');
}

function isCurrentHour(hour) {
  if (!currentSlot.value || selectedDate.value !== localDateString(clock.value)) return false;
  if (currentSlot.value === 'Pati') return isPatio(hour);
  return String(hour?.label || '').startsWith(currentSlot.value);
}

function centerCurrentHour() {
  if (managementMode || activeViewType.value !== 'guardies' || !currentSlot.value) return;
  nextTick(() => {
    document.querySelector('.kiosk-preview .hour-card.current-session')?.scrollIntoView({
      behavior: 'smooth', block: 'center', inline: 'nearest',
    });
  });
}

function centerHour(key) {
  nextTick(() => {
    const card = Array.from(document.querySelectorAll('.kiosk-preview .hour-card'))
      .find((element) => element.dataset.hourKey === String(key));
    card?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  });
}

function resetLocalViewSoon() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    localDate.value = '';
    localScale.value = null;
  }, 90_000);
}

function shiftDay(amount) {
  localDate.value = shiftIsoDate(selectedDate.value, amount);
  resetLocalViewSoon();
}

function returnToday() {
  localDate.value = localDateString();
  resetLocalViewSoon();
}

function changeScale(amount) {
  localScale.value = Math.min(140, Math.max(80, activeScale.value + amount));
  resetLocalViewSoon();
}

function resetScale() {
  localScale.value = config.scale;
  resetLocalViewSoon();
}

function scheduleConfigSave() {
  if (!managementMode || !adminAllowed.value) return;
  window.clearTimeout(saveTimer);
  saveState.value = 'saving';
  saveTimer = window.setTimeout(async () => {
    try {
      await saveScreenConfig(screenId, { ...config });
      saveState.value = 'saved';
      errorMessage.value = '';
    } catch (error) {
      saveState.value = 'error';
      errorMessage.value = error?.message || String(error);
    }
  }, 350);
}

function uniqueViewId() {
  let number = views.value.length + 1;
  let id = `vista-${number}`;
  while (views.value.some((view) => view.id === id)) id = `vista-${++number}`;
  return id;
}

function addView(type = 'guardies') {
  const id = uniqueViewId();
  const names = { guardies: 'Guàrdies del dia', drive: 'Contingut de Drive', canva: 'Presentació Canva' };
  config.views.push({
    id, name: names[type], duration: 20, modules: ['guardies', 'pati', 'sortides'], type,
    driveUrl: '', canvaUrl: '',
  });
  editingViewId.value = id;
  showViewTypePicker.value = false;
  scheduleConfigSave();
}

function changePlaybackMode(event) {
  config.forcedViewId = event.target.value === 'fixed' ? (editingView.value?.id || config.views[0]?.id || '') : '';
  scheduleConfigSave();
}

function removeView(id) {
  if (config.views.length <= 1) return;
  const index = config.views.findIndex((view) => view.id === id);
  if (index < 0) return;
  config.views.splice(index, 1);
  if (config.forcedViewId === id) config.forcedViewId = '';
  editingViewId.value = config.views[Math.min(index, config.views.length - 1)].id;
  config.modules = [...(config.views[0]?.modules || [])];
  scheduleConfigSave();
}

function normalizeDriveUrl(value) {
  const raw = String(value || '').trim();
  const iframeSource = raw.match(/src=["']([^"']+)["']/i)?.[1];
  const candidate = (iframeSource || raw).replaceAll('&amp;', '&');
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (!['drive.google.com', 'docs.google.com'].includes(host)) return '';
    const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
    if (fileId) return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
    const documentMatch = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (!documentMatch) return '';
    const [, kind, id] = documentMatch;
    if (kind === 'presentation') {
      return `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/embed?start=true&loop=true&delayms=10000`;
    }
    return `https://docs.google.com/${kind}/d/${encodeURIComponent(id)}/preview`;
  } catch {
    return '';
  }
}

function saveDriveLink() {
  if (!editingView.value) return;
  const normalized = normalizeDriveUrl(editingView.value.driveUrl);
  if (!normalized && editingView.value.driveUrl.trim()) {
    errorMessage.value = 'Enganxa un enllaç compartit de Google Drive vàlid.';
    return;
  }
  editingView.value.driveUrl = normalized;
  errorMessage.value = '';
  scheduleConfigSave();
}

function normalizeCanvaUrl(value) {
  const raw = String(value || '').trim();
  const iframeSource = raw.match(/src=["']([^"']+)["']/i)?.[1];
  const candidate = (iframeSource || raw).replaceAll('&amp;', '&');
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !(url.hostname === 'canva.com' || url.hostname.endsWith('.canva.com'))) return '';
    url.searchParams.set('embed', '');
    return url.toString();
  } catch {
    return '';
  }
}

function saveCanvaLink() {
  if (!editingView.value) return;
  const normalized = normalizeCanvaUrl(editingView.value.canvaUrl);
  if (!normalized && editingView.value.canvaUrl.trim()) {
    errorMessage.value = 'Enganxa un enllaç o un codi d’inserció de Canva vàlid.';
    return;
  }
  editingView.value.canvaUrl = normalized;
  errorMessage.value = '';
  scheduleConfigSave();
}

function moveView(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= config.views.length) return;
  [config.views[index], config.views[target]] = [config.views[target], config.views[index]];
  config.modules = [...(config.views[0]?.modules || [])];
  scheduleConfigSave();
}

function scheduleRotation() {
  window.clearTimeout(rotationTimer);
  if (managementMode || config.forcedViewId || views.value.length < 2) return;
  const duration = Math.min(300, Math.max(5, Number(activeView.value?.duration) || 20));
  rotationTimer = window.setTimeout(() => {
    activeViewIndex.value = (activeViewIndex.value + 1) % views.value.length;
    scheduleRotation();
  }, duration * 1000);
}

async function copyKioskUrl() {
  await navigator.clipboard.writeText(kioskUrl.value);
  saveState.value = 'copied';
  window.setTimeout(() => { if (saveState.value === 'copied') saveState.value = 'saved'; }, 1500);
}

function toggleManagementTheme() {
  managementDark.value = !managementDark.value;
  document.documentElement.classList.toggle('dark', managementDark.value);
  localStorage.setItem('quota_theme', managementDark.value ? 'dark' : 'light');
  localStorage.setItem('darkMode', managementDark.value ? 'true' : 'false');
}

async function signIn() {
  signingIn.value = true;
  errorMessage.value = '';
  try {
    await signInPantalles();
    adminAllowed.value = await isPantallesAdmin();
  } catch (error) {
    errorMessage.value = error?.message || String(error);
  } finally {
    signingIn.value = false;
    adminReady.value = true;
  }
}

watch([selectedCourse, selectedDate], ([courseId, date]) => {
  if (prototypeMode) return;
  unsubscribeDay();
  day.value = null;
  loadingDay.value = true;
  unsubscribeDay = subscribePublicGuardiesDay(courseId, date, (value) => {
    day.value = value;
    loadingDay.value = false;
    errorMessage.value = '';
  }, (error) => {
    loadingDay.value = false;
    errorMessage.value = error?.code === 'permission-denied'
      ? 'No s’ha pogut carregar la jornada.'
      : (error?.message || String(error));
  });
}, { immediate: true });

watch([views, () => config.forcedViewId, activeViewIndex], scheduleRotation, { deep: true });
watch([currentSlot, selectedDate, activeViewType, day], centerCurrentHour);

onMounted(async () => {
  if (prototypeMode) return;
  if (managementMode) {
    adminAllowed.value = await isPantallesAdmin().catch(() => false);
    adminReady.value = true;
  }
  unsubscribeConfig = subscribeScreenConfig(screenId, (next, exists) => {
    Object.assign(config, next);
    if (!config.views.some((view) => view.id === editingViewId.value)) editingViewId.value = config.views[0]?.id || '';
    activeViewIndex.value = 0;
    configExists.value = exists;
    localDate.value = '';
    localScale.value = null;
    loadingConfig.value = false;
  }, (error) => {
    loadingConfig.value = false;
    errorMessage.value = error?.message || String(error);
  });
  window.addEventListener('online', () => { connected.value = true; });
  window.addEventListener('offline', () => { connected.value = false; });
  clockTimer = window.setInterval(() => { clock.value = new Date(); }, 1000);
});

onBeforeUnmount(() => {
  unsubscribeConfig();
  unsubscribeDay();
  window.clearTimeout(saveTimer);
  window.clearTimeout(idleTimer);
  window.clearTimeout(rotationTimer);
  window.clearInterval(clockTimer);
});
</script>

<template>
  <main
    class="display-shell"
    :class="[`theme-${config.theme}`, { 'management-mode': managementMode, 'management-dark': managementMode && managementDark }]"
    :style="{ '--display-scale': activeScale / 100, '--display-height': `${10000 / activeScale}vh` }"
  >
    <GuardiesKioskPrototype v-if="prototypeMode" />
    <template v-else>
    <nav v-if="managementMode" class="management-nav" aria-label="Navegació principal">
      <div class="management-nav-inner">
        <a class="management-brand" href="/?gestio=1&amp;pantalla=sala-professorat">
          <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
          <span><strong>PANTALLES</strong><small>IES Josep Sureda i Blanes</small></span>
        </a>
        <div class="management-nav-tabs" aria-label="Seccions">
          <a href="https://quota.iessureda.com/">Quota</a>
          <a href="https://guardies.iessureda.com/">Guàrdies</a>
          <a href="https://guardies.iessureda.com/?vista=professor">Professorat</a>
          <a class="active" href="/?gestio=1&amp;pantalla=sala-professorat" aria-current="page">Pantalles</a>
        </div>
        <button type="button" class="management-theme-toggle" aria-label="Canvia el tema" @click="toggleManagementTheme">
          <span aria-hidden="true">◐</span> {{ managementDark ? 'Clar' : 'Fosc' }}
        </button>
      </div>
      <div class="management-brand-strip" aria-hidden="true"><span></span><span></span><span></span></div>
    </nav>

    <aside v-if="managementMode" class="management-panel">
      <template v-if="!adminReady">
        <div class="panel-loading"><span class="spinner"></span></div>
      </template>
      <template v-else-if="!adminAllowed">
        <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
        <h1>Gestió de pantalles</h1>
        <button type="button" :disabled="signingIn" @click="signIn">
          {{ signingIn ? 'Connectant…' : 'Inicia sessió com a administrador/a' }}
        </button>
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      </template>
      <template v-else>
        <div class="management-heading">
          <div>
            <span>Gestió de pantalles</span>
            <h1>{{ config.name }}</h1>
          </div>
          <span class="save-status">{{ saveState === 'saving' ? 'Desant…' : saveState === 'copied' ? 'URL copiada' : 'Desat' }}</span>
        </div>

        <div class="screen-actions">
          <label class="active-toggle">
            <input v-model="config.active" type="checkbox" @change="scheduleConfigSave" />
            Pantalla activa
          </label>
          <button type="button" class="secondary-button" @click="copyKioskUrl">Copia la URL del quiosc</button>
        </div>

        <nav class="management-tabs" aria-label="Configuració de la pantalla">
          <button type="button" :class="{ active: adminTab === 'views' }" @click="adminTab = 'views'">Vistes</button>
          <button type="button" :class="{ active: adminTab === 'notice' }" @click="adminTab = 'notice'">Avís</button>
          <button type="button" :class="{ active: adminTab === 'appearance' }" @click="adminTab = 'appearance'">Aparença</button>
        </nav>

        <section v-show="adminTab === 'views'" class="view-manager">
          <div class="view-manager-heading">
            <div>
              <h2>Contingut de la pantalla</h2>
              <p>Tria què es mostrarà i en quin ordre.</p>
            </div>
            <button type="button" @click="showViewTypePicker = !showViewTypePicker">{{ showViewTypePicker ? '× Tanca' : '+ Nova vista' }}</button>
          </div>

          <div v-if="showViewTypePicker" class="view-type-picker">
            <button type="button" @click="addView('guardies')"><strong>Guàrdies</strong><span>Full, pati i sortides</span></button>
            <button type="button" @click="addView('drive')"><strong>Google Drive</strong><span>Imatge, PDF o presentació</span></button>
            <button type="button" @click="addView('canva')"><strong>Canva</strong><span>Presentació sempre actualitzada</span></button>
          </div>

          <div v-if="config.views.length > 1" class="playback-settings">
            <label>Reproducció
              <select :value="config.forcedViewId ? 'fixed' : 'automatic'" @change="changePlaybackMode">
                <option value="automatic">Canvia automàticament</option>
                <option value="fixed">Vista fixa</option>
              </select>
            </label>
            <label v-if="config.forcedViewId">Vista visible
              <select v-model="config.forcedViewId" @change="scheduleConfigSave">
                <option v-for="view in config.views" :key="view.id" :value="view.id">{{ view.name }}</option>
              </select>
            </label>
          </div>

          <div v-if="config.views.length > 1" class="view-list" role="tablist" aria-label="Vistes de la pantalla">
            <div v-for="(view, index) in config.views" :key="view.id" class="view-list-row" :class="{ selected: editingView?.id === view.id }">
              <button type="button" class="view-select" role="tab" :aria-selected="editingView?.id === view.id" @click="editingViewId = view.id">
                <strong>{{ view.name }}</strong>
                <span v-if="!config.forcedViewId">{{ view.duration }} s</span>
              </button>
              <button type="button" class="icon-button" aria-label="Mou la vista cap amunt" :disabled="index === 0" @click="moveView(index, -1)">↑</button>
              <button type="button" class="icon-button" aria-label="Mou la vista cap avall" :disabled="index === config.views.length - 1" @click="moveView(index, 1)">↓</button>
            </div>
          </div>

          <div v-if="editingView" class="view-editor" :class="{ single: config.views.length === 1 }">
            <p class="editor-title">Configura aquesta vista</p>
            <div :class="{ 'management-grid': config.views.length > 1 && !config.forcedViewId }">
              <label>Nom de la vista
                <input v-model="editingView.name" maxlength="60" @input="scheduleConfigSave" />
              </label>
              <label v-if="config.views.length > 1 && !config.forcedViewId">Durada
                <select v-model.number="editingView.duration" @change="scheduleConfigSave">
                  <option :value="10">10 segons</option>
                  <option :value="15">15 segons</option>
                  <option :value="20">20 segons</option>
                  <option :value="30">30 segons</option>
                  <option :value="60">1 minut</option>
                  <option :value="120">2 minuts</option>
                </select>
              </label>
            </div>

            <div class="view-content-editor">
              <div v-if="editingView.type === 'guardies'" class="type-help">
                <strong>Guàrdies</strong>
                <span>Mostra el full publicat, les zones de pati i els grups de sortida.</span>
              </div>

              <template v-else-if="editingView.type === 'drive'">
                <div class="type-help">
                  <strong>Google Drive</strong>
                  <span>A Drive, prem Compartir › Accés general › Qualsevol persona amb l’enllaç › Lector. Copia l’enllaç i enganxa’l aquí.</span>
                </div>
                <label>Enllaç de Drive
                  <textarea v-model="editingView.driveUrl" rows="3" placeholder="Enganxa aquí l’enllaç compartit" @change="saveDriveLink"></textarea>
                </label>
              </template>

              <template v-else-if="editingView.type === 'canva'">
                <div class="type-help">
                  <strong>Canva</strong>
                  <span>A Canva, obre Compartir › Insereix, copia el codi i enganxa’l aquí.</span>
                </div>
                <label>Enllaç o codi d’inserció
                  <textarea v-model="editingView.canvaUrl" rows="3" placeholder="Enganxa aquí el codi de Canva" @change="saveCanvaLink"></textarea>
                </label>
              </template>
            </div>

            <button v-if="config.views.length > 1" type="button" class="delete-view" @click="removeView(editingView.id)">Elimina la vista</button>
          </div>
        </section>

        <section v-show="adminTab === 'notice'" class="settings-card">
          <label>Avís a la pantalla
            <textarea v-model="config.message" rows="5" maxlength="240" placeholder="Escriu un avís temporal" @input="scheduleConfigSave"></textarea>
          </label>
        </section>

        <section v-show="adminTab === 'appearance'" class="settings-card">
          <label>Nom de la pantalla
            <input v-model="config.name" maxlength="80" @input="scheduleConfigSave" />
          </label>
          <div class="management-grid">
            <label>Tema del quiosc
              <select v-model="config.theme" @change="scheduleConfigSave">
                <option value="light">Clar</option>
                <option value="dark">Fosc</option>
              </select>
            </label>
            <label>Mida del contingut
              <select v-model.number="config.scale" @change="scheduleConfigSave">
                <option :value="90">90%</option>
                <option :value="100">100%</option>
                <option :value="110">110%</option>
                <option :value="120">120%</option>
                <option :value="130">130%</option>
              </select>
            </label>
          </div>
        </section>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

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
    </aside>

    <section class="kiosk-preview" aria-live="polite">
      <div v-if="!connected" class="connection-banner">Sense connexió · mostrant la darrera informació disponible</div>

      <div v-if="!config.active && !managementMode" class="inactive-screen">
        <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
        <p>Pantalla temporalment desactivada</p>
      </div>

      <template v-else>
        <header class="display-header">
          <div class="display-brand">
            <img src="/logo_IESJSB_nav.png" alt="" />
            <div>
              <span>IES Josep Sureda i Blanes</span>
              <h1>{{ activeView?.name || 'Pantalla informativa' }}</h1>
            </div>
          </div>
          <div class="display-date">
            <span>{{ config.name }}</span>
            <strong>{{ formattedDate }}</strong>
            <div class="live-clock">
              <strong>{{ formattedTime }}</strong>
              <span>{{ currentSession }}</span>
            </div>
          </div>
        </header>

        <nav v-if="activeViewType === 'guardies'" class="touch-toolbar" aria-label="Navegació del dia">
          <div v-if="isReady && day" class="session-counters" aria-label="Guàrdies per sessió">
            <button
              v-for="counter in guardSessionCounters"
              :key="counter.key"
              type="button"
              class="session-counter"
              :class="{ clear: counter.count === 0, busy: counter.count > 0, current: counter.current }"
              :aria-label="`${counter.label}: ${counter.count} ${counter.count === 1 ? 'guàrdia' : 'guàrdies'}`"
              @click="centerHour(counter.key)"
            >
              <span>{{ counter.label }}</span>
              <strong>{{ counter.count }} G</strong>
            </button>
          </div>
          <div class="touch-actions">
            <button type="button" aria-label="Dia anterior" @click="shiftDay(-1)">←</button>
            <button type="button" class="today-button" @click="returnToday">Avui</button>
            <button type="button" aria-label="Dia següent" @click="shiftDay(1)">→</button>
            <span class="toolbar-separator"></span>
            <button type="button" aria-label="Redueix el text" @click="changeScale(-10)">−</button>
            <button type="button" class="scale-button" @click="resetScale">{{ activeScale }}%</button>
            <button type="button" aria-label="Augmenta el text" @click="changeScale(10)">+</button>
          </div>
        </nav>

        <p v-if="config.message" class="screen-message">{{ config.message }}</p>

        <section v-if="activeViewType === 'drive'" class="media-view drive-view">
          <iframe v-if="activeView?.driveUrl" :src="activeView.driveUrl" :title="activeView.name" allowfullscreen></iframe>
          <strong v-else>Enganxa l’enllaç compartit de Drive des de la gestió de la pantalla</strong>
        </section>

        <section v-else-if="activeViewType === 'canva'" class="media-view canva-view">
          <iframe v-if="activeView?.canvaUrl" :src="activeView.canvaUrl" :title="activeView.name" allowfullscreen></iframe>
          <strong v-else>Enganxa l’enllaç de Canva des de la gestió de la pantalla</strong>
        </section>

        <section v-else-if="!isReady" class="display-loading">
          <span class="spinner"></span>
          <strong>Carregant la jornada…</strong>
        </section>

        <section v-else-if="!day" class="no-day">
          <div class="no-day-date">{{ formattedDate }}</div>
          <strong>{{ selectedDayIsWeekend ? 'Dia no lectiu' : "No s'ha publicat el full de guàrdies d'aquest dia" }}</strong>
        </section>

        <div v-else class="day-content">
          <template v-for="hour in hours" :key="hour.key">
            <section
              v-if="hourVisible(hour)"
              class="hour-card"
              :data-hour-key="hour.key"
              :class="{ 'patio-card': isPatio(hour), 'current-session': isCurrentHour(hour), empty: !hour.rows?.length && !isPatio(hour) }"
            >
              <header>
                <h2>{{ hour.label }}</h2>
                <div class="session-meta">
                  <strong v-if="isCurrentHour(hour)">Ara</strong>
                  <span v-if="!isPatio(hour)">{{ hour.rows?.length ? `${hour.rows.length} ${hour.rows.length === 1 ? 'absència' : 'absències'}` : 'Sense absències' }}</span>
                </div>
              </header>

              <div v-if="isPatio(hour)" class="patio-grid">
                <article v-for="zone in hour.patio?.zones || []" :key="`${zone.name}-${zone.teacher}`" :class="{ absent: zone.absent }">
                  <strong>{{ zone.name }}</strong>
                  <span>{{ zone.teacher }}</span>
                  <em v-if="zone.absent">Absent</em>
                </article>
                <p v-if="hour.patio?.observation" class="patio-observation">{{ hour.patio.observation }}</p>
              </div>

              <div v-else-if="hour.rows?.length" class="guard-list">
                <article v-for="row in hour.rows" :key="row.id" class="guard-row" :class="{ pending: !row.assigned, cancelled: row.cancelled }">
                  <div class="absent-person">
                    <span>Absència</span>
                    <strong>{{ row.absent }}</strong>
                  </div>
                  <div class="session-detail">
                    <strong>{{ row.group || row.subject }}</strong>
                    <span>{{ [row.subject !== row.group ? row.subject : '', row.room].filter(Boolean).join(' · ') }}</span>
                  </div>
                  <div class="assigned-person">
                    <span>{{ row.coTeacher ? 'Queda amb el grup' : 'Preassignació' }}</span>
                    <strong>{{ row.assigned || 'Sense cobrir' }}</strong>
                  </div>
                  <p v-if="row.comment" class="row-comment">{{ row.comment }}</p>
                </article>
              </div>
            </section>
          </template>

          <section v-if="enabledModules.has('sortides') && outings.length" class="outings-card">
            <header><h2>Grups de sortida</h2></header>
            <div>
              <article v-for="group in outings" :key="group.id">
                <strong>{{ group.label }}</strong>
                <span>{{ group.partial ? 'Sortida parcial' : 'Fora del centre' }}</span>
              </article>
            </div>
          </section>
        </div>

        <footer class="display-footer">
          <span :class="{ online: connected }"></span>
          <span>{{ connected ? 'Actualització automàtica' : 'Sense connexió' }}</span>
        </footer>
      </template>
    </section>
    </template>
  </main>
</template>
