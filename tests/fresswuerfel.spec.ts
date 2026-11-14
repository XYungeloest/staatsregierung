import sharp from 'sharp';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, createWriteStream, readFileSync, rmSync } from 'node:fs';
const path = '/themen/fresswuerfel-maskottchen/';
const testConfig = '.cache/fresswuerfel/wrangler-test.json';
let savedNumber = '';
const publicFile = '.cache/fresswuerfel/freigabe-test.json';
test.beforeAll(() => {
  rmSync(publicFile, { force: true });
  execFileSync('node_modules/.bin/wrangler', ['d1', 'execute', 'FRESSWUERFEL_DB', '--local', '--config', testConfig, '--persist-to', '.cache/fresswuerfel/test-state', '--command', 'DELETE FROM submissions; DELETE FROM rate_limits;'], { encoding: 'utf8' });
});

test('Desktop und Mobil: echte Speicherung, Tastatur, Validierung und private URLs', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  const necessary = page.getByRole('button', { name: 'Nur notwendige Funktionen nutzen' });
  if (await necessary.isVisible()) await necessary.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wie soll das Fresswürfel-Maskottchen aussehen?');
  await page.getByRole('link', { name: 'Idee einreichen' }).click();
  await page.keyboard.press('Tab');
  await expect(page.locator('#figure-name')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#figure-description')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#figure-sketch')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#figure-email')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#figure-consent')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('.campaign-consent a[href="#teilnahme"]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('.campaign-consent a[href="#datenschutz"]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Idee einreichen', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#description-error')).toContainText('mindestens 20');
  await expect(page.locator('#figure-description')).toBeFocused();
  await page.locator('#figure-name').fill('Interner Probename');
  await page.locator('#figure-description').fill('PRIVATE ORIGINALBESCHREIBUNG: Ein Würfelhut und freundliche Hände als synthetische Probe.');
  await page.locator('#figure-email').fill('streng-intern@example.org');
  await page.locator('#figure-consent').check();
  const pending = page.waitForResponse(r => r.url().endsWith('/api/fresswuerfel/einreichungen') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Idee einreichen', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(201);
  const payload = await response.json(); savedNumber = payload.number;
  expect(Object.keys(payload)).toEqual(['number']);
  await expect(page.locator('#form-status')).toContainText(savedNumber);
  await expect(page.locator('#form-status')).toBeFocused();
  const repeated = await request.post('/api/fresswuerfel/einreichungen', { headers: { Origin: 'http://127.0.0.1:4340', 'Content-Type': response.request().headers()['content-type'] }, data: response.request().postDataBuffer()! });
  expect((await repeated.json()).number).toBe(savedNumber);
  for (const url of ['/api/fresswuerfel/einreichungen', `/api/fresswuerfel/einreichungen/${savedNumber}`, '/content/kampagnen/fresswuerfel.json', '/.cache/fresswuerfel/state/', '/data/fresswuerfel/', '/uploads/private.png']) {
    const reply = await request.get(url); expect(reply.status()).toBeGreaterThanOrEqual(400); expect(await reply.text()).not.toContain('streng-intern@example.org');
  }
  await page.goto(path);
  await expect(page.locator('input[type=file]')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  mkdirSync('test-results/fresswuerfel', { recursive: true });
  await page.screenshot({ path: 'test-results/fresswuerfel/desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#figure-description').fill('Eine mobile Testbeschreibung mit ausreichend Zeichen.');
    await expect(page.locator('#figure-description')).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/fresswuerfel/mobile.png', fullPage: true });
  await page.goto(path);
  await page.locator('#figure-description').fill('Eine private synthetische Skizze für den Bildtest.');
  await page.locator('#figure-consent').check();
  await page.locator('#figure-sketch').setInputFiles({ name: 'falsch.png', mimeType: 'image/png', buffer: Buffer.from('<svg>keine PNG-Datei</svg>') });
  await page.getByRole('button', { name: 'Idee einreichen', exact: true }).click();
  await expect(page.locator('#sketch-error')).toContainText('ungültig');
  const imageBytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ffe000' } }).withMetadata({ exif: { IFD0: { Artist: 'PRIVATE METADATEN' } } }).png().toBuffer();
  await page.locator('#figure-sketch').setInputFiles({ name: 'private-skizze.png', mimeType: 'image/png', buffer: imageBytes });
  const imagePending = page.waitForResponse(r => r.url().endsWith('/api/fresswuerfel/einreichungen') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Idee einreichen', exact: true }).click();
  const imageResponse = await imagePending;
  expect(imageResponse.status()).toBe(201);
  savedNumber = (await imageResponse.json()).number;
  const internal = execFileSync('node_modules/.bin/wrangler', ['d1', 'execute', 'FRESSWUERFEL_DB', '--local', '--config', testConfig, '--persist-to', '.cache/fresswuerfel/test-state', '--command', `SELECT sketch_key FROM submissions WHERE number = '${savedNumber}'`, '--json'], { encoding: 'utf8' });
  const sketchKey = JSON.parse(internal)[0].results[0].sketch_key;
  expect((await request.get(`/${sketchKey}`)).status()).toBe(404);
  expect((await request.get(`/api/fresswuerfel/${sketchKey}`)).status()).toBeGreaterThanOrEqual(400);
  const listed = execFileSync(process.execPath, ['scripts/fresswuerfel.mjs', 'list', '--public-file', publicFile, '--local-config', testConfig, '--persist-to', '.cache/fresswuerfel/test-state'], { encoding: 'utf8' });
  expect(listed).toContain(savedNumber);
  execFileSync(process.execPath, ['scripts/fresswuerfel.mjs', 'approve', '--public-file', publicFile, '--local-config', testConfig, '--persist-to', '.cache/fresswuerfel/test-state', '--number', savedNumber, '--image', '--alt', 'Gelbes Quadrat als synthetische Probeskizze', '--title', 'Freigegebene Probekandidatur', '--description', 'Eine redaktionell gekürzte, öffentliche Probeidee.'], { encoding: 'utf8' });
  const approved = readFileSync(publicFile, 'utf8');
  const imagePath = JSON.parse(approved).candidates[0].image.src.split('/').pop();
  const metadata = await sharp(readFileSync(`.cache/fresswuerfel/auswahl/${imagePath}`)).metadata();
  expect(metadata.exif).toBeUndefined(); expect(metadata.xmp).toBeUndefined();
  expect(approved).toContain('Freigegebene Probekandidatur'); expect(approved).not.toContain('streng-intern'); expect(approved).not.toContain('PRIVATE ORIGINALBESCHREIBUNG');
});

test('Vorbereitung, tatsächliche lokale Freigabe und Ergebnis; API bleibt geschlossen', async ({ page }) => {
  mkdirSync('test-results/fresswuerfel', { recursive: true });
  for (const phase of ['vorbereitet', 'sichtung', 'ergebnis']) {
    const log = createWriteStream(`test-results/fresswuerfel/${phase}.log`);
    const child = spawn(process.execPath, ['scripts/fresswuerfel.mjs', 'preview', '--phase', phase, '--public-file', publicFile, '--port', '4341', '--local-config', `.cache/fresswuerfel/wrangler-${phase}.json`, '--persist-to', '.cache/fresswuerfel/test-state'], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log); child.stderr.pipe(log);
    try {
      const url = `http://127.0.0.1:4341${path}`;
      let ready = false;
      for (let i = 0; i < 120; i++) {
        if (child.exitCode !== null) break;
        try { const r = await fetch(url); const html = await r.text(); if (r.ok && (phase !== 'sichtung' || html.includes('Freigegebene Probekandidatur'))) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      expect(ready).toBe(true);
      await page.goto(url);
      const necessary = page.getByRole('button', { name: 'Nur notwendige Funktionen nutzen' });
      if (await necessary.isVisible()) await necessary.click();
      await expect(page.locator('#campaign-form')).toHaveCount(0);
      const denied = await fetch('http://127.0.0.1:4341/api/fresswuerfel/einreichungen', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4341', 'Content-Type': 'application/json' }, body: '{}' });
      expect(denied.status).toBe(409);
      await expect(page.locator('body')).not.toContainText('streng-intern@example.org');
      await expect(page.locator('body')).not.toContainText('PRIVATE ORIGINALBESCHREIBUNG');
      if (phase === 'vorbereitet') await expect(page.getByText('Die Einreichung ist noch nicht geöffnet.')).toBeVisible();
      if (phase === 'sichtung') {
        await expect(page.getByRole('heading', { name: 'Freigegebene Probekandidatur' })).toBeVisible();
        const image = page.getByRole('img', { name: 'Gelbes Quadrat als synthetische Probeskizze' });
        await expect(image).toBeVisible();
        expect(await image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(64);
      }
      if (phase === 'ergebnis') await expect(page.getByRole('heading', { name: 'Lokales Prüfergebnis' })).toBeVisible();
      await page.screenshot({ path: `test-results/fresswuerfel/${phase}.png`, fullPage: true });
    } finally {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise<void>(resolve => child.once('exit', () => resolve()));
      }
      log.end();
    }
  }
});
