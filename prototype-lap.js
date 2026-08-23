/* ============================================================================
   SONYA CLOSE-DEBAIS — "THE LAP"
   ─────────────────────────────────────────────────────────────────────────
   One authored moment: the career line draws itself once, then the scroll
   position drives a playhead along it while the sector it has reached lights
   up on the rail below. Everything else on the page is static by design —
   a reveal on every section is animation debt, not authorship.

   The page is fully legible with this file absent or failed: the canvas is
   decorative, the tallies ship their final values in the markup, and no
   element starts hidden.
   ============================================================================ */

(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

  /* ── The career line ─────────────────────────────────────────────────────
     Nodes are the real role start years. x is time, laid out right-to-left so
     the newest role sits where the eye starts. y is authored, not measured —
     the caption says so on the page. */

  const NODES = [
    { year: 2021, label: '2021', y: 0.16 },
    { year: 2008, label: '2008', y: 0.42 },
    { year: 2007, label: '2007', y: 0.55 },
    { year: 2005, label: '2005', y: 0.70 },
    { year: 2000, label: '2000', y: 0.88 },
  ];

  const canvas = document.getElementById('trace-canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  let geometry = null;   // { pts, width, height }
  let drawn = 0;         // 0..1 — how much of the line has been laid down
  let playhead = 0;      // 0..1 — where the scroll has reached
  let styles = null;

  function readStyles() {
    const cs = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
    styles = {
      flash: pick('--flash', '#e2564f'),
      line: pick('--line-bold', 'rgba(244,241,234,0.28)'),
      hair: pick('--line-hair', 'rgba(244,241,234,0.07)'),
      faint: pick('--ink-faint', '#7d7770'),
      ground: pick('--ground', '#0d0c10'),
    };
  }

  /* A Catmull-Rom-ish spline sampled into points, so the playhead can walk it
     at a constant-ish rate rather than jumping between control nodes. */
  function buildGeometry() {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padX = Math.min(width * 0.04, 32);
    const padTop = 10;
    const padBottom = 30;               // room for the year ticks
    const usableW = width - padX * 2;
    const usableH = height - padTop - padBottom;

    const anchors = NODES.map((n, i) => ({
      x: padX + (usableW * i) / (NODES.length - 1),
      y: padTop + usableH * n.y,
      label: n.label,
    }));

    // Sample a smooth curve through the anchors.
    const pts = [];
    const STEPS = 24;
    for (let i = 0; i < anchors.length - 1; i++) {
      const p0 = anchors[Math.max(i - 1, 0)];
      const p1 = anchors[i];
      const p2 = anchors[i + 1];
      const p3 = anchors[Math.min(i + 2, anchors.length - 1)];
      for (let s = 0; s < STEPS; s++) {
        const t = s / STEPS;
        const t2 = t * t;
        const t3 = t2 * t;
        pts.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
              (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
              (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
              (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
              (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    pts.push({ x: anchors[anchors.length - 1].x, y: anchors[anchors.length - 1].y });

    geometry = { pts, anchors, width, height, baseline: height - padBottom + 14 };
  }

  function pointAt(progress) {
    const pts = geometry.pts;
    const idx = Math.min(Math.floor(progress * (pts.length - 1)), pts.length - 2);
    const local = progress * (pts.length - 1) - idx;
    const a = pts[idx];
    const b = pts[idx + 1];
    return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
  }

  function render() {
    if (!geometry || !ctx) return;
    const { pts, anchors, width, height, baseline } = geometry;

    ctx.clearRect(0, 0, width, height);

    // Ground rule the ticks hang from.
    ctx.strokeStyle = styles.hair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(baseline) + 0.5);
    ctx.lineTo(width, Math.round(baseline) + 0.5);
    ctx.stroke();

    const cut = Math.max(1, Math.floor(drawn * (pts.length - 1)));

    // The line itself.
    ctx.strokeStyle = styles.line;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= cut; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // The stretch the playhead has already covered, in tail-flash red.
    if (playhead > 0) {
      const lit = Math.max(1, Math.floor(Math.min(playhead, drawn) * (pts.length - 1)));
      ctx.strokeStyle = styles.flash;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= lit; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }

    // Year ticks and nodes.
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    anchors.forEach((a, i) => {
      const reached = drawn >= i / (anchors.length - 1) - 0.001;
      if (!reached) return;

      ctx.strokeStyle = styles.hair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x) + 0.5, a.y + 6);
      ctx.lineTo(Math.round(a.x) + 0.5, baseline);
      ctx.stroke();

      ctx.fillStyle = styles.ground;
      ctx.strokeStyle = styles.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = styles.faint;
      ctx.fillText(a.label, a.x, baseline + 8);
    });

    // The playhead.
    if (playhead > 0 && drawn >= 1) {
      const p = pointAt(playhead);
      ctx.fillStyle = styles.flash;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawIn() {
    if (reduced.matches) {
      drawn = 1;
      render();
      return;
    }
    const DURATION = 900;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      drawn = EASE_OUT(t);
      render();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── Scroll: playhead, live sector, readout, progress ────────────────── */

  const sectors = Array.from(document.querySelectorAll('.sector'));
  const lap = document.getElementById('lap');
  const readout = document.getElementById('readout');
  const progress = document.getElementById('progress');
  const navLinks = Array.from(document.querySelectorAll('.pitwall-nav a'));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  let lastReadout = '';

  function onScroll() {
    const vh = window.innerHeight;
    const doc = document.documentElement;

    // Page progress hairline under the bar.
    if (progress) {
      const max = doc.scrollHeight - vh;
      const pct = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      progress.style.width = (pct * 100).toFixed(2) + '%';
    }

    // The playhead tracks how far through the career list you have read.
    if (lap && geometry) {
      const r = lap.getBoundingClientRect();
      const span = r.height - vh * 0.5;
      const travelled = span > 0
        ? Math.min(Math.max((vh * 0.5 - r.top) / span, 0), 1)
        : (r.top < vh * 0.5 ? 1 : 0);
      if (Math.abs(travelled - playhead) > 0.001) {
        playhead = travelled;
        render();
      }
    }

    // Which sector the playhead is standing in.
    let live = null;
    for (const s of sectors) {
      const r = s.getBoundingClientRect();
      if (r.top <= vh * 0.55 && r.bottom > vh * 0.3) live = s;
    }
    sectors.forEach((s) => s.classList.toggle('is-live', s === live));

    // Which section owns the viewport, for the bar readout and nav state.
    let current = null;
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= vh * 0.4 && r.bottom > vh * 0.4) current = sec;
    }

    navLinks.forEach((a) => {
      const on = current && a.getAttribute('href') === '#' + current.id;
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    if (readout) {
      const label = live
        ? live.dataset.sector
        : current
          ? (navLinks.find((a) => a.getAttribute('href') === '#' + current.id) || {}).textContent
          : 'Ignition';
      const next = label || 'Ignition';
      if (next !== lastReadout) {
        readout.textContent = next;
        lastReadout = next;
      }
    }
  }

  let ticking = false;
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      onScroll();
    });
  }

  /* ── Tallies ─────────────────────────────────────────────────────────────
     They resolve to the value already printed in the markup. Nothing is
     invented and nothing is hidden while it counts. */

  function formatTally(el, value) {
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const sign = el.dataset.sign || '';
    const n = el.dataset.group
      ? Math.round(value).toLocaleString('en-AU')
      : String(Math.round(value));
    return sign + prefix + n + suffix;
  }

  function runTally(el) {
    const target = Number(el.dataset.to);
    if (!Number.isFinite(target)) return;
    if (reduced.matches) return;      // final value is already in the DOM

    const DURATION = 1000;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      el.textContent = formatTally(el, target * EASE_OUT(t));
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = formatTally(el, target);
    };
    requestAnimationFrame(step);
  }

  function watchTallies() {
    const tallies = Array.from(document.querySelectorAll('.tally'));
    if (!tallies.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        runTally(entry.target);
      });
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0.4 });

    tallies.forEach((t) => io.observe(t));
  }

  /* ── Wire up ─────────────────────────────────────────────────────────── */

  function resize() {
    buildGeometry();
    render();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  window.addEventListener('scroll', requestScroll, { passive: true });
  reduced.addEventListener('change', () => { drawn = 1; render(); });

  function start() {
    if (ctx) {
      readStyles();
      buildGeometry();
      render();
      // Wait for the display face before drawing: the year ticks are set in
      // JetBrains Mono and a swap mid-animation would reflow them.
      const go = () => drawIn();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
      else go();
    }
    watchTallies();
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
