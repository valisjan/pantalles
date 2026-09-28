import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentSlot,
  hourKeyMinutes,
  isPastHour,
  isSlotHour,
  isWeekend,
  localDateString,
  shiftIsoDate,
} from '../../src/domain/calendar.js';

const at = (time, date = '2026-09-28') => new Date(`${date}T${time}:00`);

test('desplaça dates sense errors de canvi d\'hora ni de mes', () => {
  assert.equal(shiftIsoDate('2026-09-30', 1), '2026-10-01');
  assert.equal(shiftIsoDate('2026-10-25', 1), '2026-10-26');
  assert.equal(shiftIsoDate('2026-03-01', -1), '2026-02-28');
  assert.equal(localDateString(at('23:59')), '2026-09-28');
  assert.equal(isWeekend('2026-09-26'), true);
  assert.equal(isWeekend('2026-09-28'), false);
});

test('troba la franja actual, inclòs el pati, i res fora d\'horari o en cap de setmana', () => {
  assert.equal(currentSlot(at('08:00')).label, '1a hora');
  assert.equal(currentSlot(at('10:50')).key, 'PATI');
  assert.equal(currentSlot(at('11:15')).label, '4a hora');
  assert.equal(currentSlot(at('07:59')), null);
  assert.equal(currentSlot(at('15:00')), null);
  assert.equal(currentSlot(at('09:00', '2026-09-27')), null);
});

test('relaciona les claus publicades amb la franja encara que portin zero inicial', () => {
  assert.equal(hourKeyMinutes('08:55'), 535);
  assert.equal(hourKeyMinutes('PATI'), null);
  assert.equal(isSlotHour(currentSlot(at('09:00')), '8:55'), true);
  assert.equal(isSlotHour(currentSlot(at('09:00')), '08:55'), true);
  assert.equal(isSlotHour(currentSlot(at('10:50')), 'PATI'), true);
  assert.equal(isSlotHour(currentSlot(at('10:50')), '9:50'), false);
  assert.equal(isPastHour(at('09:00'), '8:00'), true);
  assert.equal(isPastHour(at('09:00'), '8:55'), false);
  assert.equal(isPastHour(at('11:20'), 'PATI'), true);
});
