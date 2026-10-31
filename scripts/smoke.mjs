// Controllo rapido delle API, senza browser. Usa un server separato con dati temporanei.
// Uso: npm run check
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'smoke-data-'));
const port = 3800 + Math.floor(Math.random() * 90);
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => { if (String(d).includes('pronto')) resolve(); });
  server.on('exit', (code) => reject(new Error('Il server si è fermato, codice ' + code)));
});

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log('ok  ', name); } catch (e) { failures.push(name); console.log('FAIL', name, '-', e.message); }
}
const req = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, type, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};

await check('elenco clienti iniziale', async () => {
  const r = await req('GET', '/api/clients');
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 1);
});

for (const platform of ['instagram', 'facebook', 'tiktok']) {
  for (const preset of ['7d', '30d', '90d']) {
    await check(`analisi ${platform} ${preset}`, async () => {
      const r = await req('GET', `/api/clients/demo-a/analytics?platform=${platform}&preset=${preset}`);
      assert.equal(r.status, 200);
      assert.equal(r.body.source, 'demo');
      assert.ok(r.body.series.length === Number(preset.replace('d', '')));
      assert.ok(Array.isArray(r.body.summary) && r.body.summary.length);
      assert.ok(r.body.ranking.best.length <= 5 && r.body.ranking.worst.length <= 5);
    });
  }
}

await check('periodo personalizzato', async () => {
  const r = await req('GET', '/api/clients/demo-a/analytics?platform=instagram&from=2026-01-01&to=2026-01-31');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.previous, { from: '2025-12-01', to: '2025-12-31' });
});
await check('periodo con inizio dopo la fine -> 400', async () => {
  const r = await req('GET', '/api/clients/demo-a/analytics?platform=instagram&from=2026-02-01&to=2026-01-01');
  assert.equal(r.status, 400);
});
await check('periodo oltre 366 giorni -> 400', async () => {
  const r = await req('GET', '/api/clients/demo-a/analytics?platform=instagram&from=2024-01-01&to=2025-06-01');
  assert.equal(r.status, 400);
});
await check('canale sconosciuto -> 400', async () => {
  assert.equal((await req('GET', '/api/clients/demo-a/analytics?platform=x&preset=7d')).status, 400);
});
await check('cliente inesistente -> 404', async () => {
  assert.equal((await req('GET', '/api/clients/nessuno/analytics?platform=instagram&preset=7d')).status, 404);
});

await check('report PDF con tutte le sezioni', async () => {
  const sections = Object.keys((await req('GET', '/api/report-sections')).body);
  const r = await req('POST', '/api/clients/demo-a/report', { platforms: ['instagram', 'facebook', 'tiktok'], sections, preset: '30d', notes: 'Note di prova è à ò.' });
  assert.equal(r.status, 200);
  assert.ok(r.type.includes('pdf'));
  assert.equal(r.body.subarray(0, 4).toString(), '%PDF');
});
await check('report senza sezioni -> 400', async () => {
  assert.equal((await req('POST', '/api/clients/demo-a/report', { platforms: ['instagram'], sections: [], preset: '30d' })).status, 400);
});

let clientId;
await check('crea cliente con token: il token non torna al browser', async () => {
  const r = await req('POST', '/api/clients', { name: 'Prova', handles: { instagram: '@prova' }, connections: { instagram: { accountId: '123', accessToken: 'segreto' } } });
  assert.equal(r.status, 201);
  clientId = r.body.id;
  assert.equal(r.body.connected.instagram, true);
  assert.ok(!JSON.stringify(r.body).includes('segreto'));
  const c = await req('GET', `/api/clients/${clientId}/connections`);
  assert.ok(!JSON.stringify(c.body).includes('segreto'));
});
await check('scollega account', async () => {
  const r = await req('PUT', `/api/clients/${clientId}`, { name: 'Prova', connections: { instagram: { clear: true } } });
  assert.equal(r.body.connected.instagram, false);
});
await check('cliente senza nome -> 400', async () => {
  assert.equal((await req('POST', '/api/clients', { name: '  ' })).status, 400);
});

let apptId;
await check('crea appuntamento', async () => {
  const r = await req('POST', '/api/appointments', { title: 'Call', date: '2026-10-20', start: '10:00', end: '11:00', clientId });
  assert.equal(r.status, 201);
  apptId = r.body.id;
});
await check('appuntamento con fine prima dell\'inizio -> 400', async () => {
  assert.equal((await req('POST', '/api/appointments', { title: 'X', date: '2026-10-20', start: '10:00', end: '09:00' })).status, 400);
});
await check('elimina cliente: l\'appuntamento resta senza cliente', async () => {
  assert.equal((await req('DELETE', `/api/clients/${clientId}`)).status, 204);
  const list = (await req('GET', '/api/appointments?from=2026-10-01&to=2026-10-31')).body;
  assert.equal(list.find((a) => a.id === apptId).clientId, null);
});
await check('elimina appuntamento', async () => {
  assert.equal((await req('DELETE', `/api/appointments/${apptId}`)).status, 204);
});
await check('percorso API inesistente -> 404 JSON', async () => {
  const r = await req('GET', '/api/nulla');
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});

server.kill();
rmSync(dataDir, { recursive: true, force: true });
console.log(`\n${passed} ok, ${failures.length} falliti`);
process.exit(failures.length ? 1 : 0);
