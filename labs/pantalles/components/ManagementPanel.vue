<script setup>
import { computed, ref } from 'vue';
import { normalizeCanvaUrl, normalizeDriveUrl } from '../../../src/domain/embeds.js';
import {
  SCHEDULE_STATUS_LABELS,
  normalizeSchedule,
  playlistFor,
  scheduleForTomorrow,
  scheduleStatus,
  viewHasContent,
} from '../../../src/domain/schedule.js';
import { useClock } from '../composables/useClock.js';
import ReleaseNotes from './ReleaseNotes.vue';
import ScheduleEditor from './ScheduleEditor.vue';

// La configuració es modifica al lloc i `save` en programa el desament.
const props = defineProps({
  config: { type: Object, required: true },
  status: { type: Object, required: true },
  adminReady: { type: Boolean, default: false },
  adminAllowed: { type: Boolean, default: false },
  signingIn: { type: Boolean, default: false },
  kioskUrl: { type: String, required: true },
});
const emit = defineEmits(['save', 'sign-in']);
const editingViewId = defineModel('editingViewId', { type: String, default: '' });

const VIEW_TYPES = [
  { type: 'guardies', name: 'Guàrdies', help: 'Full, pati i sortides', defaultName: 'Guàrdies del dia' },
  { type: 'drive', name: 'Google Drive', help: 'Imatge, PDF o presentació', defaultName: 'Contingut de Drive' },
  { type: 'canva', name: 'Canva', help: 'Presentació sempre actualitzada', defaultName: 'Presentació Canva' },
  { type: 'text', name: 'Anunci', help: 'Text gran a pantalla completa', defaultName: 'Avís' },
];
const DURATIONS = [
  { value: 10, label: '10 segons' },
  { value: 15, label: '15 segons' },
  { value: 20, label: '20 segons' },
  { value: 30, label: '30 segons' },
  { value: 60, label: '1 minut' },
  { value: 120, label: '2 minuts' },
];

const { minute } = useClock();
const tab = ref('views');
const showTypePicker = ref(false);
const linkError = ref('');
const copied = ref(false);
const views = computed(() => props.config.views || []);
const editingView = computed(() => views.value.find((view) => view.id === editingViewId.value) || views.value[0] || null);
const several = computed(() => views.value.length > 1);
const saveLabel = computed(() => {
  if (copied.value) return 'URL copiada';
  return { saving: 'Desant…', error: 'No s’ha desat' }[props.status.save] || 'Desat';
});

function save() {
  emit('save');
}

function uniqueViewId() {
  let number = views.value.length + 1;
  let id = `vista-${number}`;
  while (views.value.some((view) => view.id === id)) id = `vista-${++number}`;
  return id;
}

// Estat de cada vista a la llista: què passa ara a la pantalla amb ella.
const onScreen = computed(() => new Set(playlistFor(views.value, props.config.forcedViewId, minute.value).map((view) => view.id)));
function viewBadge(view) {
  if (!viewHasContent(view)) return { tone: 'empty', label: 'Sense contingut' };
  const status = scheduleStatus(view.schedule, minute.value);
  const shown = onScreen.value.has(view.id);
  // Una vista activa pot quedar tapada per un anunci que ocupa la pantalla.
  if ((status === 'active' || status === 'always') && !shown) return { tone: 'held', label: 'En espera' };
  if (status === 'always') return null;
  return { tone: status, label: SCHEDULE_STATUS_LABELS[status] };
}

function addView(type) {
  const id = uniqueViewId();
  const kind = VIEW_TYPES.find((item) => item.type === type);
  props.config.views.push({
    id, name: kind.defaultName, duration: 20, modules: ['guardies', 'pati', 'sortides'], type, driveUrl: '', canvaUrl: '', text: '',
    // El contingut nou queda programat per a demà fins que se'n triï el moment.
    schedule: normalizeSchedule(type === 'guardies' ? {} : scheduleForTomorrow(minute.value)),
  });
  editingViewId.value = id;
  showTypePicker.value = false;
  save();
}

function removeView(id) {
  if (views.value.length <= 1) return;
  const index = views.value.findIndex((view) => view.id === id);
  if (index < 0) return;
  props.config.views.splice(index, 1);
  if (props.config.forcedViewId === id) props.config.forcedViewId = '';
  editingViewId.value = views.value[Math.min(index, views.value.length - 1)].id;
  save();
}

function moveView(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= views.value.length) return;
  const list = props.config.views;
  [list[index], list[target]] = [list[target], list[index]];
  save();
}

function changePlaybackMode(event) {
  props.config.forcedViewId = event.target.value === 'fixed' ? (editingView.value?.id || views.value[0]?.id || '') : '';
  save();
}

function saveLink(field, normalize, message) {
  const view = editingView.value;
  if (!view) return;
  const normalized = normalize(view[field]);
  if (!normalized && String(view[field] || '').trim()) {
    linkError.value = message;
    return;
  }
  view[field] = normalized;
  linkError.value = '';
  save();
}

async function copyKioskUrl() {
  await navigator.clipboard.writeText(props.kioskUrl);
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1500);
}
</script>

<template>
  <aside class="management-panel">
    <div v-if="!adminReady" class="panel-loading"><span class="spinner" aria-hidden="true"></span></div>

    <div v-else-if="!adminAllowed" class="panel-signin">
      <img src="/logo_IESJSB_nav.png" alt="IES Josep Sureda i Blanes" />
      <h1>Gestió de pantalles</h1>
      <p>Cal iniciar sessió amb un compte d’administració del centre.</p>
      <button type="button" class="primary-button" :disabled="signingIn" @click="emit('sign-in')">
        {{ signingIn ? 'Connectant…' : 'Inicia sessió com a administrador/a' }}
      </button>
      <p v-if="status.error" class="form-error">{{ status.error }}</p>
    </div>

    <template v-else>
      <div class="management-heading">
        <div>
          <span class="panel-kicker">Gestió de pantalles</span>
          <h1>{{ config.name }}</h1>
        </div>
        <span class="save-status" :class="`is-${status.save}`" role="status">
          <span class="save-status-dot" aria-hidden="true"></span>{{ saveLabel }}
        </span>
      </div>

      <div class="screen-actions">
        <label class="switch-toggle">
          <input v-model="config.active" type="checkbox" @change="save" />
          <span>Pantalla activa</span>
        </label>
        <button type="button" class="secondary-button" @click="copyKioskUrl">Copia la URL del quiosc</button>
      </div>
      <p class="field-help">El quiosc s’actualitza sol quan hi ha una versió nova i cada dia a les 6.30. Per recarregar-lo a mà, mantén premut el rellotge 3 segons.</p>

      <div class="segmented" role="tablist" aria-label="Configuració de la pantalla">
        <button type="button" role="tab" :aria-selected="tab === 'views'" :class="{ active: tab === 'views' }" @click="tab = 'views'">Vistes</button>
        <button type="button" role="tab" :aria-selected="tab === 'notice'" :class="{ active: tab === 'notice' }" @click="tab = 'notice'">Avís</button>
        <button type="button" role="tab" :aria-selected="tab === 'appearance'" :class="{ active: tab === 'appearance' }" @click="tab = 'appearance'">Aparença</button>
      </div>

      <section v-show="tab === 'views'" class="panel-section">
        <div class="section-heading">
          <div>
            <h2>Contingut de la pantalla</h2>
            <p>Tria què es mostrarà i en quin ordre.</p>
          </div>
          <button type="button" class="primary-button" @click="showTypePicker = !showTypePicker">{{ showTypePicker ? '× Tanca' : '+ Nova vista' }}</button>
        </div>

        <div v-if="showTypePicker" class="view-type-picker">
          <button v-for="kind in VIEW_TYPES" :key="kind.type" type="button" @click="addView(kind.type)">
            <strong>{{ kind.name }}</strong><span>{{ kind.help }}</span>
          </button>
        </div>

        <div v-if="several" class="field-grid">
          <label>Reproducció
            <select :value="config.forcedViewId ? 'fixed' : 'automatic'" @change="changePlaybackMode">
              <option value="automatic">Canvia automàticament</option>
              <option value="fixed">Vista fixa</option>
            </select>
          </label>
          <label v-if="config.forcedViewId">Vista visible
            <select v-model="config.forcedViewId" @change="save">
              <option v-for="view in views" :key="view.id" :value="view.id">{{ view.name }}</option>
            </select>
          </label>
        </div>

        <div v-if="several" class="view-list" role="tablist" aria-label="Vistes de la pantalla">
          <div v-for="(view, index) in views" :key="view.id" class="view-list-row" :class="{ selected: editingView?.id === view.id }">
            <button type="button" class="view-select" role="tab" :aria-selected="editingView?.id === view.id" @click="editingViewId = view.id">
              <strong>{{ view.name }}</strong>
              <span v-if="viewBadge(view)" class="view-badge" :class="`is-${viewBadge(view).tone}`">{{ viewBadge(view).label }}</span>
              <span v-else-if="!config.forcedViewId">{{ view.duration }} s</span>
            </button>
            <button type="button" class="icon-button" aria-label="Mou la vista cap amunt" :disabled="index === 0" @click="moveView(index, -1)">↑</button>
            <button type="button" class="icon-button" aria-label="Mou la vista cap avall" :disabled="index === views.length - 1" @click="moveView(index, 1)">↓</button>
          </div>
        </div>

        <div v-if="editingView" class="view-editor">
          <p class="editor-title">Configura aquesta vista</p>
          <div :class="{ 'field-grid': several && !config.forcedViewId }">
            <label>Nom de la vista
              <input v-model="editingView.name" maxlength="60" @input="save" />
            </label>
            <label v-if="several && !config.forcedViewId">Durada
              <select v-model.number="editingView.duration" @change="save">
                <option v-for="duration in DURATIONS" :key="duration.value" :value="duration.value">{{ duration.label }}</option>
              </select>
            </label>
          </div>

          <div v-if="editingView.type === 'guardies'" class="type-help">
            <strong>Guàrdies</strong>
            <span>Mostra el full publicat, les zones de pati i els grups de sortida.</span>
          </div>

          <template v-else-if="editingView.type === 'drive'">
            <div class="type-help">
              <strong>Google Drive</strong>
              <span>A Drive, prem Compartir › Accés general › Qualsevol persona amb l’enllaç › Lector. Copia l’enllaç i enganxa’l aquí.</span>
              <span>Si la pantalla és vertical, fes el contingut en format vertical (1080 × 1920) perquè l’ocupi sencera.</span>
            </div>
            <label>Enllaç de Drive
              <textarea v-model="editingView.driveUrl" rows="3" placeholder="Enganxa aquí l’enllaç compartit" @change="saveLink('driveUrl', normalizeDriveUrl, 'Enganxa un enllaç compartit de Google Drive vàlid.')"></textarea>
            </label>
          </template>

          <template v-else-if="editingView.type === 'canva'">
            <div class="type-help">
              <strong>Canva</strong>
              <span>A Canva, obre Compartir › Insereix, copia el codi i enganxa’l aquí.</span>
              <span>Si la pantalla és vertical, fes el disseny en format vertical (1080 × 1920) perquè l’ocupi sencera.</span>
            </div>
            <label>Enllaç o codi d’inserció
              <textarea v-model="editingView.canvaUrl" rows="3" placeholder="Enganxa aquí el codi de Canva" @change="saveLink('canvaUrl', normalizeCanvaUrl, 'Enganxa un enllaç o un codi d’inserció de Canva vàlid.')"></textarea>
            </label>
          </template>

          <template v-else-if="editingView.type === 'text'">
            <div class="type-help">
              <strong>Anunci</strong>
              <span>El nom de la vista fa de títol i el text es mostra en gran. Ideal per a avisos puntuals.</span>
            </div>
            <label>Text de l’anunci
              <textarea v-model="editingView.text" rows="5" maxlength="600" placeholder="Per exemple: Simulacre d’evacuació a les 12.00 h. Seguiu les indicacions del professorat." @input="save"></textarea>
            </label>
          </template>

          <ScheduleEditor v-if="several" :view="editingView" @save="save" />

          <p v-if="linkError" class="form-error">{{ linkError }}</p>
          <button v-if="several" type="button" class="danger-button" @click="removeView(editingView.id)">Elimina la vista</button>
        </div>
      </section>

      <section v-show="tab === 'notice'" class="panel-section">
        <label>Avís a la pantalla
          <textarea v-model="config.message" rows="5" maxlength="240" placeholder="Escriu un avís temporal" @input="save"></textarea>
        </label>
        <p class="field-help">Es mostra a sobre del contingut fins que l’esborris.</p>
      </section>

      <section v-show="tab === 'appearance'" class="panel-section">
        <label>Nom de la pantalla
          <input v-model="config.name" maxlength="80" @input="save" />
        </label>
        <div class="field-grid">
          <label>Tema del quiosc
            <select v-model="config.theme" @change="save">
              <option value="light">Clar</option>
              <option value="dark">Fosc</option>
            </select>
          </label>
          <label>Mida del contingut
            <select v-model.number="config.scale" @change="save">
              <option v-for="value in [90, 100, 110, 120, 130]" :key="value" :value="value">{{ value }}%</option>
            </select>
          </label>
        </div>
      </section>

      <p v-if="status.error" class="form-error">{{ status.error }}</p>
      <ReleaseNotes />
    </template>
  </aside>
</template>
