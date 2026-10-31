// Analisi completa del cliente per canale e periodo, con accesso al report PDF.
import { esc, PLATFORM_LABEL, PLATFORM_SHORT } from '../lib.js';
import { fmtInt, fmtPct, fmtSigned, fmtDate, fmtShortDate } from '../format.js';
import { lineChart, columnChart, barList } from '../charts.js';
import { openReportDialog } from './report-dialog.js';
import { loadPrefs, filterBar, bindFilters, fetchAnalytics, delta, stat, demoNotice, rankItem, loadingLine, errorBox } from './analytics-common.js';

export async function renderAnalisi(main, client, isCurrent) {
  const prefs = loadPrefs();
  main.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">${esc(client.name)} · analisi</p>
        <h1>Leggi i segnali.<br><em>Scegli cosa fare.</em></h1>
        <p class="heading-copy" id="account-line"></p>
      </div>
      <button type="button" class="button button-dark" id="open-report"><span class="button-icon download-icon" aria-hidden="true"></span>Scarica report</button>
    </div>
    ${filterBar(prefs)}
    <div id="results" aria-live="polite"></div>`;

  const results = main.querySelector('#results');
  main.querySelector('#open-report').addEventListener('click', () => openReportDialog(client, { ...prefs }));

  async function load() {
    const h = client.handles?.[prefs.platform];
    main.querySelector('#account-line').textContent = `${PLATFORM_LABEL[prefs.platform]} · ${h || 'profilo non indicato'}`;
    main.querySelector('#compare').textContent = '';
    results.innerHTML = loadingLine(prefs);
    try {
      const a = await fetchAnalytics(client, prefs);
      if (!isCurrent()) return;
      main.querySelector('#compare').textContent = `Confronto con ${fmtShortDate(a.previous.from)} – ${fmtShortDate(a.previous.to)}`;
      renderResults(results, a, client);
    } catch (e) {
      if (!isCurrent()) return;
      results.innerHTML = errorBox(e);
      results.querySelector('[data-retry]').addEventListener('click', load);
    }
  }

  bindFilters(main, prefs, load);
  await load();
}

function renderResults(root, a, client) {
  const cur = a.totals.current;
  const prev = a.totals.previous;
  const aud = a.audience.current;
  const audPrev = a.audience.previous;
  const vs = `rispetto a ${fmtShortDate(a.previous.from)} – ${fmtShortDate(a.previous.to)}`;
  const label = a.platformLabel;

  const hero = aud.end != null
    ? `<p class="hero-label">Follower al ${esc(fmtDate(a.range.to))}</p>
       <p class="hero-figure">${esc(fmtInt(aud.end))}</p>
       ${aud.net != null ? `<span class="delta ${aud.net > 0 ? 'up' : aud.net < 0 ? 'down' : 'flat'}"><span aria-hidden="true">${aud.net > 0 ? '▲' : aud.net < 0 ? '▼' : ''}</span>${esc(fmtSigned(aud.net))} nel periodo${aud.start ? ` (${esc(fmtSigned((aud.net / aud.start) * 100, 1))}%)` : ''}</span>` : ''}`
    : `<p class="hero-label">Follower</p><p class="hero-figure">n/d</p><p class="note-muted">Lo storico si costruisce da oggi: la piattaforma fornisce solo il totale del giorno.</p>`;

  const audienceStats = [
    aud.net != null ? stat('Variazione netta', fmtSigned(aud.net), delta(aud.net, audPrev?.net, { mode: 'abs', vs: 'sul periodo precedente' })) : '',
    aud.gained != null ? stat('Nuovi follower', fmtInt(aud.gained), delta(aud.gained, audPrev?.gained)) : '',
    aud.lost != null ? stat('Follower persi', fmtInt(aud.lost), delta(aud.lost, audPrev?.lost, { invert: true })) : '',
  ].join('');

  const metricRows = [
    ['Visualizzazioni', 'views'], ['Copertura', 'reach'], ['Mi piace', 'likes'], ['Commenti', 'comments'],
    ['Condivisioni', 'shares'], ['Salvataggi', 'saves'], ['Interazioni totali', 'interactions'],
  ].filter(([, k]) => cur[k] != null);

  const erBaseText = a.engagementBase === 'reach'
    ? 'Interazioni (mi piace, commenti, condivisioni e salvataggi) divise per la copertura, per 100.'
    : 'Interazioni (mi piace, commenti e condivisioni) divise per le visualizzazioni, per 100.';

  const demo = a.demographics;
  const demoBlock = demo
    ? `<div class="grid-3">
        <div><h3 class="chart-title">Genere</h3>${barList(demo.gender)}</div>
        <div><h3 class="chart-title">Età</h3>${barList(demo.age)}</div>
        <div><h3 class="chart-title">Città principali</h3>${barList(demo.locations)}<p class="note-muted" style="margin-top:8px">Quota sul totale delle città elencate dalla piattaforma.</p></div>
      </div>`
    : `<p class="note-muted">${esc(a.unavailable.demographics || 'Dati demografici non disponibili per questo canale.')}</p>`;

  const heading = (eyebrow, id, title, sub) => `<div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2 id="${id}">${title}</h2></div>${sub ? `<p>${sub}</p>` : ''}</div>`;

  root.innerHTML = `
    ${demoNotice(a, client)}
    <section class="panel focus-block" style="margin-top:18px" aria-label="In breve">
      <div>${hero}</div>
      <div>
        <div class="panel-heading"><h2 class="chart-title">In breve</h2><span class="channel-stamp" aria-label="${esc(label)}">${PLATFORM_SHORT[a.platform]}</span></div>
        <ul class="summary">${a.summary.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      </div>
    </section>

    <section aria-labelledby="s-aud">
      ${heading('Crescita community', 's-aud', 'Quante persone ti seguono in più?', `Follower totali giorno per giorno, ${esc(fmtShortDate(a.range.from))} – ${esc(fmtShortDate(a.range.to))}.`)}
      <div class="wide-narrow">
        <div class="panel"><div id="chart-followers"></div></div>
        <div class="panel stat-list">${audienceStats}${a.unavailable.gainedLost ? `<p class="note-muted">${esc(a.unavailable.gainedLost)}</p>` : ''}</div>
      </div>
      ${aud.gained != null ? `<div class="panel" style="margin-top:15px"><h3 class="chart-title">${aud.lost != null ? 'Nuovi e persi al giorno' : 'Nuovi follower al giorno'}</h3><div id="chart-gained"></div>
        ${aud.lost != null ? '<div class="chart-legend"><span><span class="key" style="background:var(--series-1)"></span>Nuovi</span><span><span class="key" style="background:var(--series-lost)"></span>Persi</span></div>' : ''}</div>` : ''}
      <details class="data-table"><summary>Vedi i dati giorno per giorno</summary>
        <div class="table-wrap"><table>
          <thead><tr><th>Giorno</th><th class="r">Follower</th>${aud.gained != null ? '<th class="r">Nuovi</th>' : ''}${aud.lost != null ? '<th class="r">Persi</th>' : ''}<th class="r">Visualizzazioni</th><th class="r">Interazioni</th></tr></thead>
          <tbody>${a.series.map((s) => `<tr><td>${esc(fmtShortDate(s.date))}</td><td class="r">${esc(fmtInt(s.followers))}</td>${aud.gained != null ? `<td class="r">${esc(fmtInt(s.gained))}</td>` : ''}${aud.lost != null ? `<td class="r">${esc(fmtInt(s.lost))}</td>` : ''}<td class="r">${esc(fmtInt(s.views))}</td><td class="r">${esc(fmtInt(s.interactions))}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>
    </section>

    <section aria-labelledby="s-int">
      ${heading('Interazioni', 's-int', 'Come ha risposto il pubblico?', `Totali del periodo, ${esc(vs)}. Contenuti pubblicati: ${a.postCount.current} (prima: ${a.postCount.previous}).`)}
      <div class="panel"><div class="stats">${metricRows.map(([l, k]) => stat(l, fmtInt(cur[k]), delta(cur[k], prev[k]))).join('')}</div></div>
      <div class="panel" style="margin-top:15px"><h3 class="chart-title">Interazioni al giorno</h3><div id="chart-interactions"></div></div>
    </section>

    <section aria-labelledby="s-er">
      ${heading('Coinvolgimento', 's-er', 'Quanto coinvolgono i contenuti?')}
      <div class="two-col">
        <div class="panel">${stat('Tasso di coinvolgimento', fmtPct(cur.engagementRate), delta(cur.engagementRate, prev.engagementRate, { mode: 'points', vs }))}</div>
        <div class="panel"><p class="note-muted"><strong>Come si calcola.</strong> ${esc(erBaseText)} Periodo precedente: ${esc(fmtPct(prev.engagementRate))}.</p></div>
      </div>
    </section>

    <section aria-labelledby="s-fmt">
      ${heading('Formati', 's-fmt', 'Quale formato rende di più?', 'Medie per contenuto pubblicato nel periodo, ordinate per coinvolgimento.')}
      <div class="panel">${a.formats.length ? `<div class="table-wrap" style="max-height:none;margin:0;border:0"><table>
        <thead><tr><th>Formato</th><th class="r">Contenuti</th><th class="r">Visualizzazioni medie</th><th class="r">Interazioni medie</th><th class="r">Coinvolgimento medio</th></tr></thead>
        <tbody>${a.formats.map((f) => {
          const top = Math.max(...a.formats.map((x) => x.avgEngagementRate || 0)) || 1;
          return `<tr><td>${esc(f.format)}</td><td class="r">${f.posts}</td><td class="r">${esc(fmtInt(f.avgViews))}</td><td class="r">${esc(fmtInt(f.avgInteractions))}</td>
            <td class="r">${esc(fmtPct(f.avgEngagementRate))}<span class="meter" aria-hidden="true"><span style="width:${(((f.avgEngagementRate || 0) / top) * 100).toFixed(0)}%"></span></span></td></tr>`;
        }).join('')}</tbody></table></div>` : '<p class="note-muted">Nessun contenuto pubblicato nel periodo.</p>'}</div>
    </section>

    <section aria-labelledby="s-top">
      ${heading('Rendimento contenuti', 's-top', 'Quali contenuti hanno funzionato, e quali no?', 'Classifica per tasso di coinvolgimento del singolo contenuto.')}
      <div class="two-col">
        <div class="content-list-panel"><div class="list-heading"><h3>I 5 migliori</h3><span class="quality-mark">Da replicare</span></div>${a.ranking.best.length ? `<ol class="rank-list">${a.ranking.best.map(rankItem).join('')}</ol>` : '<p class="note-muted" style="padding:12px 0">Nessun contenuto nel periodo.</p>'}</div>
        <div class="content-list-panel avoid-panel"><div class="list-heading"><h3>I 5 da evitare</h3><span class="quality-mark">Da evitare</span></div>${a.ranking.worst.length ? `<ol class="rank-list">${a.ranking.worst.map(rankItem).join('')}</ol>` : '<p class="note-muted" style="padding:12px 0">Servono almeno 6 contenuti nel periodo per separare i migliori da quelli da evitare. Prova un periodo più lungo.</p>'}</div>
      </div>
    </section>

    <section aria-labelledby="s-demo">
      ${heading('Pubblico', 's-demo', "Chi c'è dall'altra parte?", 'Genere, età e luogo dei follower attuali.')}
      <div class="panel">${demoBlock}</div>
    </section>`;

  lineChart(root.querySelector('#chart-followers'), a.series.map((s) => ({ date: s.date, value: s.followers })), {
    label: `Follower ${label} giorno per giorno`, valueLabel: 'follower',
  });
  if (aud.gained != null) {
    columnChart(root.querySelector('#chart-gained'), a.series, {
      label: 'Nuovi e persi al giorno',
      series: [{ key: 'gained', label: 'nuovi' }, ...(aud.lost != null ? [{ key: 'lost', label: 'persi', negative: true }] : [])],
      height: 170,
    });
  }
  columnChart(root.querySelector('#chart-interactions'), a.series, {
    label: 'Interazioni al giorno', series: [{ key: 'interactions', label: 'interazioni' }], height: 180,
  });
}
