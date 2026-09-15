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

async function seedScreen(page) {
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
  }, { day: publicDay });
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

  await page.getByRole('button', { name: 'Aparença' }).click();
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
