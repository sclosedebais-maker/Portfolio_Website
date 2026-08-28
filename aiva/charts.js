/* ============================================================================
   AIVA — charts.js
   Inline-SVG charts for the executive dashboard and the business case.
   No chart library. Every chart is a string of SVG built from the model, so it
   prints, exports and themes with the rest of the page. Series colours come
   from the CSS custom properties (validated palette); text wears ink tokens.
   ============================================================================ */

window.AIVA = window.AIVA || {};

(function (AIVA) {
  'use strict';

  const fmt = () => AIVA.fmt;
  const esc = (s) => AIVA.fmt.escapeHtml(s);
  const SERIES = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
  const seriesColor = (i) => `var(${SERIES[(i - 1) % SERIES.length]})`;

  /* Tooltip payloads are attached as data-tip and read by app.js's delegated
     hover handler, so a single listener serves every chart on the page. */
  const tip = (text) => `data-tip="${esc(text)}"`;

  /* --------------------------------------------------------------------------
     Horizontal bar chart — annual benefit by driver
     ----------------------------------------------------------------------- */

  function benefitBars(lines) {
    const data = lines.filter((l) => l.on && l.value > 0);
    if (!data.length) return emptyChart('Turn on a value driver to see the benefit breakdown.');

    const W = 520, rowH = 46, padL = 150, padR = 96, padT = 8, padB = 8;
    const H = padT + padB + data.length * rowH;
    const max = Math.max.apply(null, data.map((d) => d.value)) * 1.05;
    const x = (v) => padL + (v / max) * (W - padL - padR);

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Annual benefit by value driver" preserveAspectRatio="xMinYMin meet">`;
    data.forEach((d, i) => {
      const cy = padT + i * rowH + rowH / 2;
      const bw = Math.max(3, x(d.value) - padL);
      const t = `${d.label}: ${fmt().money(d.value)} — ${Math.round(d.share * 100)}% of annual benefit`;
      svg += `<text x="${padL - 12}" y="${cy}" text-anchor="end" dominant-baseline="middle" class="chart-label">${esc(d.label)}</text>`;
      svg += `<rect x="${padL}" y="${cy - 11}" width="${W - padL - padR}" height="22" rx="4" fill="var(--grid)" opacity=".5"/>`;
      svg += `<rect class="chart-mark" x="${padL}" y="${cy - 11}" width="${bw}" height="22" rx="4" fill="${seriesColor(d.series)}" ${tip(t)}/>`;
      svg += `<text x="${padL + bw + 10}" y="${cy}" dominant-baseline="middle" class="chart-value">${esc(fmt().moneyShort(d.value))}</text>`;
    });
    svg += '</svg>';
    return svg;
  }

  /* --------------------------------------------------------------------------
     Cumulative cash-flow line — payback curve
     ----------------------------------------------------------------------- */

  function cashflowLine(fin) {
    const pts = fin.monthly;
    if (!pts || pts.length < 2) return emptyChart('Enter investment figures to see the payback curve.');

    const W = 520, H = 240, padL = 64, padR = 20, padT = 16, padB = 34;
    const maxM = pts[pts.length - 1].month;
    const vals = pts.map((p) => p.cumulative);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi <= 0) hi = 0; if (lo >= 0) lo = 0;
    const pad = (hi - lo) * 0.08 || 1;
    hi += pad; lo -= pad;
    const x = (m) => padL + (m / maxM) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative net cash flow over time" preserveAspectRatio="xMinYMin meet">`;

    // y grid + labels (4 ticks)
    for (let i = 0; i <= 4; i++) {
      const v = lo + (i / 4) * (hi - lo);
      const gy = y(v);
      svg += `<line class="chart-grid-line" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`;
      svg += `<text x="${padL - 8}" y="${gy}" text-anchor="end" dominant-baseline="middle" class="chart-value">${esc(fmt().moneyShort(v))}</text>`;
    }
    // zero line emphasised
    const zy = y(0);
    svg += `<line class="chart-axis" x1="${padL}" y1="${zy}" x2="${W - padR}" y2="${zy}" stroke-width="1.5"/>`;

    // x labels — years
    const years = Math.round(maxM / 12);
    for (let yr = 0; yr <= years; yr++) {
      const gx = x(yr * 12);
      svg += `<text x="${gx}" y="${H - 12}" text-anchor="middle" class="chart-label">${yr === 0 ? 'Start' : 'Y' + yr}</text>`;
    }

    // area under curve, split at zero via clip
    const line = pts.map((p) => `${x(p.month).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ');
    const area = `${padL},${zy} ${line} ${x(maxM)},${zy}`;
    svg += `<polygon points="${area}" fill="var(--brand)" opacity=".10"/>`;
    svg += `<polyline points="${line}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

    // payback marker
    if (fin.paybackMonths !== null && fin.paybackMonths <= maxM) {
      const px = x(fin.paybackMonths);
      svg += `<line x1="${px}" y1="${padT}" x2="${px}" y2="${H - padB}" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3"/>`;
      svg += `<circle cx="${px}" cy="${zy}" r="4.5" fill="var(--brand)" stroke="var(--surface)" stroke-width="2" ${tip('Payback: ' + fmt().months(fin.paybackMonths))}/>`;
      svg += `<text x="${Math.min(px, W - padR - 4)}" y="${padT + 4}" text-anchor="${px > W - 90 ? 'end' : 'start'}" dx="${px > W - 90 ? -6 : 6}" class="chart-value" fill="var(--ink-2)">Payback ${esc(fmt().months(fin.paybackMonths))}</text>`;
    }

    // invisible hover dots every ~3 months
    pts.forEach((p) => {
      if (p.month % 3 === 0) {
        svg += `<circle class="chart-hit" cx="${x(p.month)}" cy="${y(p.cumulative)}" r="10" ${tip('Month ' + p.month + ': ' + fmt().money(p.cumulative) + ' cumulative')}/>`;
        svg += `<circle class="chart-mark" cx="${x(p.month)}" cy="${y(p.cumulative)}" r="2.5" fill="var(--brand)"/>`;
      }
    });

    svg += '</svg>';
    return svg;
  }

  /* --------------------------------------------------------------------------
     Radar — the eight agentic fit dimensions
     ----------------------------------------------------------------------- */

  function fitRadar(dims, opts) {
    const interactive = opts && opts.interactive;
    const W = 380, H = 360, cx = W / 2, cy = H / 2 + 6, R = 118;
    const N = dims.length;
    const angle = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;
    const pt = (i, r) => [cx + Math.cos(angle(i)) * R * r, cy + Math.sin(angle(i)) * R * r];

    let svg = `<svg class="chart radar${interactive ? ' is-interactive' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Agentic fit across eight dimensions"
      data-cx="${cx}" data-cy="${cy}" data-r="${R}" data-n="${N}" preserveAspectRatio="xMidYMid meet">`;

    // Concentric rings — one per point on the 1–5 scale (the outer ring is 5).
    for (let ring = 1; ring <= 4; ring++) {
      const r = ring / 4;
      const poly = dims.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(',')).join(' ');
      svg += `<polygon points="${poly}" fill="none" class="chart-grid-line"/>`;
    }
    dims.forEach((_, i) => {
      const [ex, ey] = pt(i, 1);
      svg += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="chart-grid-line"/>`;
    });

    const shape = dims.map((d, i) => pt(i, d.score / 100).map((v) => v.toFixed(1)).join(',')).join(' ');
    svg += `<polygon class="radar-shape" points="${shape}" fill="var(--brand)" fill-opacity=".16" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round"/>`;

    dims.forEach((d, i) => {
      const [mx, my] = pt(i, d.score / 100);
      const tipTxt = d.label + ': ' + Math.round(d.score) + '/100' + (d.overridden ? ' (adjusted)' : '') + (interactive ? ' — drag to change' : '');
      svg += `<circle class="radar-vertex" data-vi="${i}" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" fill="var(--brand)" stroke="var(--surface)" stroke-width="1.5" ${tip(tipTxt)}/>`;
      if (interactive) {
        // A large, transparent grab target over each vertex.
        svg += `<circle class="radar-handle" data-radar-i="${i}" data-dim="${esc(d.key)}" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="17" fill="transparent" ${tip(tipTxt)}/>`;
      }
      const [lx, ly] = pt(i, 1.16);
      const anchor = Math.abs(Math.cos(angle(i))) < 0.35 ? 'middle' : (Math.cos(angle(i)) > 0 ? 'start' : 'end');
      const words = d.label.split(' ');
      const mid = Math.ceil(words.length / 2);
      const l1 = words.slice(0, mid).join(' '), l2 = words.slice(mid).join(' ');
      svg += `<text x="${lx.toFixed(1)}" y="${(ly - (l2 ? 5 : 0)).toFixed(1)}" text-anchor="${anchor}" class="chart-label">${esc(l1)}`;
      if (l2) svg += `<tspan x="${lx.toFixed(1)}" dy="12">${esc(l2)}</tspan>`;
      svg += '</text>';
    });

    svg += '</svg>';
    return svg;
  }

  /* --------------------------------------------------------------------------
     Score composition — the six weighted components of the value score
     ----------------------------------------------------------------------- */

  function scoreBars(components) {
    const W = 520, rowH = 42, padL = 168, padR = 44, padT = 6;
    const H = padT * 2 + components.length * rowH;
    const barW = W - padL - padR;

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Value score components" preserveAspectRatio="xMinYMin meet">`;
    components.forEach((c, i) => {
      const cy = padT + i * rowH + rowH / 2;
      const bw = Math.max(2, (c.score / 100) * barW);
      const t = `${c.label}: ${Math.round(c.score)}/100 · weight ${Math.round(c.weight * 100)}%`;
      svg += `<text x="${padL - 12}" y="${cy - 6}" text-anchor="end" class="chart-label">${esc(c.label)}</text>`;
      svg += `<text x="${padL - 12}" y="${cy + 8}" text-anchor="end" class="chart-value" fill="var(--ink-3)">${Math.round(c.weight * 100)}% weight</text>`;
      svg += `<rect x="${padL}" y="${cy - 8}" width="${barW}" height="16" rx="4" fill="var(--grid)" opacity=".5"/>`;
      svg += `<rect class="chart-mark" x="${padL}" y="${cy - 8}" width="${bw}" height="16" rx="4" fill="var(--brand)" ${tip(t)}/>`;
      svg += `<text x="${padL + bw + 8}" y="${cy}" dominant-baseline="middle" class="chart-value">${Math.round(c.score)}</text>`;
    });
    svg += '</svg>';
    return svg;
  }

  /* --------------------------------------------------------------------------
     Stacked yearly value vs cost
     ----------------------------------------------------------------------- */

  function yearlyColumns(fin) {
    const years = fin.years;
    if (!years.length) return emptyChart('Enter investment figures to see the yearly profile.');
    const W = 520, H = 250, padL = 60, padR = 16, padT = 16, padB = 46;
    const groupW = (W - padL - padR) / years.length;
    const barW = Math.min(46, groupW * 0.5);
    const max = Math.max.apply(null, years.map((y) => Math.max(y.benefit, y.runCost + Math.max(0, -y.net)))) * 1.15 || 1;
    const y0 = H - padB;
    const scale = (v) => (v / max) * (H - padT - padB);

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Annual benefit and run cost by year" preserveAspectRatio="xMinYMin meet">`;
    for (let i = 0; i <= 3; i++) {
      const v = (i / 3) * max;
      const gy = y0 - scale(v);
      svg += `<line class="chart-grid-line" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`;
      svg += `<text x="${padL - 8}" y="${gy}" text-anchor="end" dominant-baseline="middle" class="chart-value">${esc(fmt().moneyShort(v))}</text>`;
    }
    years.forEach((yr, i) => {
      const gx = padL + i * groupW + groupW / 2;
      const bh = scale(yr.benefit);
      const rh = scale(yr.runCost);
      const bx = gx - barW - 2;
      const rx = gx + 2;
      svg += `<rect class="chart-mark" x="${bx}" y="${y0 - bh}" width="${barW}" height="${Math.max(1, bh)}" rx="3" fill="var(--c3)" ${tip('Year ' + yr.year + ' benefit: ' + fmt().money(yr.benefit) + ' (' + Math.round(yr.factor * 100) + '% run rate)')}/>`;
      svg += `<rect class="chart-mark" x="${rx}" y="${y0 - rh}" width="${barW}" height="${Math.max(1, rh)}" rx="3" fill="var(--c1)" ${tip('Year ' + yr.year + ' run cost: ' + fmt().money(yr.runCost))}/>`;
      svg += `<text x="${gx}" y="${H - 24}" text-anchor="middle" class="chart-label">Year ${yr.year}</text>`;
      svg += `<text x="${gx}" y="${H - 10}" text-anchor="middle" class="chart-value" fill="var(--ink-3)">${esc(fmt().moneyShort(yr.net))} net</text>`;
    });
    svg += '</svg>';
    return svg;
  }

  function legend(items) {
    return '<div class="legend">' + items.map((it) =>
      `<span class="legend-item"><span class="legend-swatch" style="background:${it.color}"></span>${esc(it.label)}</span>`
    ).join('') + '</div>';
  }

  function emptyChart(message) {
    return `<div class="notice"><span></span><span>${esc(message)}</span></div>`;
  }

  /* Data-table fallback (accessibility + print) */
  function benefitTable(lines) {
    const data = lines.filter((l) => l.on && l.value > 0);
    if (!data.length) return '';
    const total = data.reduce((s, l) => s + l.value, 0);
    let t = '<table class="data-table"><thead><tr><th>Driver</th><th class="num">Annual value</th><th class="num">Share</th></tr></thead><tbody>';
    data.forEach((l) => {
      t += `<tr><td>${esc(l.label)}</td><td class="num">${esc(fmt().money(l.value))}</td><td class="num">${Math.round(l.share * 100)}%</td></tr>`;
    });
    t += `</tbody><tfoot><tr><td>Total annual benefit</td><td class="num">${esc(fmt().money(total))}</td><td class="num">100%</td></tr></tfoot></table>`;
    return t;
  }

  AIVA.charts = { benefitBars, cashflowLine, fitRadar, scoreBars, yearlyColumns, legend, benefitTable, seriesColor };
})(window.AIVA);
