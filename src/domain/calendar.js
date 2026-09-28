// Dates i horari de timbres del centre. Mòdul pur: no depèn de Vue ni del DOM.

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const value = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${value}`;
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function dateAtNoon(value) {
  const [year, month, date] = String(value).split('-').map(Number);
  return new Date(year, month - 1, date, 12);
}

export function shiftIsoDate(value, amount) {
  const next = dateAtNoon(value);
  next.setDate(next.getDate() + amount);
  return localDateString(next);
}

export function isWeekend(value) {
  const weekday = dateAtNoon(value).getDay();
  return weekday === 0 || weekday === 6;
}

// "Dilluns, 28 de setembre del 2026": majúscula només a l'inici.
export function formatLongDate(value) {
  const text = new Intl.DateTimeFormat('ca-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(dateAtNoon(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatClock(date) {
  return new Intl.DateTimeFormat('ca-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

// Franges del full de guàrdies: la clau coincideix amb la de cada hora publicada.
export const BELL_SCHEDULE = Object.freeze([
  { key: '8:00', label: '1a hora', start: 480, end: 535 },
  { key: '8:55', label: '2a hora', start: 535, end: 590 },
  { key: '9:50', label: '3a hora', start: 590, end: 645 },
  { key: 'PATI', label: 'Pati', start: 645, end: 675 },
  { key: '11:15', label: '4a hora', start: 675, end: 730 },
  { key: '12:10', label: '5a hora', start: 730, end: 785 },
  { key: '13:05', label: '6a hora', start: 785, end: 840 },
  { key: '14:00', label: '7a hora', start: 840, end: 900 },
]);

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function currentSlot(now) {
  if (now.getDay() === 0 || now.getDay() === 6) return null;
  const minutes = minutesOf(now);
  return BELL_SCHEDULE.find((slot) => minutes >= slot.start && minutes < slot.end) || null;
}

// Minuts d'inici d'una clau d'hora ("8:00", "08:00"...). El pati no en té.
export function hourKeyMinutes(key) {
  const match = String(key || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isSlotHour(slot, hourKey) {
  if (!slot) return false;
  if (slot.key === 'PATI' || hourKey === 'PATI') return slot.key === hourKey;
  return hourKeyMinutes(hourKey) === slot.start;
}

// Una hora ja acabada: serveix per atenuar-la i deixar pas a la resta del dia.
export function isPastHour(now, hourKey) {
  const slot = hourKey === 'PATI'
    ? BELL_SCHEDULE.find((item) => item.key === 'PATI')
    : BELL_SCHEDULE.find((item) => item.start === hourKeyMinutes(hourKey));
  return Boolean(slot) && minutesOf(now) >= slot.end;
}
