// Panoramica del cliente: i quattro numeri chiave, l'andamento dei follower, il pubblico e i contenuti da guardare.
import { api, esc, PLATFORM_LABEL, PLATFORM_SHORT, isoLocal } from '../lib.js';
import { fmtInt, fmtPct, fmtSigned, fmtShortDate, fmtDate } from '../format.js';
import { lineChart, barList } from '../charts.js';
import { openReportDialog } from './report-dialog.js';
import { loadPrefs, filterBar, bindFilters, fetchAnalytics, delta, demoNotice, rankItem, loadingLine, errorBox } from './analytics-common.js';

export async function renderPanoramica(main, client, isCurrent) {
  const prefs = loadPrefs();
  main.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">${esc(client.name)} · panoramica</p>
        <h1>Come sta andando<br><em>${esc(client.name)}.</em></h1>
        <p class="heading-copy" id="account-line"></p>
      </div>
      <div class="heading-actions">
        <a class="button button-outline" href="#/cliente/${encodeURIComponent(client.id)}/studio">Studio grafico</a>
        <button type="button" class="button button-dark" id="open-report"><span class="button-icon download-icon" aria-hidden="true"></span>Scarica report</button>
      </div>
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
      const [a, upcoming] = await Promise.all([
        fetchAnalytics(client, prefs),
        api(`/api/contents?clientId=${encodeURIComponent(client.id)}&from=${isoLocal(new Date())}`).catch(() => null),
      ]);
      if (!isCurrent()) return;
      main.querySelector('#compare').textContent = `Confronto con ${fmtShortDate(a.previous.from)} – ${fmtShortDate(a.previous.to)}`;
      draw(a, upcoming);
    } catch (e) {
      if (!isCurrent()) return;
      results.innerHTML = errorBox(e);
      results.querySelector('[data-retry]').addEventListener('click', load);
    }
  }

  function draw(a, upcoming) {
    const cur = a.totals.current;
    const prev = a.totals.previous;
    const aud = a.audience.current;
    const metric = (label, value, d, foot) => `<div class="metric-item"><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong><div class="metric-foot">${d || esc(foot)}</div></div>`;
    const demo = a.demographics;
    const topOf = (rows) => rows?.length ? [...rows].sort((x, y) => y.value - x.value)[0] : null;
    const cid = encodeURIComponent(client.id);

    results.innerHTML = `
      ${demoNotice(a, client)}
      <div class="metric-strip">
        ${metric('Follower', fmtInt(aud.end), aud.net != null ? delta(aud.net, 0, { mode: 'abs', vs: 'nel periodo' }) : '', 'storico non ancora disponibile')}
        ${metric('Interazioni', fmtInt(cur.interactions), delta(cur.interactions, prev.interactions, { vs: 'sul periodo prima' }))}
        ${metric('Visualizzazioni', fmtInt(cur.views), delta(cur.views, prev.views, { vs: 'sul periodo prima' }), 'non fornite')}
        ${metric('Coinvolgimento', fmtPct(cur.engagementRate), delta(cur.engagementRate, prev.engagementRate, { mode: 'points' }))}
      </div>

      <div class="overview-grid">
        <section class="panel" aria-labelledby="p-trend">
          <div class="panel-heading">
            <div><p class="eyebrow">Andamento</p><h2 id="p-trend">Quante persone ti seguono?</h2></div>
            <span class="channel-stamp" aria-label="${esc(a.platformLabel)}">${PLATFORM_SHORT[a.platform]}</span>
          </div>
          <div class="chart-summary">
            <div><strong>${esc(fmtInt(aud.end))}</strong> <span>follower al ${esc(fmtDate(a.range.to))}</span></div>
            ${aud.net != null && aud.start ? `<span>${esc(fmtSigned((aud.net / aud.start) * 100, 1))}% nel periodo</span>` : ''}
          </div>
          <div id="chart-followers"></div>
          <ul class="summary">${a.summary.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        </section>

        <section class="panel" aria-labelledby="p-aud">
          <div class="panel-heading"><div><p class="eyebrow">Pubblico</p><h2 id="p-aud">Chi ti segue</h2></div></div>
          ${demo ? `
            <div class="audience-block" style="margin-top:16px"><span class="mini-label">Genere</span>${barList(demo.gender)}</div>
            <div class="audience-block"><div class="two-col">
              <div><span class="mini-label">Fascia più presente</span><strong>${esc(topOf(demo.age)?.label || 'n/d')}</strong></div>
              <div><span class="mini-label">Città principale</span><strong>${esc(topOf(demo.locations)?.label || 'n/d')}</strong></div>
            </div></div>` : `<p class="note-muted" style="margin-top:16px">${esc(a.unavailable.demographics || 'Dati demografici non disponibili per questo canale.')}</p>`}
          <div class="audience-block">
            <span class="mini-label">In programma per ${esc(client.name)}</span>
            ${upcoming == null ? '<p class="note-muted">Non riesco a leggere il piano contenuti.</p>'
              : upcoming.length ? `<div class="day-events" style="padding:0">${upcoming.slice(0, 3).map((c) => `<a class="event-card" data-channel="${esc(c.channels[0])}" href="#/contenuti"><span class="event-kind">${esc(c.format)} · ${esc(fmtShortDate(c.date))} ${esc(c.time)}</span><strong>${esc(c.title)}</strong></a>`).join('')}</div>`
              : '<p class="note-muted">Nessun contenuto programmato. <a href="#/contenuti">Apri il piano contenuti</a></p>'}
          </div>
        </section>
      </div>

      <div class="section-heading">
        <div><p class="eyebrow">Contenuti</p><h2>Il prossimo passo parte da qui</h2></div>
        <a class="text-button" href="#/cliente/${cid}/analisi">Apri analisi completa</a>
      </div>
      <div class="two-col">
        <section class="content-list-panel" aria-labelledby="p-best">
          <div class="list-heading"><h3 id="p-best">I 5 migliori</h3><span class="quality-mark">Da replicare</span></div>
          ${a.ranking.best.length ? `<ol class="rank-list">${a.ranking.best.map(rankItem).join('')}</ol>` : '<p class="note-muted" style="padding:12px 0">Nessun contenuto nel periodo.</p>'}
        </section>
        <section class="content-list-panel avoid-panel" aria-labelledby="p-worst">
          <div class="list-heading"><h3 id="p-worst">I 5 da rivedere</h3><span class="quality-mark">Da evitare</span></div>
          ${a.ranking.worst.length ? `<ol class="rank-list">${a.ranking.worst.map(rankItem).join('')}</ol>` : '<p class="note-muted" style="padding:12px 0">Servono almeno 6 contenuti nel periodo per separare i migliori da quelli da rivedere.</p>'}
        </section>
      </div>`;

    lineChart(results.querySelector('#chart-followers'), a.series.map((s) => ({ date: s.date, value: s.followers })), {
      label: `Follower ${a.platformLabel} giorno per giorno`, valueLabel: 'follower', height: 190,
    });
  }

  bindFilters(main, prefs, load);
  await load();
}
