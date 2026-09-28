// Programació de les vistes d'una pantalla: quan es mostra cada vista i quines
// vistes s'alternen en cada moment. Mòdul pur, sense Vue ni Firebase.
import { isIsoDate, localDateString, shiftIsoDate } from './calendar.js';

export const WEEKDAYS = Object.freeze([
  { value: 1, short: 'Dl', name: 'dilluns' },
  { value: 2, short: 'Dt', name: 'dimarts' },
  { value: 3, short: 'Dc', name: 'dimecres' },
  { value: 4, short: 'Dj', name: 'dijous' },
  { value: 5, short: 'Dv', name: 'divendres' },
  { value: 6, short: 'Ds', name: 'dissabte' },
  { value: 7, short: 'Dg', name: 'diumenge' },
]);

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanTime(value) {
  return TIME_PATTERN.test(String(value || '')) ? String(value) : '';
}

function timeMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function isoWeekday(date) {
  return date.getDay() || 7;
}

export function normalizeSchedule(raw) {
  let from = isIsoDate(raw?.from) ? raw.from : '';
  let to = isIsoDate(raw?.to) ? raw.to : '';
  if (from && to && to < from) [from, to] = [to, from];
  if (!from && to) [from, to] = [to, ''];
  if (to === from) to = '';
  const start = cleanTime(raw?.start);
  let end = cleanTime(raw?.end);
  if (start && end && timeMinutes(end) <= timeMinutes(start)) end = '';
  const days = Array.from(new Set((Array.isArray(raw?.days) ? raw.days : []).map(Number)))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);
  return {
    mode: raw?.mode === 'scheduled' ? 'scheduled' : 'always',
    from,
    to,
    days,
    start,
    end,
    // Enviar informació a la pantalla vol dir, per defecte, que ocupi la pantalla.
    exclusive: raw?.exclusive !== false,
  };
}

function isScheduled(schedule) {
  return schedule?.mode === 'scheduled';
}

// Darrer dia de la programació: sense "fins al", és un sol dia.
function lastDay(schedule) {
  return schedule.to || schedule.from;
}

export function isScheduleActive(schedule, now) {
  if (!isScheduled(schedule)) return true;
  const today = localDateString(now);
  if (schedule.from && today < schedule.from) return false;
  if (lastDay(schedule) && today > lastDay(schedule)) return false;
  if (schedule.days?.length && !schedule.days.includes(isoWeekday(now))) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (schedule.start && minutes < timeMinutes(schedule.start)) return false;
  if (schedule.end && minutes >= timeMinutes(schedule.end)) return false;
  return true;
}

// Estat per a la gestió: sempre, ara en pantalla, pendent o finalitzada.
export function scheduleStatus(schedule, now) {
  if (!isScheduled(schedule)) return 'always';
  if (isScheduleActive(schedule, now)) return 'active';
  const final = lastDay(schedule);
  const today = localDateString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (final && (today > final || (today === final && schedule.end && minutes >= timeMinutes(schedule.end)))) {
    return 'expired';
  }
  return 'waiting';
}

export const SCHEDULE_STATUS_LABELS = Object.freeze({
  always: 'Sempre',
  active: 'Ara en pantalla',
  waiting: 'Programada',
  expired: 'Finalitzada',
});

function formatDay(value, options) {
  const [year, month, date] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ca-ES', options).format(new Date(year, month - 1, date, 12));
}

function joinCatalan(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} i ${items.at(-1)}`;
}

export function describeSchedule(schedule) {
  if (!isScheduled(schedule)) return 'Sempre';
  const parts = [];
  if (schedule.from && schedule.to) {
    parts.push(`Del ${formatDay(schedule.from, { day: 'numeric', month: 'long' })} al ${formatDay(schedule.to, { day: 'numeric', month: 'long' })}`);
  } else if (schedule.from) {
    const text = formatDay(schedule.from, { weekday: 'long', day: 'numeric', month: 'long' });
    parts.push(text.charAt(0).toUpperCase() + text.slice(1));
  }
  if (schedule.days?.length) {
    const names = WEEKDAYS.filter((day) => schedule.days.includes(day.value)).map((day) => day.name);
    const weekdays = schedule.days.join(',') === '1,2,3,4,5';
    const text = weekdays ? 'de dilluns a divendres' : `cada ${joinCatalan(names)}`;
    parts.push(parts.length ? text : text.charAt(0).toUpperCase() + text.slice(1));
  }
  if (schedule.start && schedule.end) parts.push(`${schedule.start}–${schedule.end}`);
  else if (schedule.start) parts.push(`des de les ${schedule.start}`);
  else if (schedule.end) parts.push(`fins a les ${schedule.end}`);
  else parts.push('tot el dia');
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Programació ràpida: a partir d'ara durant uns minuts, o tot el dia d'avui.
export function scheduleFromNow(now, minutes) {
  const pad = (value) => String(value).padStart(2, '0');
  const today = localDateString(now);
  if (!minutes) return { mode: 'scheduled', from: today, to: '', days: [], start: '', end: '' };
  const endAt = new Date(now.getTime() + minutes * 60_000);
  const sameDay = localDateString(endAt) === today;
  return {
    mode: 'scheduled',
    from: today,
    to: '',
    days: [],
    start: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    end: sameDay ? `${pad(endAt.getHours())}:${pad(endAt.getMinutes())}` : '',
  };
}

// Programació segura per a contingut nou: demà, tot el dia. Així no surt a la
// pantalla abans que se n'hagi triat el moment.
export function scheduleForTomorrow(now) {
  return { mode: 'scheduled', from: shiftIsoDate(localDateString(now), 1), to: '', days: [], start: '', end: '' };
}

// Una vista sense contingut (enllaç o text buit) no es mostra mai al quiosc.
export function viewHasContent(view) {
  if (view?.type === 'drive') return Boolean(view.driveUrl);
  if (view?.type === 'canva') return Boolean(view.canvaUrl);
  if (view?.type === 'text') return Boolean(String(view.text || '').trim());
  return Boolean(view);
}

// Vistes que toquen ara, en ordre. Una vista programada que ocupa la pantalla
// passa per davant de tot, també de la vista fixa.
export function playlistFor(views, forcedViewId, now) {
  const list = (Array.isArray(views) ? views : []).filter(viewHasContent);
  const active = list.filter((view) => isScheduleActive(view.schedule, now));
  const takeover = active.filter((view) => isScheduled(view.schedule) && view.schedule.exclusive);
  if (takeover.length) return takeover;
  const forced = list.find((view) => view.id === forcedViewId);
  if (forced) return [forced];
  if (active.length) return active;
  const fallback = list.find((view) => !isScheduled(view.schedule)) || list[0];
  return fallback ? [fallback] : [];
}
