// Prova i controlli dell'interfaccia in un Chrome reale e salva screenshot (regola anti-slop R-35).
// Avvia un server separato con dati temporanei: i dati veri in data/ non vengono toccati.
// Foto e video di prova si generano nel browser, senza file esterni.
// Uso: npm run ui-check [cartella]   (CHROME_PATH per indicare un Chrome diverso)
import puppeteer from 'puppeteer-core';
import { mkdirSync, readdirSync, statSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const out = path.resolve(process.argv[2] || 'tmp/ui-check');
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'ui-check-data-'));
const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['server/index.js'], { env: {
  ...process.env, PORT: String(port), DATA_DIR: dataDir,
  // Login non configurati: il test non dipende dal file .env (dotenv non sovrascrive variabili già impostate).
  META_APP_ID: '', META_APP_SECRET: '', META_CONFIG_ID: '', TIKTOK_CLIENT_KEY: '', TIKTOK_CLIENT_SECRET: '', PUBLIC_URL: '',
}, stdio: 'pipe' });
process.once('exit', () => {
  if (server.exitCode === null && server.signalCode === null) server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => { if (String(d).includes('pronto')) resolve(); });
  server.on('exit', (code) => reject(new Error('Il server di prova si è fermato, codice ' + code)));
});
const dl = path.join(out, 'downloads');
const media = path.join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(dl, { recursive: true });
mkdirSync(media, { recursive: true });
let fails = 0;
const ok = (m) => console.log('PASS', m);
const fail = (m) => { fails++; console.log('FAIL', m); };
const expect = (cond, m) => (cond ? ok(m) : fail(m));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await page.setViewport({ width: 1366, height: 900 });

const shot = (name, full = true) => page.screenshot({ path: path.join(out, name), fullPage: full });
const noOverflow = async (label) => {
  // Su mobile Chrome allarga la finestra di layout insieme al contenuto: si confronta con la larghezza impostata.
  const o = await page.evaluate(() => document.documentElement.scrollWidth) - page.viewport().width;
  expect(o <= 0, `${label}: nessuno scorrimento orizzontale${o > 0 ? ` (sborda di ${o}px)` : ''}`);
};
const waitDownload = async (re, ms = 60000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const f = readdirSync(dl).find((n) => re.test(n) && !n.endsWith('.crdownload'));
    if (f && statSync(path.join(dl, f)).size > 0) return f;
    await sleep(250);
  }
  return null;
};
const toastText = () => page.$eval('#toast', (t) => t.textContent);
const go = async (hash, sel) => { await page.goto(`${base}/${hash}`, { waitUntil: 'networkidle0' }); if (sel) await page.waitForSelector(sel, { timeout: 15000 }); };
const dialog = () => page.waitForSelector('dialog[open]', { timeout: 5000 });
const closedDialog = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 8000 });

// File di prova generati nel browser: un'immagine PNG e un video WebM di 2 secondi con audio.
await go('#/clienti', '.client-row');
const files = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 600;
  const g = c.getContext('2d');
  g.fillStyle = '#2b6cb0'; g.fillRect(0, 0, 800, 600);
  g.fillStyle = '#fff'; g.font = 'bold 90px sans-serif'; g.fillText('FOTO', 250, 330);
  const png = c.toDataURL('image/png').split(',')[1];
  const v = document.createElement('canvas');
  v.width = 360; v.height = 640;
  const vg = v.getContext('2d');
  const stream = v.captureStream(30);
  const ac = new AudioContext();
  const osc = ac.createOscillator();
  const dest = ac.createMediaStreamDestination();
  osc.connect(dest); osc.start();
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => { rec.onstop = r; });
  rec.start(100);
  const t0 = performance.now();
  await new Promise((r) => {
    const f = () => { const t = (performance.now() - t0) / 1000; vg.fillStyle = `hsl(${t * 120},60%,45%)`; vg.fillRect(0, 0, 360, 640); vg.fillStyle = '#fff'; vg.font = '60px sans-serif'; vg.fillText(t.toFixed(1), 110, 330); if (t < 2.2) requestAnimationFrame(f); else r(); };
    f();
  });
  rec.stop(); await done; osc.stop(); ac.close();
  const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  return { png, webm: btoa(bin) };
});
writeFileSync(path.join(media, 'foto-prova.png'), Buffer.from(files.png, 'base64'));
writeFileSync(path.join(media, 'clip-prova.webm'), Buffer.from(files.webm, 'base64'));
ok('file di prova generati (PNG e video WebM)');

// Tutorial di benvenuto: parte da solo al primo avvio, si percorre fino in fondo, poi non ricompare.
await page.waitForSelector('.tour-pop #tour-title');
ok('tutorial: compare da solo al primo avvio');
await shot('light-tutorial-1.png', false);
let steps = 0;
while (await page.$('.tour-pop [data-tour="next"]')) {
  const before = await page.$eval('.tour-count', (e) => e.textContent);
  await page.click('.tour-pop [data-tour="next"]');
  await page.waitForFunction((b) => { const c = document.querySelector('.tour-count'); return c && c.textContent !== b && document.querySelector('#tour-title'); }, { timeout: 10000 }, before);
  steps++;
  if (steps === 3) await shot('light-tutorial-filtri.png', false);
  if (steps === 6) await shot('light-tutorial-studio.png', false);
}
expect(await page.$('.tour-pop [data-tour="clients"]'), `tutorial: ${steps + 1} passi fino all'ultimo`);
await page.keyboard.press('ArrowLeft');
await page.waitForFunction(() => document.querySelector('.tour-pop [data-tour="next"]'));
ok('tutorial: freccia sinistra torna indietro');
await page.keyboard.press('ArrowRight');
await page.waitForSelector('.tour-pop [data-tour="close"]');
await page.click('.tour-pop [data-tour="close"]');
await page.waitForFunction(() => !document.querySelector('.tour-pop'));
await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);
expect(!(await page.$('.tour-pop')), 'tutorial: dopo averlo visto non ricompare');

// Impostazioni: spegnere il tutorial, riattivarlo, rivederlo e chiuderlo con Esc.
await page.click('#settings-open');
await dialog();
await page.click('dialog [name="tutorial"]');
expect(await page.$eval('dialog [data-start-tour]', (b) => b.disabled), 'impostazioni: tutorial spento, pulsante "Avvia" disattivato');
await page.click('dialog [name="tutorial"]');
expect(await page.$eval('dialog [data-start-tour]', (b) => !b.disabled), 'impostazioni: tutorial riattivato');
await page.click('dialog [data-start-tour]');
await page.waitForSelector('.tour-pop #tour-title');
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('.tour-pop'));
ok('impostazioni: "Avvia il tutorial adesso" lo apre, Esc lo chiude');
await page.click('#settings-open');
await dialog();
await page.click('dialog [data-theme-pref="dark"]');
expect(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'impostazioni: tema scuro');
await page.click('dialog [data-theme-pref="light"]');
await page.keyboard.press('Escape');
await closedDialog();
await page.click('#settings-open');
await dialog();
await page.click('dialog [name="tutorial"]');
await page.keyboard.press('Escape');
await closedDialog();
await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);
expect(!(await page.$('.tour-pop')), 'impostazioni: con il tutorial spento non compare al riavvio');

// Panoramica
await go('#/cliente/demo-a/panoramica', '.metric-strip');
ok('panoramica caricata');
expect(await page.$eval('#demo-label', (e) => !e.hidden && e.textContent.includes('demo')), 'etichetta "Dati demo" visibile in alto');
expect(await page.$eval('.demo-notice', (e) => e.textContent.includes('Dati demo')), 'avviso dati demo nella pagina');
await shot('light-panoramica.png');
for (const p of ['facebook', 'tiktok', 'instagram']) {
  await page.select('select[name="platform"]', p);
  await page.waitForFunction((p) => document.querySelector('#account-line')?.textContent.toLowerCase().startsWith(p) && document.querySelector('.metric-strip'), {}, p);
  ok(`canale -> ${p}`);
}
for (const p of ['7d', '90d', '30d']) {
  await page.click(`[data-period="${p}"]`);
  await page.waitForFunction((p) => document.querySelector(`[data-period="${p}"]`).getAttribute('aria-pressed') === 'true' && document.querySelector('.metric-strip'), {}, p);
  ok(`periodo -> ${p}`);
}
await page.click('[data-period="custom"]');
await page.click('#custom-range button');
expect(await page.$eval('#filter-error', (e) => !e.hidden), 'intervallo senza date -> errore visibile');
await page.$eval('input[name="from"]', (e) => { e.value = '2026-08-01'; });
await page.$eval('input[name="to"]', (e) => { e.value = '2026-08-31'; });
await page.click('#custom-range button');
await page.waitForFunction(() => document.querySelector('#compare').textContent.includes('lug'));
ok('intervallo 1-31 agosto applicato');
await page.click('[data-period="30d"]');
await page.waitForSelector('#chart-followers svg');
const svg = await page.$('#chart-followers svg');
const box = await svg.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
expect(await page.$eval('#chart-followers .tooltip', (t) => !t.hidden), 'grafico: tooltip al passaggio');

// Selettore cliente da tastiera: resta nella stessa sezione
await page.focus('.switcher-btn');
await page.keyboard.press('ArrowDown');
await page.waitForSelector('#client-menu:not([hidden])');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForFunction(() => location.hash === '#/cliente/demo-b/panoramica');
ok('selettore cliente da tastiera -> Cliente demo B, sempre in Panoramica');

// Analisi e report
await go('#/cliente/demo-a/analisi', '.hero-figure');
ok('analisi caricata');
await page.click('details.data-table summary');
expect(await page.$eval('details.data-table', (d) => d.open), 'tabella giorno per giorno si apre');
await shot('light-analisi.png');
await page.click('#open-report');
await dialog();
await shot('light-report-dialog.png', false);
await page.click('[data-toggle-all]');
await page.click('dialog [type="submit"]');
expect(await page.$eval('dialog .form-error', (e) => !e.hidden), 'report senza sezioni -> errore');
await page.click('[data-toggle-all]');
await page.click('dialog [type="submit"]');
expect(Boolean(await waitDownload(/^report-.*\.pdf$/)), 'report PDF scaricato');
await closedDialog();

// Clienti: crea, modifica, elimina
await go('#/clienti', '.client-row');
await page.click('#new-client');
await dialog();
await page.click('dialog [type="submit"]');
expect(await page.$eval('dialog .form-error', (e) => !e.hidden), 'nuovo cliente senza nome -> errore');
await page.type('dialog input[name="name"]', 'Forno Prova');
await page.type('dialog input[name="handle-instagram"]', '@fornoprova');
await page.click('dialog [type="submit"]');
await closedDialog();
await page.waitForFunction(() => [...document.querySelectorAll('.client-row .name')].some((n) => n.textContent.includes('Forno Prova')));
ok('cliente creato');
const newId = await page.evaluate(() => fetch('/api/clients').then((r) => r.json()).then((l) => l.find((c) => c.name === 'Forno Prova').id));
await page.click(`[data-edit="${newId}"]`);
await dialog();
expect(await page.$eval('dialog', (d) => d.textContent.includes('Login Meta non configurato')), 'senza .env il login Meta spiega cosa configurare');
await page.keyboard.press('Escape');
await closedDialog();
ok('Esc chiude la finestra cliente');
await shot('light-clienti.png');

// Studio grafico: stile del cliente con logo caricato
await go(`#/cliente/${newId}/studio/stile`, '#brand-form');
await page.$eval('input[name="hex-primary"]', (e) => { e.value = '#7a2e3a'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await page.select('select[name="font-heading"]', 'Fraunces');
const logoInput = await page.$('input[name="logo-file"]');
await logoInput.uploadFile(path.join(media, 'foto-prova.png'));
await page.waitForFunction(() => document.querySelector('select[name="logo"]').value !== '');
ok('logo caricato e scelto');
await page.click('#brand-form [type="submit"]');
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Stile'));
const brand = await page.evaluate((id) => fetch('/api/clients').then((r) => r.json()).then((l) => l.find((c) => c.id === id).brand), newId);
expect(brand.colors.primary === '#7a2e3a' && brand.fonts.heading === 'Fraunces' && brand.logoAssetId, 'stile del cliente salvato sul server');
await sleep(1500);
await shot('light-stile.png');

// Editor: post
await go(`#/cliente/${newId}/studio`, '.studio-category-grid');
expect(await page.$eval('h1', (e) => e.textContent.trim() === 'Time to Create'), 'dashboard: titolo Time to Create');
expect(await page.$eval('.studio-heading p', (e) => e.textContent.trim() === 'Dai forma alle tue idee.'), 'dashboard: sottotitolo richiesto');
expect((await page.$$('[data-category]')).length === 6, 'dashboard: sei categorie disponibili');
expect(!(await page.$('#studio-create')), 'dashboard: pulsante Crea un progetto rimosso');
expect(await page.$eval('#studio-search', (search) => {
  const subtitle = document.querySelector('.studio-title p').getBoundingClientRect();
  const searchBox = search.getBoundingClientRect();
  const categoriesHeading = document.querySelector('#studio-create-heading').getBoundingClientRect();
  return subtitle.bottom <= searchBox.top && searchBox.bottom <= categoriesHeading.top;
}), 'dashboard: barra di ricerca fra sottotitolo e categorie');
await shot('light-time-to-create.png');
for (const [key, count] of [['social', 14], ['presentations', 3], ['documents', 7], ['video', 4], ['print', 8], ['other', 4]]) {
  await page.click(`[data-category="${key}"]`);
  await dialog();
  expect(await page.$eval('dialog select[name="category"]', (s, expected) => s.value === expected, key), `${key}: selezione del formato aperta dalla categoria`);
  expect((await page.$$eval('dialog select[name="format"] option', (options) => options.length)) === count, `${key}: formati predefiniti e personalizzato`);
  await page.keyboard.press('Escape');
  await closedDialog();
}

await page.click('[data-templates]');
await page.waitForSelector('.studio-template');
expect((await page.$$('.studio-template')).length === 6, 'Template: libreria con anteprime dei modelli disponibili');
await page.click('[data-use-template="titolo"]');
await dialog();
expect(await page.$eval('dialog h2', (e) => e.textContent.includes('Titolo e testo')), 'Template: apre la selezione del formato');
await page.keyboard.press('Escape');
await closedDialog();
await page.click('[data-dashboard]');
await page.waitForSelector('.studio-category-grid');

await page.click(`.studio-shortcut[href="#/cliente/${newId}/studio/stile"]`);
await page.waitForSelector('#brand-form');
ok('Brand Kit: accesso rapido apre lo stile del cliente');
await page.click('.studio-heading > a');
await page.waitForSelector('.studio-category-grid');
await page.click(`.studio-shortcut[href="#/cliente/${newId}/studio/file"]`);
await page.waitForSelector('#dropzone');
ok('File e risorse: accesso rapido apre la libreria');
await page.click('.studio-heading > a');
await page.waitForSelector('.studio-category-grid');

await page.click('[data-category="presentations"]');
await dialog();
expect(await page.$eval('dialog select[name="category"]', (e) => e.value === 'presentations'), 'Categoria Presentazioni: avvia la scelta del formato');
await page.select('dialog select[name="category"]', 'presentations');
await page.select('dialog select[name="format"]', 'custom-post');
await page.$eval('dialog input[name="width"]', (e) => { e.value = '1200'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await page.$eval('dialog input[name="height"]', (e) => { e.value = '800'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await page.click('dialog button[type="submit"]');
await page.waitForSelector('#ed-canvas');
expect(await page.$eval('.ed-format', (e) => e.textContent.includes('1200×800')), 'Formato personalizzato: apre l’editor alle dimensioni salvate');
await page.click('.ed-bar a[href*="/studio"]');
await page.waitForSelector('.studio-category-grid');
const customDesignId = await page.evaluate((id) => fetch(`/api/designs?clientId=${id}`).then((r) => r.json()).then((items) => items[0].id), newId);
await page.type('#studio-search', 'Formato personalizzato');
await page.waitForSelector('.studio-search-results a');
expect(await page.$eval('.studio-search-results', (e) => e.textContent.includes('Formato personalizzato')), 'Ricerca: filtra i progetti salvati');
await page.$eval('#studio-search', (e) => { e.value = 'Titolo'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForSelector('[data-search-template="titolo"]');
expect(await page.$eval('.studio-search-results', (e) => e.textContent.includes('Template')), 'Ricerca: filtra i template reali');
await page.$eval('#studio-search', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });

await page.click(`[data-design-id="${customDesignId}"] .studio-project-actions summary`);
await page.click(`[data-design-id="${customDesignId}"] [data-rename]`);
await dialog();
await page.$eval('dialog input[name="name"]', (e) => { e.value = 'Bozza rinominata'; });
await page.click('dialog button[type="submit"]');
await closedDialog();
await page.waitForFunction((id) => document.querySelector(`[data-design-id="${id}"] .studio-project-name`)?.textContent === 'Bozza rinominata', {}, customDesignId);
ok('Progetti recenti: rinomina salvata sul server');
await page.click(`[data-design-id="${customDesignId}"] .studio-project-actions summary`);
await page.click(`[data-design-id="${customDesignId}"] [data-duplicate]`);
await page.waitForFunction(() => document.querySelectorAll('.studio-project').length === 2);
const duplicateId = await page.evaluate(async (id) => (await fetch(`/api/designs?clientId=${id}`).then((r) => r.json())).find((d) => d.name.includes('(copia)')).id, newId);
expect(await page.$(`[data-design-id="${duplicateId}"]`), 'Progetti recenti: duplicazione salvata sul server');
await page.click(`[data-design-id="${customDesignId}"] .studio-project-name`);
await page.waitForSelector('#ed-canvas');
ok('Progetti recenti: riapertura di un progetto esistente');
await page.click('.ed-bar a[href*="/studio"]');
await page.waitForSelector('.studio-category-grid');
for (const id of [customDesignId, duplicateId]) {
  await page.click(`[data-design-id="${id}"] .studio-project-actions summary`);
  await page.click(`[data-design-id="${id}"] [data-delete]`);
  await dialog();
  await page.click('dialog [data-ok]');
  await closedDialog();
  await page.waitForFunction((designId) => !document.querySelector(`[data-design-id="${designId}"]`), {}, id);
}
expect(await page.$eval('#designs', (e) => e.textContent.includes('I tuoi progetti appariranno qui')), 'Progetti recenti: stato vuoto dopo l’eliminazione');

const createFormatAndCheck = async (format, category, label, size) => {
  await page.click(`[data-category="${category}"]`);
  await dialog();
  await page.select('dialog select[name="format"]', format);
  await page.click('dialog button[type="submit"]');
  await page.waitForSelector('#ed-canvas');
  expect(await page.$eval('.ed-format', (e, expected) => e.textContent.includes(expected), size), `${label}: canvas ${size.replace('×', ' x ')} px`);
  await page.click('.ed-bar a[href*="/studio"]');
  await page.waitForSelector('.studio-category-grid');
};
await page.click('[data-category="presentations"]');
await dialog();
expect(await page.$eval('dialog select[name="format"] option[value="presentation-16x9"]', (e) => e.textContent.includes('1920 x 1080 px')), 'Presentazioni: dimensione 16:9 visibile');
await page.click('dialog button[type="submit"]');
await page.waitForSelector('#ed-canvas');
expect(await page.$eval('.ed-format', (e) => e.textContent.includes('1920×1080')), 'Presentazioni: canvas 16:9 aperto a 1920 x 1080 px');
await page.click('#ed-schedule');
await page.waitForSelector('dialog[open] select[name="designId"] option[value]:not([value=""])');
expect(await page.$eval('dialog select[name="format"]', (s) => s.value === 'Presentazione'), 'Presentazioni: formato corretto nel piano contenuti');
await page.$eval('dialog input[name="title"]', (i) => { i.value = 'Presentazione di prova'; });
await page.click('dialog [type="submit"]');
await closedDialog();
expect((await toastText()).includes('Contenuto salvato nel piano'), 'Presentazione programmata con il progetto collegato');
await page.click('.ed-bar a[href*="/studio"]');
await page.waitForSelector('.studio-category-grid');
await createFormatAndCheck('story-9x16', 'social', 'Storia Instagram', '1080×1920');
await createFormatAndCheck('facebook-cover', 'social', 'Copertina Facebook', '851×315');
await page.click('[data-category="social"]');
await dialog();
await page.select('dialog select[name="format"]', 'post-4x5');
await page.click('dialog button[type="submit"]');
await page.waitForSelector('#ed-canvas');
await sleep(500);
ok('editor post aperto');
await page.click('[data-template="titolo"]');
await page.waitForFunction(() => document.querySelectorAll('[data-pick]').length === 0);
await page.click('[data-tool="livelli"]');
await page.waitForSelector('[data-pick]');
expect((await page.$$('[data-pick]')).length === 4, 'modello "Titolo e testo" applicato: 4 livelli');
await page.evaluate(() => [...document.querySelectorAll('.ed-layer-pick')].find((b) => b.textContent.includes('Titolo')).click());
await page.waitForSelector('textarea[data-prop="text"]');
ok('selezione del livello Titolo dal pannello Livelli');
await page.$eval('textarea[data-prop="text"]', (t) => { t.value = 'Pane caldo ogni mattina'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); });
await page.click('[data-color-prop="color"] [data-color="@accent"]');
expect(await page.$eval('[data-color-prop="color"] [data-color="@accent"]', (b) => b.getAttribute('aria-pressed') === 'true'), 'colore del brand applicato al testo');
// Trascinamento sulla tela
const cbox = await (await page.$('#ed-canvas')).boundingBox();
const before = await page.$eval('input[data-prop="x"]', (i) => Number(i.value));
await page.mouse.move(cbox.x + cbox.width * 0.3, cbox.y + cbox.height * 0.25);
await page.mouse.down();
await page.mouse.move(cbox.x + cbox.width * 0.3 + 40, cbox.y + cbox.height * 0.25 + 30, { steps: 5 });
await page.mouse.up();
await sleep(200);
const after = await page.$eval('input[data-prop="x"]', (i) => Number(i.value)).catch(() => before);
expect(after !== before, `trascinamento sulla tela sposta il livello (x ${before} -> ${after})`);
await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
await sleep(200);
const undone = await page.$eval('input[data-prop="x"]', (i) => Number(i.value)).catch(() => null);
expect(undone === before, 'Ctrl+Z annulla lo spostamento');
await page.click('#ed-redo');
await page.focus('#ed-canvas');
await page.keyboard.press('ArrowRight');
await sleep(500);
await page.click('[data-tool="elementi"]');
await page.click('[data-add-shape="ellipse"]');
await page.waitForSelector('select[data-prop="shape"]');
ok('forma aggiunta');
await page.click('[data-act="delete"]');
await page.waitForFunction(() => document.querySelector('#ed-props').dataset.scope === 'doc');
ok('forma eliminata');
await page.click('[data-tool="file"]');
const fileInput = await page.$('#ed-file');
await fileInput.uploadFile(path.join(media, 'foto-prova.png'));
await page.waitForSelector('[data-asset-add]');
await sleep(600);
await page.evaluate(() => document.querySelector('[data-asset-add]').click());
await page.waitForSelector('[data-act="replace-image"]');
ok('immagine caricata e aggiunta alla tela');
await page.waitForFunction(() => document.querySelector('#ed-status').textContent === 'Salvato', { timeout: 10000 });
ok('salvataggio automatico');
await shot('light-editor-post.png', false);
await page.click('#ed-export');
await dialog();
await page.click('[data-x="png"]');
expect(Boolean(await waitDownload(/\.png$/)), 'esportazione PNG scaricata');
await page.keyboard.press('Escape');
await closedDialog();
await page.click('#ed-schedule');
await page.waitForSelector('dialog[open] select[name="designId"] option[value]:not([value=""])');
await page.click('dialog [type="submit"]');
await closedDialog();
ok('contenuto programmato dall\'editor con il progetto collegato');

// Editor: reel con clip video, foto, testo, riproduzione ed esportazione
await go(`#/cliente/${newId}/studio`, '.studio-category-grid');
await page.click('[data-category="video"]');
await dialog();
expect(await page.$eval('dialog select[name="format"] option[value="reel-9x16"]', (e) => e.textContent.includes('1080 x 1920 px')), 'Video: formato verticale e dimensioni corrette');
expect(await page.$eval('dialog select[name="format"] option[value="landscape-16x9"]', (e) => e.textContent.includes('1920 x 1080 px')), 'Video: formato orizzontale e dimensioni corrette');
await page.keyboard.press('Escape');
await closedDialog();
await createFormatAndCheck('landscape-16x9', 'video', 'Video orizzontale', '1920×1080');
await sleep(500);
expect(await page.$$eval('.studio-project-preview img', (l) => l.length >= 1), 'il progetto salvato ha l\'anteprima nella galleria');
await page.click('[data-category="video"]');
await dialog();
await page.select('dialog select[name="format"]', 'reel-9x16');
await page.click('dialog button[type="submit"]');
await page.waitForSelector('#ed-timeline [data-play]');
const reelInput = await page.$('#ed-file');
await reelInput.uploadFile(path.join(media, 'clip-prova.webm'));
// Si aspetta che il video caricato compaia nell'elenco, poi lo si aggiunge al montaggio.
await page.waitForFunction(() => [...document.querySelectorAll('[data-asset-clip]')].some((b) => b.textContent.includes('Al montaggio')), { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('[data-asset-clip]')].find((b) => b.textContent.includes('Al montaggio')).click());
await page.waitForSelector('.tl-clip');
await page.evaluate(() => [...document.querySelectorAll('[data-asset-clip]')].find((b) => b.textContent.includes('Come clip'))?.click());
await page.waitForFunction(() => document.querySelectorAll('.tl-clip').length === 2);
ok('due clip in timeline (video e foto)');
// Il video di prova (WebM registrato dal browser) non dichiara la durata: l'editor deve trovarla (circa 2,2 s + 3 s di foto).
const total = await page.$eval('[data-time]', (e) => e.textContent.split('/')[1].trim());
expect(/^0:0[45],/.test(total), `durata del reel letta dal file (${total})`);
await page.click('[data-tool="testi"]');
await page.click('[data-reel-text="apertura"]');
await page.waitForSelector('.tl-layer');
ok('testo animato aggiunto alla timeline');
await page.click('[data-play]');
await sleep(1500);
const t = await page.$eval('[data-time]', (e) => e.textContent);
expect(!t.startsWith('0:00,0'), `riproduzione avanzata (${t})`);
await page.click('[data-play]');
await shot('light-editor-reel.png', false);
await page.click('#ed-export');
await dialog();
await page.click('[data-x="video"]');
const video = await waitDownload(/\.(mp4|webm)$/, 90000);
expect(Boolean(video), `video esportato: ${video}`);
if (video) expect(statSync(path.join(dl, video)).size > 20000, `video non vuoto (${statSync(path.join(dl, video)).size} byte)`);
await page.keyboard.press('Escape');

// Calendario contenuti
await go('#/contenuti', '.week-grid, .empty-calendar');
await page.click('[data-mode="month"]');
await page.waitForSelector('.month-grid');
ok('contenuti: vista mese');
await page.click('[data-mode="week"]');
// Il contenuto è programmato per domani: può cadere in questa settimana o nella prossima.
await page.waitForSelector('.week-grid');
if (!(await page.$('.event-card'))) await page.click('[data-shift="1"]');
await page.waitForFunction(() => document.querySelector('.event-card'));
ok('contenuti: il contenuto programmato compare nel calendario');
await page.click('.event-card');
await dialog();
await page.select('dialog select[name="status"]', 'pronto');
await page.click('dialog [type="submit"]');
await closedDialog();
expect(await page.$eval('.event-card', (e) => e.dataset.status === 'pronto'), 'stato del contenuto aggiornato');
await shot('light-contenuti.png');

// Appuntamenti
await go('#/appuntamenti', '.week-grid, .empty-calendar');
await page.click('#new-appt');
await dialog();
await page.click('dialog [type="submit"]');
expect(await page.$eval('dialog .form-error', (e) => !e.hidden), 'appuntamento senza titolo -> errore');
await page.type('dialog input[name="title"]', 'Call piano editoriale');
await page.select('dialog select[name="channel"]', 'Studio');
await page.click('dialog [type="submit"]');
await closedDialog();
await page.waitForFunction(() => [...document.querySelectorAll('.event-card')].some((c) => c.textContent.includes('Call piano editoriale')));
ok('appuntamento creato e visibile');
await page.click('#export-ics');
expect(Boolean(await waitDownload(/\.ics$/)), 'esportazione .ics');
await page.evaluate(() => [...document.querySelectorAll('.event-card')].find((c) => c.textContent.includes('Call piano')).click());
await dialog();
await page.click('dialog [data-delete]');
await page.waitForSelector('dialog [data-ok]');
await page.click('dialog [data-ok]');
await page.waitForFunction(() => ![...document.querySelectorAll('.event-card')].some((c) => c.textContent.includes('Call piano editoriale')));
ok('appuntamento eliminato');
await shot('light-appuntamenti.png');

// Tema scuro
await go('#/cliente/demo-a/panoramica', '.metric-strip');
await page.click('#theme-toggle');
expect(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'interruttore tema -> scuro');
await sleep(300);
await shot('dark-panoramica.png');
await go(`#/cliente/${newId}/studio`, '.studio-category-grid');
await noOverflow('dark-time-to-create');
await shot('dark-time-to-create.png');
await page.click('.studio-project-preview');
await page.waitForSelector('#ed-canvas');
await sleep(800);
await shot('dark-editor.png', false);
await page.click('#ed-schedule');
await page.waitForSelector('dialog[open]');
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('dialog[open]'));
await page.click('.ed-bar a[href*="/studio"]');
await page.waitForFunction(() => location.hash.endsWith('/studio'));
await page.waitForSelector('.studio-category-grid');
await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
await page.click('#theme-toggle');
await page.waitForFunction(() => document.documentElement.dataset.theme !== 'dark');
expect(await page.evaluate(() => document.documentElement.dataset.theme !== 'dark'), 'interruttore tema -> chiaro');

// Telefono
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
for (const [hash, sel, name] of [['#/cliente/demo-a/panoramica', '.metric-strip', 'mobile-panoramica'], ['#/cliente/demo-a/analisi', '.hero-figure', 'mobile-analisi'], ['#/appuntamenti', '#cal', 'mobile-appuntamenti'], ['#/contenuti', '#cal', 'mobile-contenuti'], ['#/clienti', '.client-row', 'mobile-clienti'], [`#/cliente/${newId}/studio`, '.studio-category-grid', 'mobile-studio']]) {
  await go(hash, sel);
  await sleep(300);
  await noOverflow(name);
  if (name === 'mobile-studio') {
    const navOverlaps = await page.evaluate(() => {
      const links = [...document.querySelectorAll('.nav-scroll .nav-link')].map((e) => e.getBoundingClientRect());
      return links.some((a, i) => links.slice(i + 1).some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
    });
    expect(!navOverlaps, 'mobile Time to Create: navigazione senza voci sovrapposte');
  }
  await shot(`${name}.png`);
}
await go(`#/cliente/${newId}/studio`, '.studio-category-grid');
await page.click('[data-category="social"]');
await dialog();
await noOverflow('mobile-studio-formati-social');
await shot('mobile-studio-formati.png');
await page.keyboard.press('Escape');
await closedDialog();
await page.evaluate(() => localStorage.setItem('habitat-impostazioni', JSON.stringify({ tutorial: true, tutorialDone: false })));
await go('#/cliente/demo-a/panoramica', '.metric-strip');
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForSelector('.tour-pop #tour-title');
await page.click('.tour-pop [data-tour="next"]');
await page.waitForFunction(() => document.querySelector('.tour-count')?.textContent.startsWith('Passo 2'));
await sleep(400);
await noOverflow('mobile-tutorial');
await shot('mobile-tutorial.png', false);
await page.keyboard.press('Escape');
await go(`#/cliente/${newId}/studio`, '.studio-project');
await page.click('.studio-project-preview');
await page.waitForSelector('#ed-canvas');
await sleep(600);
await noOverflow('mobile-editor');
await shot('mobile-editor.png');

for (const [width, height, columns, name] of [[768, 1024, 2, 'tablet-studio'], [1024, 900, 3, 'laptop-studio']]) {
  await page.setViewport({ width, height });
  await go(`#/cliente/${newId}/studio`, '.studio-category-grid');
  await noOverflow(name);
  const actualColumns = await page.$eval('.studio-category-grid', (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(actualColumns === columns, `${name}: ${columns} colonne`);
  await shot(`${name}.png`);
}

expect(!errors.length, `nessun errore JavaScript${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);

await browser.close();
server.kill();
rmSync(dataDir, { recursive: true, force: true });
console.log(`\n${fails ? `${fails} FAIL` : '0 FAIL'}. Screenshot in ${out}`);
process.exit(fails ? 1 : 0);
