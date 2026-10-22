import { expect, test } from '@playwright/test';

const publicDay = {
  schemaVersion: 1,
  courseId: 'e2e-2026',
  date: '2026-09-11',
  status: 'published',
  hours: [
    {
      key: '8:00', kind: 'guardies', label: '1a hora · 8:00',
      rows: [{
        id: '1|1|8:00', absent: 'Maria Sureda', group: '1ESO-A',
        subject: 'Llengua catalana', room: 'Aula 12', assigned: 'Pere Blanes',
        coTeacher: false, cancelled: false, comment: 'Feina a la plataforma',
      }],
    },
    { key: '8:55', kind: 'guardies', label: '2a hora · 8:55', rows: [] },
    {
      key: 'PATI', kind: 'patio', label: 'Pati · 10:45–11:15', rows: [],
      patio: {
        zones: [
          { name: 'Banys', teacher: 'Gabriel Calvo', absent: false },
          { name: 'Hall', teacher: 'Agnès Garau', absent: true },
        ],
        observation: 'Canvi puntual als banys',
      },
    },
  ],
  groupsOut: [{ id: '2ESOA', label: '2ESO-A', partial: false }],
};

async function seedScreen(page, day = publicDay) {
  await page.addInitScript(({ day }) => {
    localStorage.setItem('quota-e2e-pantalla:sala-professorat', JSON.stringify({
      schemaVersion: 1,
      name: 'Sala de professorat',
      active: true,
      courseId: 'e2e-2026',
      dateMode: 'specific',
      selectedDate: '2026-09-11',
      theme: 'light',
      scale: 100,
      modules: ['guardies', 'pati', 'sortides'],
      message: 'Claustre a les 14.00 h',
    }));
    localStorage.setItem('quota-e2e-guardies:e2e-2026', JSON.stringify({
      publicDays: { '2026-09-11': day },
    }));
  }, { day });
}

for (const theme of ['light', 'dark']) {
test(`es veuen els comentaris i les observacions de totes les hores, i s’actualitzen en directe (${theme})`, async ({ page }, testInfo) => {
  const comment = 'Primera instrucció\nSegona instrucció <material>';
  await seedScreen(page, {
    ...publicDay,
    hours: [
      { ...publicDay.hours[0], rows: [{ ...publicDay.hours[0].rows[0], comment }], observation: 'Avís de primera hora' },
      publicDay.hours[2],
      { key: '14:00', label: '7a hora · 14:00', rows: [], observation: 'Reunió a la biblioteca\nDur el material' },
    ],
  });
  await page.addInitScript((theme) => {
    const key = 'quota-e2e-pantalla:sala-professorat';
    const config = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...config, theme }));
  }, theme);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const note = page.locator('.row-comment .observation-text');
  await expect(note).toHaveText(comment);
  await expect(note).toHaveCSS('white-space', 'pre-wrap');
  await expect(note.locator('material')).toHaveCount(0);
  await note.scrollIntoViewIfNeeded();
  await expect(note).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`comments-${theme}.png`) });
  await expect(page.locator('.patio-observation')).toContainText('Canvi puntual als banys');
  await expect(page.locator('[data-hour-key="8:00"] .hour-observation')).toContainText('Avís de primera hora');
  const seventh = page.locator('[data-hour-key="14:00"]');
  await seventh.scrollIntoViewIfNeeded();
  await expect(seventh.locator('.hour-observation')).toBeVisible();
  await expect(seventh).not.toHaveClass(/empty/);
  await expect(seventh.locator('.observation-text')).toHaveText('Reunió a la biblioteca\nDur el material');

  // El doble local del listener de Firestore permet provar actualitzacions sense escriure a producció.
  for (const comment of ['Nova instrucció de cap d’estudis', '']) {
    await page.evaluate((comment) => {
      const key = 'quota-e2e-guardies:e2e-2026';
      const data = JSON.parse(localStorage.getItem(key));
      data.publicDays['2026-09-11'].hours[0].rows[0].comment = comment;
      localStorage.setItem(key, JSON.stringify(data));
      window.dispatchEvent(new StorageEvent('storage', { key }));
    }, comment);
    if (comment) await expect(note).toHaveText(comment);
    else await expect(page.locator('.row-comment')).toHaveCount(0);
  }
});
}

for (const portrait of [false, true]) {
  test(`el rellotge dels controls continua visible en desplaçar-se${portrait ? ' en vertical' : ''}`, async ({ page }, testInfo) => {
    if (portrait) await page.setViewportSize({ width: 1080, height: 1920 });
    await page.clock.setFixedTime(new Date('2026-09-11T18:30:00+02:00'));
    await seedScreen(page, {
      ...publicDay,
      hours: Array.from({ length: 8 }, (_, index) => ({
        ...publicDay.hours[0], key: `hora-${index}`, label: `${index + 1}a hora`,
        rows: Array.from({ length: 4 }, (_, row) => ({ ...publicDay.hours[0].rows[0], id: `${index}-${row}` })),
      })),
    });
    await page.goto('/?pantalla=sala-professorat&data=2026-09-11');
    const clock = page.locator('.toolbar-clock time');
    // A dalt, el rellotge és el de la capçalera: no es repeteix a la barra.
    await expect(page.locator('.live-clock-time')).toHaveText('18:30:00');
    await expect(clock).toHaveCount(0);
    await page.getByRole('button', { name: 'Augmenta el text' }).click();
    for (const fraction of [1, 0.5, 0.1]) {
      await page.evaluate((fraction) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * fraction), fraction);
      await expect(clock).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Augmenta el text' })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Dia anterior' })).toBeInViewport({ ratio: 1 });
    }
    await page.clock.setFixedTime(new Date('2026-09-11T18:30:05+02:00'));
    await expect(clock).toHaveText('18:30:05');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('sticky-clock.png') });
  });
}

test('pantalla de sala mostra la jornada publicada en vertical', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1400 });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  await expect(page.getByRole('heading', { name: 'Guàrdies del dia' })).toBeVisible();
  await expect(page.getByText(/divendres, 11 de setembre del? 2026/i)).toBeVisible();
  await expect(page.getByText('Maria Sureda')).toBeVisible();
  await expect(page.getByText('Pere Blanes')).toBeVisible();
  await expect(page.getByText('Banys', { exact: true })).toBeVisible();
  await expect(page.getByText('2ESO-A')).toBeVisible();
  await expect(page.getByText('Claustre a les 14.00 h')).toBeVisible();
  await expect(page.locator('.live-clock')).toContainText(/\d{2}:\d{2}:\d{2}/);
  await expect(page.getByRole('button', { name: '1a: 1 guàrdia' })).toHaveClass(/busy/);
  await expect(page.getByRole('button', { name: '2a: 0 guàrdies' })).toHaveClass(/clear/);

  const sizeBefore = await page.getByRole('heading', { name: 'Guàrdies del dia' }).boundingBox();
  await page.getByRole('button', { name: 'Augmenta el text' }).click();
  await expect(page.getByRole('button', { name: '110%' })).toBeVisible();
  const sizeAfter = await page.getByRole('heading', { name: 'Guàrdies del dia' }).boundingBox();
  expect(sizeAfter.height).toBeGreaterThan(sizeBefore.height * 1.05);
});

test('la pantalla destaca i actualitza la sessió actual', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T08:30:00+02:00'));
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');

  await expect(page.locator('.hour-card.current-session')).toContainText('1a hora');
  await expect(page.locator('.hour-card.current-session')).toContainText('Ara');

  await page.clock.setFixedTime(new Date('2026-09-11T08:56:00+02:00'));
  await page.waitForTimeout(1_100);
  await expect(page.locator('.hour-card.current-session')).toContainText('2a hora');
});

test('la pantalla identifica el cap de setmana com a dia no lectiu', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-12');

  await expect(page.getByText('Dia no lectiu', { exact: true })).toBeVisible();
  await expect(page.getByText(/encara no té accés/i)).toHaveCount(0);
});

test('administració de pantalla desa els canvis sense botó', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat');

  await page.getByRole('tab', { name: 'Aparença' }).click();
  const name = page.getByLabel('Nom de la pantalla');
  await expect(name).toHaveValue('Sala de professorat');
  await name.fill('Sala gran');
  await expect(page.getByText('Desant…')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(localStorage.getItem('quota-e2e-pantalla:sala-professorat')).name
  ))).toBe('Sala gran');
});

test('administració crea i configura una segona vista', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat');

  await expect(page.getByLabel('Reproducció')).toHaveCount(0);
  await expect(page.getByLabel('Durada')).toHaveCount(0);
  await page.getByRole('button', { name: '+ Nova vista' }).click();
  await page.locator('.view-type-picker').getByRole('button', { name: /Guàrdies/ }).click();
  await expect(page.getByLabel('Reproducció')).toBeVisible();
  await expect(page.getByLabel('Durada')).toBeVisible();
  await page.getByLabel('Nom de la vista').fill('Només pati');
  await page.getByLabel('Durada').selectOption('30');

  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('quota-e2e-pantalla:sala-professorat'));
    return value.views?.find((view) => view.name === 'Només pati') || null;
  })).toMatchObject({ duration: 30, modules: ['guardies', 'pati', 'sortides'] });
});

test('administració accepta el codi d’inserció de Canva', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat');

  await page.getByRole('button', { name: '+ Nova vista' }).click();
  await page.locator('.view-type-picker').getByRole('button', { name: /Canva/ }).click();
  const input = page.getByLabel('Enllaç o codi d’inserció');
  await input.fill('<iframe src="https://www.canva.com/design/ABC/view"></iframe>');
  await input.press('Tab');

  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('quota-e2e-pantalla:sala-professorat'));
    return value.views?.find((view) => view.type === 'canva')?.canvaUrl || '';
  })).toContain('canva.com/design/ABC/view?embed=');
});

test('administració converteix un enllaç compartit de Drive en una vista', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat');

  await page.getByRole('button', { name: '+ Nova vista' }).click();
  await page.locator('.view-type-picker').getByRole('button', { name: /Google Drive/ }).click();
  const input = page.getByLabel('Enllaç de Drive');
  await input.fill('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing');
  await input.press('Tab');

  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('quota-e2e-pantalla:sala-professorat'));
    return value.views?.find((view) => view.type === 'drive')?.driveUrl || '';
  })).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/preview');
});

test('cada cobertura mostra el mateix estat que el full de guàrdies', async ({ page }) => {
  const row = (id, fields) => ({
    id, absent: `Docent ${id}`, group: '1ESO-F', subject: 'MAT-F-1E', room: 'Aula 6',
    assigned: '', coTeacher: false, cancelled: false, comment: '', ...fields,
  });
  await seedScreen(page, {
    ...publicDay,
    hours: [{
      key: '11:15', kind: 'guardies', label: '4a hora · 11:15',
      rows: [
        row('A', {}),
        row('B', { assigned: 'Pere Blanes', source: 'guard' }),
        row('G', { assigned: 'Aina Roig', source: 'released' }),
        row('C', { assigned: 'Joana Mas', coTeacher: true }),
        row('D', { group: '1ESO-E + 1ESO-F', subject: 'MAT-EF-1E', returnsToGroup: true }),
        row('E', { group: 'Guàrdia', subject: 'Guàrdia', room: '' }),
        row('F', { assigned: 'Llucia Pons', cancelled: true }),
      ],
    }],
  });
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const rows = page.locator('.guard-row');
  await expect(rows.filter({ hasText: 'Docent A' })).toHaveClass(/status-open/);
  await expect(rows.filter({ hasText: 'Docent A' })).toContainText('Pendent');
  await expect(rows.filter({ hasText: 'Docent B' })).toHaveClass(/status-covered/);
  // Guàrdia, codocència i alliberat es distingeixen per l'etiqueta i el color.
  await expect(rows.filter({ hasText: 'Docent B' })).toHaveClass(/role-guard/);
  await expect(rows.filter({ hasText: 'Docent B' }).locator('.status-label')).toHaveText('Guàrdia');
  await expect(rows.filter({ hasText: 'Docent B' }).locator('.source-mark.is-guard')).toHaveText('G');
  await expect(rows.filter({ hasText: 'Docent C' }).locator('.status-label')).toHaveText('Queden amb');
  await expect(rows.filter({ hasText: 'Docent G' }).locator('.status-label')).toHaveText('Alliberat/ada');
  await expect(rows.filter({ hasText: 'Docent C' }).locator('.source-mark')).toHaveCount(0);
  await expect(rows.filter({ hasText: 'Docent G' }).locator('.source-mark')).toHaveCount(0);
  await expect(rows.filter({ hasText: 'Docent D' })).toContainText('Torna al seu grup');
  await expect(rows.filter({ hasText: 'Docent D' })).toContainText('Sense substitució');
  await expect(rows.filter({ hasText: 'Docent E' })).toHaveClass(/status-info/);
  await expect(rows.filter({ hasText: 'Docent F' })).toContainText('No realitzada');

  // Només la A, la B i la G demanen algú que faci la guàrdia; la A encara no té ningú.
  await expect(page.getByRole('button', { name: '4a: 3 guàrdies, 1 sense cobrir' })).toHaveClass(/pending/);
  await expect(page.getByRole('button', { name: '4a: 3 guàrdies, 1 sense cobrir' }).locator('.counter-count')).toHaveText('3 G');
  await expect(page.locator('.kiosk-kpi.is-open')).toContainText('1guàrdia sense cobrir');
});

test('el quiosc passa sol al dia següent a mitjanit', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-10T23:59:30+02:00') });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');

  await expect(page.getByText("No s'ha publicat el full de guàrdies d'aquest dia")).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(page.getByText('Maria Sureda')).toBeVisible();
});

test('la gestió mostra la barra comuna i la vista prèvia de la vista que s\'edita', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat&data=2026-09-11');

  await expect(page.locator('.app-nav .brand-title')).toHaveText('Pantalles');
  await page.getByRole('button', { name: 'Apps' }).click();
  await expect(page.locator('.apps-popover')).toContainText('Guàrdies');
  await expect(page.locator('.management-preview')).toContainText('Maria Sureda');
  await page.getByRole('tab', { name: 'Avís' }).click();
  await page.getByLabel('Avís a la pantalla').fill('Simulacre a les 12.00 h');
  await expect(page.locator('.management-preview .screen-message')).toHaveText('Simulacre a les 12.00 h');
});

async function seedViews(page, views) {
  await page.addInitScript(({ day, views }) => {
    localStorage.setItem('quota-e2e-pantalla:sala-professorat', JSON.stringify({
      schemaVersion: 1, name: 'Sala de professorat', active: true, courseId: 'e2e-2026', theme: 'light', scale: 100, views,
    }));
    localStorage.setItem('quota-e2e-guardies:e2e-2026', JSON.stringify({ publicDays: { '2026-09-11': day } }));
  }, { day: publicDay, views });
}

const guardiesView = { id: 'guardies', name: 'Guàrdies del dia', type: 'guardies', duration: 10 };

test('un anunci programat ocupa la pantalla només durant la seva franja', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T13:45:00+02:00'));
  await seedViews(page, [guardiesView, {
    id: 'claustre', name: 'Claustre', type: 'text', text: 'Claustre a la biblioteca a les 14.00 h',
    schedule: { mode: 'scheduled', from: '2026-09-11', start: '13:30', end: '14:30', exclusive: true },
  }]);
  await page.goto('/?pantalla=sala-professorat');

  await expect(page.locator('.notice-view')).toHaveText('Claustre a la biblioteca a les 14.00 h');
  await expect(page.getByRole('heading', { name: 'Claustre' })).toBeVisible();
  await expect(page.locator('.view-switcher')).toHaveCount(0);

  await page.clock.setFixedTime(new Date('2026-09-11T14:31:00+02:00'));
  await expect(page.getByRole('heading', { name: 'Guàrdies del dia' })).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('.notice-view')).toHaveCount(0);
});

test('tocar la pantalla atura la rotació fins que ningú no la fa servir', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-11T09:00:00+02:00') });
  await seedViews(page, [guardiesView, { id: 'avis', name: 'Benvinguda', type: 'text', text: 'Benvinguts', duration: 10 }]);
  await page.goto('/?pantalla=sala-professorat');

  const active = page.locator('.view-switcher button.active');
  await expect(active).toHaveText('Guàrdies del dia');
  await page.clock.runFor(10_500);
  await expect(active).toHaveText('Benvinguda');

  await page.locator('.view-switcher').getByRole('tab', { name: 'Guàrdies del dia' }).click();
  await page.clock.runFor(60_000);
  await expect(active).toHaveText('Guàrdies del dia');

  // Passats 90 s sense tocar-la, torna a alternar les vistes sola.
  await page.clock.runFor(40_000);
  const before = await active.textContent();
  await page.clock.runFor(10_500);
  await expect(active).not.toHaveText(before);
});

test('avisa quan es mira un altre dia i hi torna amb un toc', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T09:00:00+02:00'));
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');

  await expect(page.locator('.other-day')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dia següent' }).click();
  await expect(page.locator('.other-day')).toContainText('dissabte, 12 de setembre');
  await page.locator('.other-day').getByRole('button', { name: 'Torna a avui' }).click();
  await expect(page.locator('.other-day')).toHaveCount(0);
  await expect(page.getByText('Maria Sureda')).toBeVisible();
});

test('en una pantalla vertical les hores surten a dalt, com a la vista prèvia de la gestió', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  // Amb poques guàrdies (no cal desplaçar-se), la barra no baixa a mitja pantalla.
  const toolbar = await page.locator('.kiosk-toolbar').boundingBox();
  const summary = await page.locator('.kiosk-summary').boundingBox();
  const firstHour = await page.locator('.day-content > .hour-card').first().boundingBox();
  expect(toolbar.y).toBeGreaterThan(summary.y + summary.height - 1);
  expect(toolbar.y + toolbar.height).toBeLessThan(firstHour.y + 1);

  // I es queda a dalt mentre es baixa pel full.
  await page.locator('.kiosk').evaluate((element) => {
    element.querySelector('.day-content').style.minHeight = '4000px';
    window.scrollTo(0, 1500);
  });
  await expect.poll(async () => (await page.locator('.kiosk-toolbar').boundingBox()).y).toBeLessThan(40);
});

test('cada hora diu quantes guàrdies queden sense cobrir i les hores buides són discretes', async ({ page }) => {
  await seedScreen(page, {
    ...publicDay,
    hours: [
      { ...publicDay.hours[0], rows: [publicDay.hours[0].rows[0], { ...publicDay.hours[0].rows[0], id: '1|1|8:00|b', assigned: '' }] },
      publicDay.hours[1],
    ],
  });
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const busy = page.locator('.hour-card[data-hour-key="8:00"]');
  await expect(busy.locator('.session-pending')).toHaveText('1 sense cobrir');
  await expect(busy.locator('.session-meta')).toContainText('2 absències');
  const empty = page.locator('.hour-card[data-hour-key="8:55"]');
  await expect(empty).toHaveClass(/empty/);
  await expect(empty.locator('.session-pending')).toHaveCount(0);
  expect(await empty.evaluate((element) => getComputedStyle(element).borderStyle)).toBe('dashed');
});

test('la gestió programa un anunci per ara amb un sol toc', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T10:05:00+02:00'));
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat');

  await page.getByRole('button', { name: '+ Nova vista' }).click();
  await page.locator('.view-type-picker').getByRole('button', { name: /Anunci/ }).click();
  await page.getByLabel('Text de l’anunci').fill('Simulacre a les 12.00 h');
  // El contingut nou queda per a demà fins que se'n tria el moment.
  await expect(page.locator('.schedule-summary')).toContainText('Programada');
  await page.getByRole('button', { name: 'Ara · 1 hora' }).click();
  await expect(page.locator('.schedule-summary')).toContainText('Ara en pantalla');
  await expect(page.locator('.schedule-summary')).toContainText('10:05–11:05');

  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(localStorage.getItem('quota-e2e-pantalla:sala-professorat')).views?.find((view) => view.type === 'text') || null
  ))).toMatchObject({
    text: 'Simulacre a les 12.00 h',
    schedule: { mode: 'scheduled', from: '2026-09-11', start: '10:05', end: '11:05', exclusive: true },
  });
});

test('les franges horàries van sempre una sota l\'altra i a tota l\'amplada', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const cards = page.locator('.day-content > .hour-card');
  await expect(cards).toHaveCount(4);
  const boxes = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
  const content = await page.locator('.day-content').evaluate((element) => element.getBoundingClientRect().width);
  boxes.forEach((box, index) => {
    expect(Math.abs(box.width - content)).toBeLessThan(2);
    if (index) expect(box.top).toBeGreaterThan(boxes[index - 1].bottom - 1);
  });
});

test('mantenir premut el rellotge 3 segons recarrega el quiosc', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');
  const clock = page.locator('.live-clock');

  // Deixar-lo anar abans d'hora no fa res.
  await clock.dispatchEvent('pointerdown');
  await expect(clock).toHaveClass(/is-holding/);
  await expect(clock).toContainText('Mantén premut');
  await clock.dispatchEvent('pointerup');
  await expect(clock).not.toHaveClass(/is-holding/);

  const reloaded = page.waitForEvent('load', { timeout: 8_000 });
  await clock.dispatchEvent('pointerdown');
  await reloaded;
});

test('es recarrega sol quan es publica una versió nova, una sola vegada', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-11T10:00:00+02:00') });
  let checks = 0;
  await page.route((url) => url.pathname === '/', async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    checks += 1;
    return route.fulfill({ contentType: 'text/html', body: '<script type="module" crossorigin src="/assets/index-nova.js"></script>' });
  });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');
  await expect(page.getByText('Maria Sureda')).toBeVisible();

  const reloaded = page.waitForEvent('load');
  await page.clock.runFor(5 * 60_000 + 1_000);
  await reloaded;
  await expect(page.getByText('Maria Sureda')).toBeVisible();

  // El servidor encara diu que hi ha la mateixa versió nova: no torna a recarregar.
  let reloadedAgain = false;
  page.once('load', () => { reloadedAgain = true; });
  await page.clock.runFor(5 * 60_000 + 1_000);
  await expect.poll(() => checks).toBeGreaterThan(1);
  await page.waitForTimeout(500);
  expect(reloadedAgain).toBe(false);
});

test('es recarrega cada dia a les 6.30', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-11T06:29:30+02:00') });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');
  await expect(page.getByText('Maria Sureda')).toBeVisible();

  const reloaded = page.waitForEvent('load');
  await page.clock.runFor(61_000);
  await reloaded;
});
