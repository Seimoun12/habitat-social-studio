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
const server = spawn(process.execPath, ['server/index.js'], { env: {
  ...process.env, PORT: String(port), DATA_DIR: dataDir,
  // Chiavi finte e fisse: i test non dipendono dal file .env (dotenv non sovrascrive variabili già impostate).
  META_APP_ID: '', META_APP_SECRET: '', TIKTOK_CLIENT_KEY: 'chiave-test', TIKTOK_CLIENT_SECRET: 'segreto-test', PUBLIC_URL: '',
}, stdio: 'pipe' });
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
const viaTunnel = { 'X-Forwarded-For': '203.0.113.7' };
let inviteId;
await check('link cliente: senza canali o con login non configurato -> 400', async () => {
  assert.equal((await req('POST', '/api/clients/demo-a/invites', { platforms: [] })).status, 400);
  assert.equal((await req('POST', '/api/clients/demo-a/invites', { platforms: ['meta'] })).status, 400);
});
await check('link cliente: crea link TikTok', async () => {
  const r = await req('POST', '/api/clients/demo-a/invites', { platforms: ['tiktok', 'nulla'] });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.platforms, ['tiktok']);
  assert.match(r.body.url, /\/collega\/[\w-]{20,}$/);
  inviteId = r.body.id;
  assert.equal((await req('GET', '/api/clients/demo-a/invites')).body.length, 1);
});
await check('link cliente: pagina pubblica, anche via tunnel', async () => {
  const r = await fetch(`${base}/collega/${inviteId}`, { headers: viaTunnel });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(html.includes('Collega i tuoi account'));
  assert.ok(html.includes(`/oauth/tiktok/start?invite=${inviteId}`));
  assert.ok(!html.includes('segreto-test'));
});
await check('link cliente: il login parte verso TikTok', async () => {
  const r = await fetch(`${base}/oauth/tiktok/start?invite=${inviteId}`, { headers: viaTunnel, redirect: 'manual' });
  assert.equal(r.status, 303);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.host, 'www.tiktok.com');
  assert.equal(loc.searchParams.get('client_key'), 'chiave-test');
  assert.ok(loc.searchParams.get('code_challenge'));
});
await check('via tunnel: app, API e login senza link non raggiungibili', async () => {
  assert.equal((await fetch(`${base}/api/clients`, { headers: viaTunnel })).status, 404);
  assert.equal((await fetch(`${base}/`, { headers: viaTunnel })).status, 404);
  assert.equal((await fetch(`${base}/oauth/tiktok/start?client=demo-a`, { headers: viaTunnel, redirect: 'manual' })).status, 403);
});
await check('link cliente: annullato non si apre più', async () => {
  assert.equal((await req('DELETE', `/api/invites/${inviteId}`)).status, 204);
  const r = await fetch(`${base}/collega/${inviteId}`);
  assert.equal(r.status, 404);
  assert.ok((await r.text()).includes('non più valido'));
  const s = await fetch(`${base}/oauth/tiktok/start?invite=${inviteId}`, { redirect: 'manual' });
  assert.equal(s.headers.get('location'), `/collega/${inviteId}`);
});
await check('percorso API inesistente -> 404 JSON', async () => {
  const r = await req('GET', '/api/nulla');
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});

// Login da internet: secondo server con HABITAT_PASSWORD_HASH, richieste "da fuori" (Host e x-forwarded-for).
{
  const { hashPassword } = await import('../server/auth.js');
  const http = await import('node:http');
  const authPort = port + 100;
  const authDir = mkdtempSync(path.join(os.tmpdir(), 'smoke-auth-'));
  const authServer = spawn(process.execPath, ['server/index.js'], { env: {
    ...process.env, PORT: String(authPort), DATA_DIR: authDir, PUBLIC_URL: '', META_APP_ID: '',
    HABITAT_PASSWORD_HASH: await hashPassword('password-di-prova'), SESSION_SECRET: 'segreto-di-prova',
  }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    authServer.stdout.on('data', (d) => { if (String(d).includes('pronto')) resolve(); });
    authServer.on('exit', (code) => reject(new Error('Server con login fermo, codice ' + code)));
  });
  const remote = (method, url, { headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: authPort, method, path: url, headers: {
      host: 'habitat.test', 'x-forwarded-for': '203.0.113.7', 'x-forwarded-proto': 'https', ...headers } }, (res) => {
      let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: data }));
    });
    r.on('error', reject); r.end(body);
  });
  const form = { 'content-type': 'application/x-www-form-urlencoded' };

  await check('login: senza sessione si viene mandati a /login', async () => {
    const r = await remote('GET', '/');
    assert.equal(r.status, 303);
    assert.equal(r.headers.location, '/login');
  });
  await check('login: API senza sessione -> 401', async () => {
    assert.equal((await remote('GET', '/api/clients')).status, 401);
  });
  await check('login: pagina di accesso senza script', async () => {
    const r = await remote('GET', '/login');
    assert.equal(r.status, 200);
    assert.ok(r.text.includes('type="password"') && !r.text.includes('<script'));
  });
  await check('login: password sbagliata -> 401 e nessun cookie', async () => {
    const r = await remote('POST', '/login', { headers: form, body: 'password=sbagliata' });
    assert.equal(r.status, 401);
    assert.ok(!r.headers['set-cookie']);
  });
  await check('login: origine diversa rifiutata', async () => {
    const r = await remote('POST', '/login', { headers: { ...form, origin: 'https://altro.example' }, body: 'password=password-di-prova' });
    assert.equal(r.status, 403);
  });
  await check('login: Origin null dello stesso sito (no-referrer) accettato', async () => {
    const r = await remote('POST', '/login', { headers: { ...form, origin: 'null', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '192.0.2.44' }, body: 'password=password-di-prova' });
    assert.equal(r.status, 303);
  });
  await check('login: Sec-Fetch-Site cross-site rifiutato', async () => {
    const r = await remote('POST', '/login', { headers: { ...form, 'sec-fetch-site': 'cross-site', 'x-forwarded-for': '192.0.2.45' }, body: 'password=password-di-prova' });
    assert.equal(r.status, 403);
  });
  let cookie = '';
  await check('login: password giusta apre la sessione (HttpOnly, Secure, Lax)', async () => {
    const r = await remote('POST', '/login', { headers: form, body: 'password=password-di-prova' });
    assert.equal(r.status, 303);
    const c = r.headers['set-cookie'][0];
    assert.ok(/HttpOnly/.test(c) && /Secure/.test(c) && /SameSite=Lax/.test(c));
    cookie = c.split(';')[0];
  });
  await check('login: con la sessione si usano pagina e API', async () => {
    assert.equal((await remote('GET', '/api/clients', { headers: { cookie } })).status, 200);
    assert.equal((await remote('GET', '/', { headers: { cookie } })).status, 200);
  });
  await check('login: scrittura da un altro sito rifiutata anche con sessione', async () => {
    const r = await remote('POST', '/api/clients', { headers: { cookie, origin: 'https://altro.example', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 403);
  });
  await check('login: cookie manomesso non vale', async () => {
    assert.equal((await remote('GET', '/api/clients', { headers: { cookie: cookie.slice(0, -2) + 'xx' } })).status, 401);
  });
  await check('login: esci chiude la sessione', async () => {
    const r = await remote('POST', '/logout', { headers: { cookie } });
    assert.equal(r.status, 303);
    assert.ok(/Max-Age=0/.test(r.headers['set-cookie'][0]));
  });
  await check('login: il link del cliente resta pubblico', async () => {
    assert.equal((await remote('GET', '/collega/inesistente')).status, 404);
    assert.ok((await remote('GET', '/collega/inesistente')).text.includes('non più valido'));
  });
  await check('login: dopo 5 errori si aspetta, anche con la password giusta', async () => {
    const other = { 'x-forwarded-for': '198.51.100.9' };
    for (let i = 0; i < 5; i++) await remote('POST', '/login', { headers: { ...form, ...other }, body: 'password=no' });
    const r = await remote('POST', '/login', { headers: { ...form, ...other }, body: 'password=password-di-prova' });
    assert.equal(r.status, 429);
    assert.ok(r.headers['retry-after']);
  });
  await check('login: da localhost non serve la password', async () => {
    const local = await fetch(`http://localhost:${authPort}/api/clients`);
    assert.equal(local.status, 200);
  });
  authServer.kill();
  rmSync(authDir, { recursive: true, force: true });
}

await check('senza password configurata /login da fuori resta non disponibile', async () => {
  const http = await import('node:http');
  const status = await new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: '/login', headers: { host: 'habitat.test', 'x-forwarded-for': '203.0.113.7' } }, (res) => { res.resume(); resolve(res.statusCode); });
    r.on('error', reject); r.end();
  });
  assert.equal(status, 404);
});

server.kill();
rmSync(dataDir, { recursive: true, force: true });
console.log(`\n${passed} ok, ${failures.length} falliti`);
process.exit(failures.length ? 1 : 0);
