// Date come stringhe 'YYYY-MM-DD', calcolate in UTC per evitare salti di ora legale.
const DAY = 86400000;

export const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
export const toDate = (s) => new Date(s + 'T00:00:00Z');
export const toIso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => toIso(new Date(toDate(s).getTime() + n * DAY));
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
export const today = () => toIso(new Date());

export function eachDay(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Il periodo di confronto ha la stessa durata e finisce il giorno prima dell'inizio.
export function previousRange({ from, to }) {
  const len = diffDays(from, to) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

export const PRESETS = { '7d': 7, '30d': 30, '90d': 90 };

export function resolveRange({ preset, from, to }) {
  if (preset && PRESETS[preset]) {
    const end = addDays(today(), -1); // ieri: l'ultimo giorno con dati completi
    return { from: addDays(end, -(PRESETS[preset] - 1)), to: end };
  }
  if (!isIsoDate(from) || !isIsoDate(to)) throw new RangeError('Inserisci una data di inizio e una di fine valide.');
  if (from > to) throw new RangeError('La data di inizio viene dopo la data di fine.');
  if (to > today()) throw new RangeError('La data di fine non può essere nel futuro.');
  if (diffDays(from, to) + 1 > 366) throw new RangeError('Il periodo massimo è di 366 giorni.');
  return { from, to };
}
