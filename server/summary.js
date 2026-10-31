// Sintesi in italiano costruita dai numeri, senza modelli generativi:
// ogni frase corrisponde a un dato visibile nella pagina.
import { fmtInt, fmtPct, fmtSigned, pctChange } from '../public/js/format.js';

export function buildSummary(a) {
  const lines = [];
  const aud = a.audience.current;
  if (aud?.net != null) {
    const pct = aud.start ? (aud.net / aud.start) * 100 : null;
    const dir = aud.net > 0 ? 'cresciuti' : aud.net < 0 ? 'calati' : 'rimasti stabili';
    lines.push(
      aud.net === 0
        ? `I follower sono rimasti stabili a ${fmtInt(aud.end)}.`
        : `I follower sono ${dir} di ${fmtInt(Math.abs(aud.net))}${pct != null ? ` (${fmtSigned(pct, 1)}%)` : ''}, arrivando a ${fmtInt(aud.end)}.`,
    );
  }
  const t = a.totals.current;
  const p = a.totals.previous;
  const views = pctChange(t.views, p.views);
  if (t.views != null) {
    lines.push(`Le visualizzazioni sono state ${fmtInt(t.views)}${views != null ? `, ${fmtSigned(views, 0)}% rispetto al periodo precedente` : ''}.`);
  }
  if (t.engagementRate != null) {
    const diff = p.engagementRate != null ? t.engagementRate - p.engagementRate : null;
    lines.push(
      `Il tasso di coinvolgimento è ${fmtPct(t.engagementRate)}${diff != null ? ` (${fmtSigned(diff, 2)} punti rispetto al periodo precedente)` : ''}.`,
    );
  }
  const best = a.formats[0];
  if (best && a.formats.length > 1 && best.avgEngagementRate != null) {
    lines.push(`Il formato con il coinvolgimento medio più alto è ${best.format} (${fmtPct(best.avgEngagementRate)} su ${best.posts} ${best.posts === 1 ? 'contenuto' : 'contenuti'}).`);
  }
  if (a.postCount.current === 0) lines.push('Nel periodo non sono stati pubblicati contenuti.');
  return lines;
}
