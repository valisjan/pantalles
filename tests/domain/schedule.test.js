import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeSchedule,
  isScheduleActive,
  normalizeSchedule,
  playlistFor,
  scheduleForTomorrow,
  scheduleFromNow,
  scheduleStatus,
} from '../../src/domain/schedule.js';

const at = (value) => new Date(`${value}:00`);
const scheduled = (fields) => normalizeSchedule({ mode: 'scheduled', ...fields });

test('neteja programacions incompletes o girades', () => {
  assert.deepEqual(normalizeSchedule(undefined), {
    mode: 'always', from: '', to: '', days: [], start: '', end: '', exclusive: true,
  });
  assert.deepEqual(scheduled({ from: '2026-10-03', to: '2026-10-01', start: '14:00', end: '13:00', days: [5, 1, 9, 1] }), {
    mode: 'scheduled', from: '2026-10-01', to: '2026-10-03', days: [1, 5], start: '14:00', end: '', exclusive: true,
  });
  assert.equal(scheduled({ to: '2026-10-02' }).from, '2026-10-02');
  assert.equal(scheduled({ from: '2026-10-02', to: '2026-10-02' }).to, '');
  assert.equal(scheduled({ start: '8:00' }).start, '');
});

test('una programació d\'un dia i una franja només és activa en aquella franja', () => {
  const claustre = scheduled({ from: '2026-10-01', start: '13:30', end: '14:30' });
  assert.equal(isScheduleActive(claustre, at('2026-10-01T13:29')), false);
  assert.equal(isScheduleActive(claustre, at('2026-10-01T13:30')), true);
  assert.equal(isScheduleActive(claustre, at('2026-10-01T14:30')), false);
  assert.equal(isScheduleActive(claustre, at('2026-10-02T13:45')), false);
  assert.equal(scheduleStatus(claustre, at('2026-10-01T09:00')), 'waiting');
  assert.equal(scheduleStatus(claustre, at('2026-10-01T13:45')), 'active');
  assert.equal(scheduleStatus(claustre, at('2026-10-01T15:00')), 'expired');
  assert.equal(scheduleStatus(normalizeSchedule({}), at('2026-10-01T15:00')), 'always');
});

test('les programacions setmanals es repeteixen sense data', () => {
  const patio = scheduled({ days: [1, 4], start: '10:45', end: '11:15' });
  assert.equal(isScheduleActive(patio, at('2026-10-01T10:50')), true); // dijous
  assert.equal(isScheduleActive(patio, at('2026-09-30T10:50')), false); // dimecres
  assert.equal(scheduleStatus(patio, at('2027-06-30T12:00')), 'waiting');
});

test('descriu la programació en català', () => {
  assert.equal(describeSchedule(normalizeSchedule({})), 'Sempre');
  assert.equal(describeSchedule(scheduled({ from: '2026-10-01', start: '13:30', end: '14:30' })), 'Dijous, 1 d’octubre · 13:30–14:30');
  assert.equal(describeSchedule(scheduled({ from: '2026-10-01', to: '2026-10-03' })), 'Del 1 d’octubre al 3 d’octubre · tot el dia');
  assert.equal(describeSchedule(scheduled({ days: [1, 4], start: '10:45', end: '11:15' })), 'Cada dilluns i dijous · 10:45–11:15');
  assert.equal(describeSchedule(scheduled({ days: [1, 2, 3, 4, 5], start: '08:00' })), 'De dilluns a divendres · des de les 08:00');
});

test('programa a partir d\'ara durant uns minuts o tot el dia', () => {
  assert.deepEqual(scheduleFromNow(at('2026-10-01T13:07'), 60), {
    mode: 'scheduled', from: '2026-10-01', to: '', days: [], start: '13:07', end: '14:07',
  });
  assert.equal(scheduleFromNow(at('2026-10-01T23:30'), 60).end, '');
  assert.equal(scheduleFromNow(at('2026-10-01T13:07'), 0).start, '');
});

test('decideix quines vistes s\'alternen en cada moment', () => {
  const guardies = { id: 'guardies', schedule: normalizeSchedule({}) };
  const canva = { id: 'canva', type: 'canva', canvaUrl: 'https://www.canva.com/design/A/view?embed=', schedule: normalizeSchedule({}) };
  const claustre = { id: 'claustre', schedule: scheduled({ from: '2026-10-01', start: '13:30', end: '14:30' }) };
  const menu = { id: 'menu', schedule: scheduled({ from: '2026-10-01', exclusive: false }) };
  const views = [guardies, canva, claustre, menu];
  const ids = (now, forced = '') => playlistFor(views, forced, at(now)).map((view) => view.id);

  assert.deepEqual(ids('2026-09-30T13:45'), ['guardies', 'canva']);
  assert.deepEqual(ids('2026-10-01T10:00'), ['guardies', 'canva', 'menu']);
  assert.deepEqual(ids('2026-10-01T13:45'), ['claustre']);
  assert.deepEqual(ids('2026-10-01T13:45', 'guardies'), ['claustre']);
  assert.deepEqual(ids('2026-09-30T13:45', 'canva'), ['canva']);
  assert.deepEqual(playlistFor([claustre], '', at('2026-09-30T10:00')).map((view) => view.id), ['claustre']);
  assert.deepEqual(playlistFor([], '', at('2026-09-30T10:00')), []);
});

test('el contingut nou no surt fins al seu moment i una vista buida no surt mai', () => {
  const now = at('2026-10-01T13:07');
  const draft = { id: 'draft', type: 'text', text: 'Simulacre', schedule: normalizeSchedule(scheduleForTomorrow(now)) };
  assert.equal(draft.schedule.from, '2026-10-02');
  assert.equal(isScheduleActive(draft.schedule, now), false);
  const guardies = { id: 'guardies', type: 'guardies', schedule: normalizeSchedule({}) };
  const emptyCanva = { id: 'buit', type: 'canva', canvaUrl: '', schedule: normalizeSchedule({}) };
  const emptyText = { id: 'text', type: 'text', text: '  ', schedule: normalizeSchedule({}) };
  assert.deepEqual(playlistFor([guardies, emptyCanva, emptyText, draft], '', now).map((view) => view.id), ['guardies']);
});
