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
  groupsOut: [{ id: '2ESOA', label: '2ESO-A', partial: false, from: '8:00', to: '14:00' }],
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
    for (const fraction of [1, 0.5, 0.1]) {
      await page.evaluate((fraction) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * fraction), fraction);
      await expect(clock).toBeInViewport({ ratio: 1 });
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
  const outings = page.locator('.kiosk-outings');
  await expect(outings).toContainText('Sortides complementàries:');
  await expect(outings.locator('[data-outing-group="2ESOA"]')).toHaveText('2ESO-A de 8:00 a 14:00');
  await expect(page.getByText(/grups? fora/)).toHaveCount(0);
  await expect(page.getByText('Claustre a les 14.00 h')).toBeVisible();
  await expect(page.locator('.live-clock')).toContainText(/\d{2}:\d{2}:\d{2}/);
  await expect(page.getByRole('button', { name: '1a: 1 guàrdia' })).toHaveClass(/busy/);
  await expect(page.getByRole('button', { name: '2a: 0 guàrdies' })).toHaveClass(/clear/);

  // Pantalla tàctil: ni botó «Avui» ni controls de mida del text a la barra.
  const toolbar = page.locator('.kiosk-toolbar');
  await expect(toolbar.getByRole('button', { name: 'Avui', exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: 'Augmenta el text' })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: 'Redueix el text' })).toHaveCount(0);
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
  // L'hora acabada es continua llegint: només la capçalera indica que ja ha passat.
  const past = page.locator('.hour-card.past[data-hour-key="8:00"]');
  await expect(past).toHaveCSS('opacity', '0.9');
  await expect(page.locator('.session-legend')).toHaveText(/sense guàrdies\s*cobertes\s*en falten/);
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
  await expect(rows.filter({ hasText: 'Docent C' }).locator('.status-label')).toHaveText('Queden amb');
  await expect(rows.filter({ hasText: 'Docent G' }).locator('.status-label')).toHaveText('Alliberat/ada');
  // L'etiqueta ja diu «Guàrdia»: el nom no porta cap G al costat.
  await expect(rows.filter({ hasText: 'Docent B' }).locator('.assigned-person strong')).toHaveText('Pere Blanes');
  await expect(rows.filter({ hasText: 'Docent D' })).toContainText('Torna al seu grup');
  await expect(rows.filter({ hasText: 'Docent D' })).toContainText('Sense substitució');
  await expect(rows.filter({ hasText: 'Docent E' })).toHaveClass(/status-info/);
  await expect(rows.filter({ hasText: 'Docent F' })).toContainText('No realitzada');

  // Només la A, la B i la G demanen algú que faci la guàrdia; la A encara no té ningú.
  await expect(page.getByRole('button', { name: '4a: 3 guàrdies, 1 sense cobrir' })).toHaveClass(/pending/);
  await expect(page.getByRole('button', { name: '4a: 3 guàrdies, 1 sense cobrir' }).locator('.counter-count')).toHaveText('3');
  await expect(page.locator('.kiosk-kpi.is-open')).toContainText('1guàrdia sense cobrir');
});

test('el quiosc passa sol al dia següent a mitjanit', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-10T23:59:30+02:00') });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');

  // A la nit ja es veu el full de demà, amb l'avís; a mitjanit passa a ser el d'avui.
  await expect(page.locator('.kiosk-banner.next-day')).toContainText('de demà');
  await expect(page.getByText('Maria Sureda')).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(page.locator('.kiosk-banner.next-day')).toHaveCount(0);
  await expect(page.getByText('Maria Sureda')).toBeVisible();
});

test('a la tarda mostra el full de demà si ja està publicat, i si no, el d’avui', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-10T14:59:00+02:00') });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');
  await expect(page.getByText("No s'ha publicat el full de guàrdies d'aquest dia")).toBeVisible();

  await page.clock.runFor(60_000);
  await expect(page.locator('.kiosk-banner.next-day')).toHaveText('Avui ja no hi ha classes: es mostra el full de demà');
  await expect(page.getByText('Maria Sureda')).toBeVisible();
  await expect(page.locator('.kiosk-date')).toContainText('11 de setembre');
  // La fletxa enrere torna al full d'avui.
  await page.locator('.kiosk-toolbar').getByRole('button', { name: 'Dia anterior' }).click();
  await expect(page.getByText("No s'ha publicat el full de guàrdies d'aquest dia")).toBeVisible();
});

test('si el full de demà encara no és publicat, a la tarda es continua veient el d’avui', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T16:00:00+02:00'));
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');
  await expect(page.getByText('Maria Sureda')).toBeVisible();
  await expect(page.locator('.kiosk-banner.next-day')).toHaveCount(0);
  await expect(page.locator('.kiosk-date')).toContainText('11 de setembre');
});

test('la gestió mostra la barra comuna i la vista prèvia de la vista que s\'edita', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat&data=2026-09-11');

  await expect(page.locator('.app-nav .brand-title')).toHaveText('Pantalles');
  await page.getByRole('button', { name: 'Apps' }).click();
  await expect(page.locator('.apps-popover')).toContainText('Guàrdies');
  const preview = page.frameLocator('.management-preview iframe');
  await expect(preview.locator('.day-content')).toContainText('Maria Sureda');
  // El text es veu a la vista prèvia mentre s'escriu, abans i tot de desar-lo.
  await page.getByRole('tab', { name: 'Avís' }).click();
  await page.getByLabel('Avís a la pantalla').fill('Simulacre a les 12.00 h');
  await expect(preview.locator('.screen-message')).toHaveText('Simulacre a les 12.00 h');
});

test('la vista prèvia de la gestió té la proporció de la pantalla real', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?gestio=1&pantalla=sala-professorat&data=2026-09-11');

  const device = page.locator('.preview-device');
  const ratio = async () => {
    const box = await device.boundingBox();
    return (box.width - 16) / (box.height - 16);
  };
  // Per defecte, vertical: com el televisor de la sala.
  await expect(page.getByRole('button', { name: 'Vertical' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(ratio).toBeCloseTo(1080 / 1920, 2);
  const frame = page.frameLocator('.management-preview iframe');
  await expect(frame.locator('.day-content')).toContainText('Maria Sureda');
  expect(await frame.locator('html').evaluate(() => matchMedia('(orientation: portrait)').matches)).toBe(true);

  await page.getByRole('button', { name: 'Horitzontal' }).click();
  await expect.poll(ratio).toBeCloseTo(1920 / 1080, 2);
  expect(await frame.locator('html').evaluate(() => innerWidth)).toBe(1920);

  // Es recorda per a la propera vegada.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Horitzontal' })).toHaveAttribute('aria-pressed', 'true');
});

test('la barra fixa tapa el full de banda a banda', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedScreen(page, {
    ...publicDay,
    hours: Array.from({ length: 6 }, (_, index) => ({
      ...publicDay.hours[0], key: `hora-${index}`, label: `${index + 1}a hora`,
      rows: Array.from({ length: 3 }, (_, row) => ({ ...publicDay.hours[0].rows[0], id: `${index}-${row}` })),
    })),
  });
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');
  const toolbar = page.locator('.kiosk-toolbar');
  await expect(toolbar).not.toHaveClass(/is-stuck/);

  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(toolbar).toHaveClass(/is-stuck/);
  const box = await toolbar.boundingBox();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(box.y).toBeLessThan(1);
  expect(box.x).toBeLessThan(1);
  expect(box.width).toBeGreaterThan(width - 2);
  const colors = await page.evaluate(() => [
    getComputedStyle(document.querySelector('.kiosk-toolbar')).backgroundColor,
    getComputedStyle(document.querySelector('.kiosk')).backgroundColor,
  ]);
  expect(colors[0]).toBe(colors[1]);
});

test('en un televisor apaïsat la lletra de les files és més gran', async ({ page }) => {
  const size = async (selector) => page.locator(selector).first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  await seedScreen(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');
  expect(await size('.guard-row .absent-person strong')).toBe(22);
  expect(await size('.zone-teacher')).toBe(22);

  await page.setViewportSize({ width: 1080, height: 1920 });
  expect(await size('.guard-row .absent-person strong')).toBe(17);
});

test('cada hora té la franja com a títol i al pati destaca qui hi ha', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const first = page.locator('.hour-card[data-hour-key="8:00"]');
  await expect(first.locator('.hour-badge')).toHaveText('1a');
  await expect(first.locator('h2')).toHaveText('1a hora, 8:00 – 8:55');
  await expect(first.getByRole('heading', { name: '1a hora, 8:00 – 8:55' })).toBeVisible();
  expect(await first.locator('h2 .visually-hidden').evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(2);

  // Les dues zones omplen tota l'amplada del pati.
  const zones = await page.locator('.patio-zone').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  const grid = await page.locator('.patio-grid').evaluate((element) => element.clientWidth - 24);
  expect(zones).toHaveLength(2);
  expect(Math.abs(zones[0] + zones[1] + 8 - grid)).toBeLessThan(2);
  await expect(page.locator('.patio-zone').first().locator('.zone-teacher')).toHaveText('Gabriel Calvo');
});

test('quan no queda cap guàrdia sense cobrir, el resum ho diu', async ({ page }) => {
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const kpi = page.locator('.kiosk-kpi').first();
  await expect(kpi).toHaveClass(/is-covered/);
  await expect(kpi).toHaveText('totes cobertes');
  await expect(kpi.locator('.kpi-check')).toBeVisible();
});

test('un dia sense full fa de rellotge i el peu queda a baix', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-09-14T07:45:00+02:00'));
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat');

  await expect(page.getByText("No s'ha publicat el full de guàrdies d'aquest dia")).toBeVisible();
  await expect(page.locator('.no-day-clock')).toHaveText('07:45');
  const footer = await page.locator('.kiosk-footer').boundingBox();
  expect(footer.y + footer.height).toBeGreaterThan(1080 - 40);
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
    id: 'claustre', name: 'Claustre', type: 'text', text: 'Claustre a la biblioteca a les 14.00 h', tone: 'urgent',
    schedule: { mode: 'scheduled', from: '2026-09-11', start: '13:30', end: '14:30', exclusive: true },
  }]);
  await page.goto('/?pantalla=sala-professorat');

  await expect(page.locator('.notice-view p')).toHaveText('Claustre a la biblioteca a les 14.00 h');
  await expect(page.locator('.notice-view')).toHaveClass(/tone-urgent/);
  await expect(page.locator('.notice-view')).toHaveClass(/is-short/);
  await expect(page.locator('.notice-tone')).toHaveText('Urgent');
  await expect(page.locator('.notice-until')).toHaveText('Fins a les 14:30');
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

test('el botó Avui de la barra torna al dia d’avui, també amb la barra fixa', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.clock.setFixedTime(new Date('2026-09-11T09:00:00+02:00'));
  await seedScreen(page, {
    ...publicDay,
    hours: Array.from({ length: 8 }, (_, index) => ({
      ...publicDay.hours[0], key: `hora-${index}`, label: `${index + 1}a hora`,
      rows: Array.from({ length: 4 }, (_, row) => ({ ...publicDay.hours[0].rows[0], id: `${index}-${row}` })),
    })),
  });
  await page.goto('/?pantalla=sala-professorat');
  const toolbar = page.locator('.kiosk-toolbar');

  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(toolbar).toHaveClass(/is-stuck/);
  await toolbar.getByRole('button', { name: 'Dia següent' }).click();
  await expect(page.locator('.other-day')).toContainText('dissabte, 12 de setembre');
  await page.locator('.other-day').getByRole('button', { name: 'Torna a avui' }).click();
  await expect(page.locator('.other-day')).toHaveCount(0);
  await expect(page.getByText('Maria Sureda').first()).toBeVisible();
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
  await page.getByRole('button', { name: 'Important', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Important', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(localStorage.getItem('quota-e2e-pantalla:sala-professorat')).views?.find((view) => view.type === 'text') || null
  ))).toMatchObject({
    text: 'Simulacre a les 12.00 h',
    tone: 'important',
    schedule: { mode: 'scheduled', from: '2026-09-11', start: '10:05', end: '11:05', exclusive: true },
  });
});

test('les franges horàries van sempre una sota l\'altra i a tota l\'amplada', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedScreen(page);
  await page.goto('/?pantalla=sala-professorat&data=2026-09-11');

  const cards = page.locator('.day-content > .hour-card');
  await expect(cards).toHaveCount(3);
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
