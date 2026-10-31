// Formattazione in italiano, condivisa tra browser, sintesi e PDF.
// useGrouping 'always': anche 1.106 col punto, uguale in Chrome e in Node.
const intFmt = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });

export const fmtInt = (n) => (n == null ? 'n/d' : intFmt.format(Math.round(n)));
export const fmtPct = (n, digits = 2) => (n == null ? 'n/d' : `${n.toFixed(digits).replace('.', ',')}%`);
export function fmtSigned(n, digits = 0) {
  const abs = new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' }).format(Math.abs(n));
  const zero = Number(Math.abs(n).toFixed(digits)) === 0;
  return `${zero ? '' : n > 0 ? '+' : '−'}${abs}`;
}
export const pctChange = (cur, prev) => (cur == null || !prev ? null : ((cur - prev) / prev) * 100);

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const fmtDate = (iso) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const fmtShortDate = (iso) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(2, 4)}`;
export const fmtRange = ({ from, to }) => `${fmtDate(from)} – ${fmtDate(to)}`;
