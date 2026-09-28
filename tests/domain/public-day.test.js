import test from 'node:test';
import assert from 'node:assert/strict';
import { daySummary, hourSummary, rowCoverText, rowSourceMark, rowStatus, shortHourLabel } from '../../src/domain/publicDay.js';
import { normalizeCanvaUrl, normalizeDriveUrl } from '../../src/domain/embeds.js';

const rows = {
  open: { assigned: '' },
  covered: { assigned: 'Pere Blanes' },
  coteacher: { assigned: 'Joana Mas', coTeacher: true },
  returns: { assigned: '', returnsToGroup: true },
  notDone: { assigned: 'Pere Blanes', cancelled: true },
  info: { group: 'Guàrdia', assigned: '' },
};

test('interpreta cada fila amb els mateixos estats que el full de guàrdies', () => {
  assert.equal(rowStatus(rows.open), 'open');
  assert.equal(rowStatus(rows.covered), 'covered');
  assert.equal(rowStatus(rows.coteacher), 'coteacher');
  assert.equal(rowStatus(rows.returns), 'returns');
  assert.equal(rowStatus(rows.notDone), 'not-done');
  assert.equal(rowStatus(rows.info), 'info');
  assert.equal(rowCoverText(rows.returns), 'Sense substitució');
  assert.equal(rowCoverText(rows.info), 'Sense substitució');
  assert.equal(rowCoverText(rows.open), 'Pendent');
  assert.equal(rowCoverText(rows.covered), 'Pere Blanes');
});

test('només compta com a guàrdia el que algú ha de cobrir', () => {
  const hour = { key: '8:00', rows: Object.values(rows) };
  assert.deepEqual(hourSummary(hour), { absences: 6, guards: 2, open: 1 });
  assert.deepEqual(hourSummary({ key: 'PATI', kind: 'patio', rows: [rows.open] }), { absences: 0, guards: 0, open: 0 });
  assert.deepEqual(daySummary({ hours: [hour, { key: '8:55', rows: [rows.open] }], groupsOut: [{ id: '1' }] }), {
    absences: 7, guards: 3, open: 2, outings: 1,
  });
  assert.deepEqual(daySummary(null), { absences: 0, guards: 0, open: 0, outings: 0 });
  assert.equal(shortHourLabel({ label: '4a hora · 11:15' }, 3), '4a');
  assert.equal(shortHourLabel({ key: 'PATI' }, 3), 'Pati');
});

test('converteix enllaços de Drive i Canva en adreces inseribles', () => {
  assert.equal(normalizeDriveUrl('https://drive.google.com/file/d/1AbC/view?usp=sharing'), 'https://drive.google.com/file/d/1AbC/preview');
  assert.match(normalizeDriveUrl('https://docs.google.com/presentation/d/XYZ/edit'), /presentation\/d\/XYZ\/embed\?start=true/);
  assert.equal(normalizeDriveUrl('https://example.com/file/d/1AbC/view'), '');
  assert.match(normalizeCanvaUrl('<iframe src="https://www.canva.com/design/ABC/view"></iframe>'), /canva\.com\/design\/ABC\/view\?embed=/);
  assert.equal(normalizeCanvaUrl('http://www.canva.com/design/ABC/view'), '');
});

test('distingeix el professorat de guàrdia (G) del professorat alliberat', () => {
  assert.equal(rowSourceMark({ assigned: 'Pere', source: 'guard' }), 'guard');
  assert.equal(rowSourceMark({ assigned: 'Joana', source: 'released' }), 'released');
  assert.equal(rowSourceMark({ assigned: 'Llucia', source: 'co-teacher', coTeacher: true }), '');
  assert.equal(rowSourceMark({ assigned: 'Pere', source: 'guard', cancelled: true }), '');
  assert.equal(rowSourceMark({ assigned: '', source: '' }), '');
  // Jornades publicades abans d'afegir l'origen: sense marca.
  assert.equal(rowSourceMark({ assigned: 'Pere' }), '');
});
