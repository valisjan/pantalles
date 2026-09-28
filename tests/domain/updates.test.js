import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleFromHtml, nextDailyReload } from '../../src/domain/updates.js';

test('troba el JavaScript principal de la pàgina publicada', () => {
  const html = `<head>
    <script>document.documentElement.classList.toggle('dark', false);</script>
    <script type="module" crossorigin src="/assets/index-Ab12Cd.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-vue.js">
  </head>`;
  assert.equal(bundleFromHtml(html), '/assets/index-Ab12Cd.js');
  assert.equal(bundleFromHtml('<script src="/x.js" type="module"></script>'), '/x.js');
  assert.equal(bundleFromHtml('<script src="/legacy.js"></script>'), '');
  assert.equal(bundleFromHtml(''), '');
});

test('programa la recàrrega diària a les 6.30 següents', () => {
  const at = (value) => new Date(`${value}:00`);
  assert.deepEqual(nextDailyReload(at('2026-09-28T13:10')), at('2026-09-29T06:30'));
  assert.deepEqual(nextDailyReload(at('2026-09-28T05:00')), at('2026-09-28T06:30'));
  assert.deepEqual(nextDailyReload(at('2026-09-28T06:30')), at('2026-09-29T06:30'));
});
