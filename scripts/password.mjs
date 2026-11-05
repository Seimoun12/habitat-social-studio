// Crea la riga HABITAT_PASSWORD_HASH da mettere in .env per attivare il login da internet.
// Uso: npm run password    (chiede la password senza mostrarla; non finisce nella cronologia della shell)
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../server/auth.js';

let muted = false;
const out = new Writable({ write(chunk, _enc, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
const rl = createInterface({ input: process.stdin, output: out, terminal: process.stdin.isTTY });
const ask = (q) => new Promise((resolve) => { process.stdout.write(q); muted = true; rl.question('', (a) => { muted = false; process.stdout.write('\n'); resolve(a); }); });

const first = await ask('Nuova password (almeno 12 caratteri): ');
if (first.length < 12) { console.error('Troppo corta: servono almeno 12 caratteri.'); process.exit(1); }
const second = await ask('Ripetila: ');
rl.close();
if (first !== second) { console.error('Le due password non coincidono.'); process.exit(1); }
console.log('\nAggiungi questa riga a .env e riavvia Habitat:\n');
console.log(`HABITAT_PASSWORD_HASH=${await hashPassword(first)}`);
