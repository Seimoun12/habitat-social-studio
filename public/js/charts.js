// Grafici SVG disegnati a mano: una serie per grafico, assi sobri, tooltip al passaggio.
// Specifiche dalla skill dataviz: linea 2px, barre max 24px con estremo arrotondato 4px, griglia a filetto.
import { esc } from './lib.js';
import { fmtInt, fmtShortDate } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000 || 0); // || 0 evita "-0"
  return ticks;
}

const compact = (n) => {
  const a = Math.abs(n);
  const short = (v, unit) => `${String(Number(v.toFixed(1))).replace('.', ',')}${unit}`;
  if (a >= 1e6) return short(n / 1e6, ' Mln');
  if (a >= 1e3) return short(n / 1e3, 'k');
  return fmtInt(n);
};

// Ridisegna quando cambia la larghezza del contenitore.
function responsive(el, draw) {
  let w = 0;
  const ro = new ResizeObserver(() => {
    const nw = Math.round(el.clientWidth);
    if (nw && nw !== w) { w = nw; draw(w); }
  });
  ro.observe(el);
}

function tooltip(el) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  el.append(tip);
  return {
    show(html, x, y) {
      tip.innerHTML = html;
      tip.hidden = false;
      const w = tip.offsetWidth;
      const left = Math.min(Math.max(x - w / 2, 0), el.clientWidth - w);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(y - tip.offsetHeight - 10, -8)}px`;
    },
    hide() { tip.hidden = true; },
  };
}

function svgEl(w, h, label) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  return svg;
}

function axes(parts, ticks, y, w, h, dates, x) {
  for (const t of ticks) {
    parts.push(`<line class="grid" x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(t)}" y2="${y(t)}"/>`);
    parts.push(`<text class="axis-text" x="${PAD.left - 8}" y="${y(t) + 4}" text-anchor="end">${esc(compact(t))}</text>`);
  }
  const idx = dates.length > 2 ? [0, Math.floor((dates.length - 1) / 2), dates.length - 1] : dates.map((_, i) => i);
  idx.forEach((i, k) => {
    const anchor = k === 0 ? 'start' : k === idx.length - 1 ? 'end' : 'middle';
    parts.push(`<text class="axis-text" x="${x(i)}" y="${h - 6}" text-anchor="${anchor}">${esc(fmtShortDate(dates[i]))}</text>`);
  });
}

// Linea con area leggera. points: [{date, value}] (value può essere null).
export function lineChart(el, points, { label, valueLabel, height = 220 }) {
  el.classList.add('chart');
  const tip = tooltip(el);
  responsive(el, (w) => {
    el.querySelectorAll('svg, .note-muted').forEach((n) => n.remove());
    const vals = points.map((p) => p.value).filter((v) => v != null);
    if (vals.length < 2) { el.insertAdjacentHTML('afterbegin', '<p class="note-muted">Servono almeno due giorni con dati per disegnare l\'andamento.</p>'); return; }
    const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const x = (i) => PAD.left + (i / (points.length - 1)) * (w - PAD.left - PAD.right);
    const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.top - PAD.bottom);
    const parts = [];
    axes(parts, ticks, y, w, height, points.map((p) => p.date), x);
    let d = '';
    let area = '';
    let firstX = null;
    let lastX = null;
    points.forEach((p, i) => {
      if (p.value == null) return;
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
      if (firstX == null) firstX = x(i);
      lastX = x(i);
    });
    area = `${d}L${lastX},${y(lo)}L${firstX},${y(lo)}Z`;
    parts.push(`<path class="area" d="${area}"/><path class="line" d="${d}"/>`);
    parts.push('<line class="cross" y1="0" y2="0" x1="0" x2="0" visibility="hidden"/><circle class="dot" r="4" visibility="hidden"/>');
    const svg = svgEl(w, height, label);
    svg.innerHTML = parts.join('');
    el.prepend(svg);

    const cross = svg.querySelector('.cross');
    const dot = svg.querySelector('.dot');
    const move = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * w;
      const i = Math.round(((px - PAD.left) / (w - PAD.left - PAD.right)) * (points.length - 1));
      const p = points[Math.min(Math.max(i, 0), points.length - 1)];
      const idx = points.indexOf(p);
      if (p.value == null) { tip.hide(); return; }
      cross.setAttribute('x1', x(idx)); cross.setAttribute('x2', x(idx));
      cross.setAttribute('y1', PAD.top); cross.setAttribute('y2', height - PAD.bottom);
      dot.setAttribute('cx', x(idx)); dot.setAttribute('cy', y(p.value));
      cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
      const scale = rect.width / w;
      tip.show(`<div class="t-date">${esc(fmtShortDate(p.date))}</div><div><span class="t-val">${esc(fmtInt(p.value))}</span> ${esc(valueLabel)}</div>`, x(idx) * scale, y(p.value) * scale);
    };
    svg.addEventListener('pointermove', (e) => move(e.clientX));
    svg.addEventListener('pointerleave', () => { tip.hide(); cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
  });
}

// Colonne giornaliere. series: [{key, label, negative}]; una serie "negative" scende sotto lo zero.
export function columnChart(el, rows, { label, series, height = 200 }) {
  el.classList.add('chart');
  const tip = tooltip(el);
  responsive(el, (w) => {
    el.querySelector('svg')?.remove();
    const hiV = Math.max(0, ...rows.flatMap((r) => series.filter((s) => !s.negative).map((s) => r[s.key] || 0)));
    const loV = -Math.max(0, ...rows.flatMap((r) => series.filter((s) => s.negative).map((s) => r[s.key] || 0)));
    const ticks = niceTicks(loV, hiV || 1, 3);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const inner = w - PAD.left - PAD.right;
    const band = inner / rows.length;
    const bw = Math.min(24, Math.max(2, band - 2)); // 2px di stacco tra colonne vicine
    const x = (i) => PAD.left + band * i + band / 2;
    const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.top - PAD.bottom);
    const parts = [];
    axes(parts, ticks, y, w, height, rows.map((r) => r.date), x);
    const r4 = Math.min(4, bw / 2);
    rows.forEach((r, i) => {
      for (const s of series) {
        const v = r[s.key];
        if (!v) continue;
        const top = s.negative ? y(0) : y(v);
        const bottom = s.negative ? y(-v) : y(0);
        const hgt = Math.max(1, bottom - top);
        const left = x(i) - bw / 2;
        const rr = Math.min(r4, hgt);
        // Estremo dei dati arrotondato, base squadrata sulla linea dello zero.
        const path = s.negative
          ? `M${left},${top}h${bw}v${hgt - rr}q0,${rr} ${-rr},${rr}h${-(bw - 2 * rr)}q${-rr},0 ${-rr},${-rr}Z`
          : `M${left},${bottom}v${-(hgt - rr)}q0,${-rr} ${rr},${-rr}h${bw - 2 * rr}q${rr},0 ${rr},${rr}v${hgt - rr}Z`;
        parts.push(`<path class="bar${s.negative ? ' neg' : ''}" d="${path}"/>`);
      }
    });
    parts.push(`<line class="baseline" x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(0)}" y2="${y(0)}"/>`);
    const svg = svgEl(w, height, label);
    svg.innerHTML = parts.join('');
    el.prepend(svg);
    svg.addEventListener('pointermove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * w;
      const i = Math.floor((px - PAD.left) / band);
      const r = rows[i];
      if (!r) { tip.hide(); return; }
      const lines = series.map((s) => `<div><span class="t-val">${esc(fmtInt(r[s.key] || 0))}</span> ${esc(s.label)}</div>`).join('');
      const scale = rect.width / w;
      tip.show(`<div class="t-date">${esc(fmtShortDate(r.date))}</div>${lines}`, x(i) * scale, PAD.top * scale + 20);
    });
    svg.addEventListener('pointerleave', () => tip.hide());
  });
}

// Barre orizzontali in HTML per quote percentuali (genere, età, luogo).
export function barList(rows) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return `<div class="barlist">${rows.map((r) => `
    <div class="barlist-row">
      <span>${esc(r.label)}</span>
      <span class="track"><span class="fill" style="width:${((r.value / max) * 100).toFixed(1)}%" aria-hidden="true"></span></span>
      <span class="pct">${(r.value * 100).toFixed(1).replace('.', ',')}%</span>
    </div>`).join('')}</div>`;
}
