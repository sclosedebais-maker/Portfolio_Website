/* ============================================================================
   AGENTIC UNDERWRITING — STAGE DEMO ENGINE
   ─────────────────────────────────────────────────────────────────────────
   The ten-minute script is the source of truth. BEATS below is that script,
   encoded: each entry owns a timecode, the screen it belongs to, and what the
   surface should be showing when the presenter reaches it.

   Two ways to drive it, because a stage needs both:
     · Play — the clock runs and beats fire on their own timecodes.
     · Step — arrow keys or the transport buttons move beat to beat, and the
       clock snaps to the beat's own time. A presenter who is talking long
       never gets overtaken by their own demo.

   Keyboard: Space play/pause · ← → step · 1–4 jump act · R restart · S script
   ============================================================================ */

(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = (t) => 1 - Math.pow(1 - t, 3);
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ══ The script ═══════════════════════════════════════════════════════════ */

  const BEATS = [
    {
      id: '1a', t: 0, act: 1,
      cue: 'Today, $1.5M term policies sit in underwriter queues for six weeks while human experts read through hundreds of pages of unstructured medical records.',
    },
    {
      id: '1b', t: 75, act: 1,
      cue: "Let's fix that in 30 seconds, live. Here is the file — a hundred and twenty pages of attending physician statement.",
    },
    {
      id: '1c', t: 105, act: 1,
      cue: 'Drop it in. No pre-processing, no template, no one has seen this file before.',
    },
    {
      id: '2a', t: 120, act: 2,
      cue: 'Agent one is the parser. Watch the unstructured text light up as it lifts typed entities out of prose — and every one carries a page and paragraph back to the source.',
    },
    {
      id: '2b', t: 190, act: 2,
      cue: 'Agent two reasons over what agent one found. It has just spotted the interaction: elevated blood pressure alongside type 2 diabetes. That compounds. It applies a 1.15 multiplier without being asked.',
    },
    {
      id: '2c', t: 250, act: 2,
      cue: 'Agent three prices it. Base rate twelve-forty, table B placement, eighteen-sixty offered. That is a full pricing decision in the time it took me to say the sentence.',
    },
    {
      id: '3a', t: 300, act: 3,
      cue: 'Now the interesting part — the edge case. Agent two found something missing: the applicant declined the cholesterol draw on page twelve.',
    },
    {
      id: '3b', t: 360, act: 3,
      cue: 'It does not decline the policy and it does not stall the file. It drafts the request — precise, polite, one click — and the file stays open while the applicant walks into any collection centre.',
    },
    {
      id: '3c', t: 420, act: 3,
      cue: 'And the audit memo. Hover any debit and it jumps straight to page twelve, paragraph three. The underwriter verifies the machine in one movement — this is what makes it signable.',
    },
    {
      id: '4a', t: 480, act: 4,
      cue: 'Forty-five days becomes thirty seconds. Six hundred and fifty dollars of processing becomes twelve. A thirty percent abandonment rate goes to near zero, because nobody is waiting six weeks.',
    },
    {
      id: '4b', t: 555, act: 4,
      cue: "Agentic AI doesn't replace the underwriter — it gives them a team of clinical, risk, and administrative AI specialists running at machine speed, so they can sign off on complex policies in seconds.",
    },
  ];

  const RUNTIME = 600;   // ten minutes

  /* ══ The document ═════════════════════════════════════════════════════════
     Eight rendered pages of a synthetic chart. Body copy is drawn as rules;
     the lines that carry clinical facts are real text, so the parsing agent
     has something true to light up and the cross-references have somewhere to
     land. Nothing here describes a real person. */

  const PAGES = [
    { n: 6, paras: [{ rules: [90, 100, 70] }, { rules: [100, 45] }, { rules: [90, 100, 100, 60] }] },
    { n: 7, paras: [{ rules: [100, 80] }, { text: 'Review of systems unremarkable except as noted below. Family history: father, myocardial infarction at 62.' }, { rules: [90, 100, 55] }] },
    {
      n: 8,
      focus: true,
      paras: [
        { rules: [100, 70] },
        { text: 'Seated blood pressure <e id="bp">148/92 mmHg</e>, repeated after ten minutes at 146/90. Stage 2 hypertension; commenced perindopril 5mg daily.' },
        { rules: [90, 100, 45] },
        { text: 'Glycated haemoglobin <e id="hba1c">HbA1c 6.8%</e> (February). Type 2 diabetes, managed by diet and <e id="metformin">metformin 1000mg BD</e>. Review in six months.' },
        { rules: [100, 65] },
      ],
    },
    { n: 9, paras: [{ rules: [100, 90, 70] }, { rules: [80, 100] }, { rules: [100, 45] }] },
    { n: 10, paras: [{ rules: [90, 100] }, { rules: [100, 100, 55] }] },
    { n: 11, paras: [{ rules: [100, 70, 90] }, { rules: [45] }, { rules: [100, 80] }] },
    {
      n: 12,
      paras: [
        { rules: [100, 60] },
        { rules: [90, 100, 70] },
        { text: '<e id="lipids" warn>Patient declined lipid panel</e>; advised of implications and offered rebooking at a collection centre of their choosing.' },
        { rules: [100, 45] },
      ],
    },
    {
      n: 13,
      paras: [
        { text: 'Height 168cm, weight 88kg, <e id="bmi">BMI 31.2</e>. Non-smoker, nil alcohol dependence reported.' },
        { rules: [100, 90, 60] },
        { rules: [80] },
      ],
    },
  ];

  /* The parsing agent's payload, streamed a line at a time. */
  const PAYLOAD = [
    '{',
    '  "document": "APS_A2291_120pp.pdf",',
    '  "pages": 120,',
    '  "entities": [',
    '    { "type": "vital.bp",     "value": "148/92", "unit": "mmHg", "page": 8,  "para": 2 },',
    '    { "type": "lab.hba1c",    "value": 6.8,      "unit": "%",    "page": 8,  "para": 4 },',
    '    { "type": "med.antidiabetic", "value": "metformin 1000mg BD",    "page": 8,  "para": 4 },',
    '    { "type": "vital.bmi",    "value": 31.2,                     "page": 13, "para": 1 },',
    '    { "type": "gap.lipids",   "status": "refused",               "page": 12, "para": 3 }',
    '  ],',
    '  "confidence": 0.97',
    '}',
  ];

  /* Entity id → the chip the parser posts once it has lifted it. */
  const ENTITIES = [
    { id: 'bp', label: 'BP 148/92', page: 8, para: 2, at: 2200 },
    { id: 'hba1c', label: 'HbA1c 6.8%', page: 8, para: 4, at: 5200 },
    { id: 'metformin', label: 'Metformin 1000mg', page: 8, para: 4, at: 7600 },
    { id: 'bmi', label: 'BMI 31.2', page: 13, para: 1, at: 11000 },
    { id: 'lipids', label: 'Lipids refused', page: 12, para: 3, warn: true, at: 14000 },
  ];

  /* ══ Build the document panes ═════════════════════════════════════════════ */

  function renderPages(host) {
    if (!host) return;
    const frag = document.createDocumentFragment();

    PAGES.forEach((page) => {
      const el = document.createElement('article');
      el.className = 'page';
      el.dataset.page = String(page.n);

      const mark = document.createElement('p');
      mark.className = 'page-mark';
      mark.textContent = `Page ${page.n} · APS · A-2291`;
      el.appendChild(mark);

      page.paras.forEach((para, i) => {
        const idx = i + 1;
        if (para.text) {
          const p = document.createElement('p');
          p.className = 'line';
          p.dataset.para = String(idx);
          p.innerHTML = para.text.replace(
            /<e id="([\w-]+)"( warn)?>(.*?)<\/e>/g,
            (_m, id, warn, inner) =>
              `<span class="ent" data-ent="${id}"${warn ? ' data-warn="1"' : ''}>${inner}</span>`
          );
          el.appendChild(p);
        } else {
          const wrap = document.createElement('div');
          wrap.dataset.para = String(idx);
          wrap.style.display = 'grid';
          wrap.style.gap = '9px';
          para.rules.forEach((w) => {
            const r = document.createElement('span');
            r.className = 'rule';
            r.style.width = w + '%';
            wrap.appendChild(r);
          });
          el.appendChild(wrap);
        }
      });

      frag.appendChild(el);
    });

    host.appendChild(frag);
  }

  const docBody = $('#doc-body');
  const docBody2 = $('#doc-body-2');
  renderPages(docBody);
  renderPages(docBody2);

  /* ══ Cross-references ═════════════════════════════════════════════════════
     The affordance the whole audit story rests on: any citation anywhere jumps
     the document pane to its page and marks the paragraph. */

  let clearHit = null;

  function gotoSource(page, para, { pane } = {}) {
    const hosts = pane ? [pane] : [docBody, docBody2].filter(Boolean);

    hosts.forEach((host) => {
      const target = host.querySelector(`.page[data-page="${page}"]`);
      if (!target) return;

      host.scrollTo({
        top: target.offsetTop - host.offsetTop - 12,
        behavior: reduced.matches ? 'auto' : 'smooth',
      });

      $$('.page', host).forEach((p) => p.removeAttribute('data-focus'));
      target.setAttribute('data-focus', 'true');

      $$('.para-hit', host).forEach((p) => p.classList.remove('para-hit'));
      const hit = target.querySelector(`[data-para="${para}"]`);
      if (hit) hit.classList.add('para-hit');

      const label = host === docBody2 ? $('#doc-page-2') : $('#doc-page');
      if (label) label.textContent = String(page);
    });

    clearTimeout(clearHit);
    clearHit = setTimeout(() => {
      $$('.para-hit').forEach((p) => p.classList.remove('para-hit'));
    }, 6000);
  }

  function bindXrefs(scope) {
    $$('.xref', scope).forEach((link) => {
      const page = Number(link.dataset.page);
      const para = Number(link.dataset.para);
      const jump = (e) => {
        if (e) e.preventDefault();
        gotoSource(page, para);
      };
      link.addEventListener('click', jump);
      // The script asks for hover-to-source: an underwriter verifying a memo
      // should not have to click to see the evidence.
      link.addEventListener('mouseenter', () => gotoSource(page, para));
      link.addEventListener('focus', () => gotoSource(page, para));
    });
  }

  /* ══ Act 2 · the cascade ══════════════════════════════════════════════════ */

  const nodes = {
    1: $('.node[data-node="1"]'),
    2: $('.node[data-node="2"]'),
    3: $('.node[data-node="3"]'),
  };

  const STATE_TEXT = { idle: 'Queued', running: 'Running', done: 'Complete' };

  // What a finished agent leaves on the wall once it collapses.
  const STATE_SUM = {
    1: '5 entities · 0 unresolved · 97% confidence',
    2: 'Interaction detected · 1.15× applied',
    3: 'Table B · $1,860 offered',
  };

  function setNode(n, state) {
    const node = nodes[n];
    if (!node || node.dataset.state === state) return;
    node.dataset.state = state;

    const t = $('.node-state-t', node);
    if (t) t.textContent = STATE_TEXT[state];

    // A finished agent folds down to its result, so the next one in the chain
    // is on screen when the presenter gets to it. Click a head to reopen.
    const sum = $('.node-sum', node);
    if (sum) {
      sum.textContent = STATE_SUM[n] || '';
      sum.hidden = state !== 'done';
    }
    // A node folds when the *next* one takes over, not the moment it finishes:
    // the last agent to run is the one the presenter is talking about.
    if (state === 'running') {
      Object.values(nodes).forEach((other) => {
        if (other && other !== node) other.dataset.open = 'false';
      });
      node.dataset.open = 'true';
      showNode(node);
    }
  }

  // Keep the live agent in view inside the graph column.
  function showNode(node) {
    later(() => {
      node.scrollIntoView({
        block: 'nearest',
        behavior: reduced.matches ? 'auto' : 'smooth',
      });
    }, 260);
  }

  const timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearLater() { timers.splice(0).forEach(clearTimeout); }

  function colourJson(line) {
    return line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"([\w.]+)":/g, '"<span class="k">$1</span>":')
      .replace(/: ("(?:[^"]*)")/g, ': <span class="s">$1</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="n">$1</span>');
  }

  let parseRun = 0;

  function runParsingAgent() {
    const run = ++parseRun;
    const out = $('#json-out');
    const chips = $('#entity-chips');
    const scan = $('#doc-scan');
    const fill = $('#doc-fill');
    if (!out || !chips) return;

    out.innerHTML = '';
    chips.innerHTML = '';
    setNode(1, 'running');
    if (scan) scan.textContent = 'Parsing pages 6–13…';

    const total = 16000;
    const step = reduced.matches ? 0 : total / PAYLOAD.length;

    PAYLOAD.forEach((line, i) => {
      later(() => {
        if (run !== parseRun) return;
        out.insertAdjacentHTML('beforeend', colourJson(line) + '\n');
        out.scrollTop = out.scrollHeight;
      }, step * i);
    });

    ENTITIES.forEach((ent) => {
      later(() => {
        if (run !== parseRun) return;

        $$(`.ent[data-ent="${ent.id}"]`).forEach((el) => {
          el.dataset.lit = ent.warn ? 'warn' : 'true';
        });

        gotoSource(ent.page, ent.para, { pane: docBody });

        const li = document.createElement('li');
        li.innerHTML =
          `<b>${ent.label}</b> <a class="xref" href="#" data-page="${ent.page}" data-para="${ent.para}">p.${ent.page} &para;${ent.para}</a>`;
        chips.appendChild(li);
        bindXrefs(li);

        if (fill) {
          const done = (ENTITIES.indexOf(ent) + 1) / ENTITIES.length;
          fill.style.transform = `scaleX(${done.toFixed(3)})`;
        }
      }, reduced.matches ? 0 : ent.at);
    });

    later(() => {
      if (run !== parseRun) return;
      setNode(1, 'done');
      if (scan) scan.textContent = '5 entities · 0 unresolved · 97% confidence';
    }, reduced.matches ? 0 : 16500);
  }

  function stageReveals(scope, gap, from = 0) {
    const items = $$('[data-reveal]', scope);
    items.forEach((el) => {
      const order = Number(el.dataset.reveal);
      later(() => el.removeAttribute('data-held'), reduced.matches ? 0 : from + gap * (order - 1));
    });
  }

  /* ══ Tallies ══════════════════════════════════════════════════════════════
     They resolve to the value already printed in the markup — the DOM is the
     source, the animation is decoration. */

  function runTally(el) {
    if (el.dataset.done === '1') return;
    el.dataset.done = '1';
    const target = Number(el.dataset.to);
    if (!Number.isFinite(target) || reduced.matches) return;

    const group = el.dataset.group === '1';
    const start = performance.now();
    const DURATION = 900;

    const tick = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      const v = Math.round(target * EASE(t));
      el.textContent = group ? v.toLocaleString('en-AU') : String(v);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = group ? target.toLocaleString('en-AU') : String(target);
    };
    requestAnimationFrame(tick);
  }

  function runTallies(scope) {
    $$('.tally', scope).forEach(runTally);
  }

  /* ══ Beat application ═════════════════════════════════════════════════════ */

  const screens = $$('.screen');
  const drop = $('#drop');
  const dropFill = $('#drop-fill');
  const dropStatus = $('#drop-status');
  const countdown = $('#countdown');
  const countdownL = $('#countdown-l');

  let current = -1;

  function resetVisualState() {
    clearLater();
    parseRun++;

    screens.forEach((s) => $$('[data-reveal]', s).forEach((el) => (el.dataset.held = 'true')));
    [1, 2, 3].forEach((n) => {
      setNode(n, 'idle');
      const node = nodes[n];
      if (node) {
        node.removeAttribute('data-open');
        const sum = $('.node-sum', node);
        if (sum) sum.hidden = true;
      }
    });

    $$('.ent').forEach((el) => el.removeAttribute('data-lit'));
    $$('.page').forEach((el) => el.removeAttribute('data-focus'));
    $$('.para-hit').forEach((el) => el.classList.remove('para-hit'));
    $$('.tally').forEach((el) => el.removeAttribute('data-done'));

    const out = $('#json-out'); if (out) out.innerHTML = '';
    const chips = $('#entity-chips'); if (chips) chips.innerHTML = '';
    const fill = $('#doc-fill'); if (fill) fill.style.transform = 'scaleX(0)';
    const scan = $('#doc-scan'); if (scan) scan.textContent = 'Idle';

    if (drop) drop.dataset.state = 'idle';
    if (dropFill) dropFill.style.transform = 'scaleX(0)';
    if (countdown) countdown.textContent = '45';
    if (countdownL) countdownL.textContent = 'Days to issue';

    const sent = $('#draft-sent'); if (sent) sent.hidden = true;
    const send = $('#send'); if (send) { send.disabled = false; send.textContent = 'Send request'; }

    [docBody, docBody2].forEach((h) => h && h.scrollTo({ top: 0, behavior: 'auto' }));
  }

  function showScreen(act) {
    screens.forEach((s) => {
      const on = Number(s.dataset.screen) === act;
      if (on) s.dataset.on = 'true';
      else s.removeAttribute('data-on');
    });
    root.dataset.act = String(act);
  }

  function applyBeat(i, { rewound = false } = {}) {
    const beat = BEATS[i];
    if (!beat) return;

    // Stepping backwards has to unwind the surface, or the demo lies about
    // where it is. Cheapest correct answer: reset, then replay this beat.
    if (rewound) resetVisualState();

    current = i;
    root.dataset.beat = beat.id;
    showScreen(beat.act);
    markNotes(i);
    markActs(beat.act);

    switch (beat.id) {
      case '1a':
        break;

      case '1b':
        if (drop) drop.classList.add('is-ready');
        break;

      case '1c':
        ingest();
        break;

      case '2a':
        if (drop) drop.dataset.state = 'active';
        runParsingAgent();
        break;

      case '2b':
        setNode(1, 'done');
        setNode(2, 'running');
        stageReveals(nodes[2], 2600);
        break;

      case '2c':
        setNode(1, 'done');
        setNode(2, 'done');
        setNode(3, 'running');
        stageReveals(nodes[3], 2400);
        later(() => {
          runTallies(nodes[3]);
          setNode(3, 'done');
        }, reduced.matches ? 0 : 10500);
        break;

      case '3a':
        stageReveals($('.panel-flag'), 0);
        gotoSource(12, 3, { pane: docBody2 });
        break;

      case '3b':
        $$('.panel-flag, .panel-draft').forEach((p) => p.removeAttribute('data-held'));
        break;

      case '3c':
        $$('.panel').forEach((p) => p.removeAttribute('data-held'));
        break;

      case '4a':
        stageReveals($('.value-grid'), 900);
        later(() => runTallies($('.value-grid')), reduced.matches ? 0 : 1200);
        break;

      case '4b':
        $$('.value-grid [data-reveal]').forEach((el) => el.removeAttribute('data-held'));
        runTallies($('.value-grid'));
        break;
    }
  }

  /* The upload, and the countdown collapsing from 45 days to 30 seconds — the
     one moment in Act 1 that has to feel physical. */
  function ingest() {
    if (!drop) return;
    drop.dataset.state = 'active';

    if (reduced.matches) {
      if (dropFill) dropFill.style.transform = 'scaleX(1)';
      if (dropStatus) dropStatus.textContent = 'Uploaded · handing to the parsing agent';
      if (countdown) countdown.textContent = '30s';
      if (countdownL) countdownL.textContent = 'Time to issue';
      return;
    }

    const started = performance.now();
    const DURATION = 2400;

    const tick = (now) => {
      const t = Math.min((now - started) / DURATION, 1);
      if (dropFill) dropFill.style.transform = `scaleX(${EASE(t).toFixed(4)})`;
      if (countdown) {
        const days = Math.max(0, Math.round(45 - 45 * EASE(t)));
        countdown.textContent = t < 1 ? String(days) : '30s';
        // The unit changes with the number, or the label starts lying.
        if (countdownL) countdownL.textContent = t < 1 ? 'Days to issue' : 'Time to issue';
      }
      if (dropStatus) {
        dropStatus.textContent = t < 0.55 ? 'Uploading…'
          : t < 1 ? 'Splitting pages · 120 of 120'
          : 'Uploaded · handing to the parsing agent';
      }
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ══ Transport ════════════════════════════════════════════════════════════ */

  let clock = 0;
  let playing = false;
  let lastFrame = 0;

  const clockEl = $('#clock');
  const railFill = $('#rail-fill');
  const playBtn = $('#play');

  function fmt(s) {
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  function paint() {
    if (clockEl) clockEl.textContent = fmt(clock);
    if (railFill) railFill.style.transform = `scaleX(${(clock / RUNTIME).toFixed(4)})`;
  }

  function beatAt(time) {
    let idx = 0;
    for (let i = 0; i < BEATS.length; i++) if (time >= BEATS[i].t) idx = i;
    return idx;
  }

  function frame(now) {
    if (!playing) return;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    clock = Math.min(clock + dt, RUNTIME);
    paint();

    const want = beatAt(clock);
    if (want !== current) applyBeat(want, { rewound: want < current });

    if (clock >= RUNTIME) pause();
    else requestAnimationFrame(frame);
  }

  function play() {
    if (playing) return;
    playing = true;
    root.dataset.playing = 'true';
    if (playBtn) { playBtn.setAttribute('aria-pressed', 'true'); playBtn.setAttribute('aria-label', 'Pause the demo'); }
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  function pause() {
    playing = false;
    root.dataset.playing = 'false';
    if (playBtn) { playBtn.setAttribute('aria-pressed', 'false'); playBtn.setAttribute('aria-label', 'Play the demo'); }
  }

  function toggle() { playing ? pause() : play(); }

  function goTo(i, { keepPlaying = true } = {}) {
    const idx = Math.max(0, Math.min(i, BEATS.length - 1));
    const rewound = idx <= current;
    clock = BEATS[idx].t;
    paint();
    applyBeat(idx, { rewound });
    if (!keepPlaying) pause();
  }

  function restart() {
    pause();
    clock = 0;
    paint();
    resetVisualState();
    current = -1;
    applyBeat(0);
  }

  /* ══ Act rail and presenter notes ═════════════════════════════════════════ */

  const actItems = $$('#acts li');

  function markActs(act) {
    actItems.forEach((li) => {
      if (Number(li.dataset.act) === act) li.dataset.on = 'true';
      else li.removeAttribute('data-on');
    });
  }

  const notes = $('#notes');
  const notesList = $('#notes-list');

  function buildNotes() {
    if (!notesList) return;
    BEATS.forEach((beat, i) => {
      const li = document.createElement('li');
      li.dataset.i = String(i);
      li.innerHTML = `<span class="notes-t">${fmt(beat.t)}</span><span>${beat.cue}</span>`;
      li.addEventListener('click', () => goTo(i, { keepPlaying: false }));
      notesList.appendChild(li);
    });
  }

  function markNotes(i) {
    if (!notesList) return;
    $$('li', notesList).forEach((li) => {
      const on = Number(li.dataset.i) === i;
      if (on) {
        li.dataset.on = 'true';
        if (!notes.hidden) li.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
      } else {
        li.removeAttribute('data-on');
      }
    });
  }

  function toggleNotes(force) {
    if (!notes) return;
    const open = typeof force === 'boolean' ? force : notes.hidden;
    notes.hidden = !open;
    const btn = $('#notes-toggle');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) markNotes(current);
  }

  /* ══ Wiring ═══════════════════════════════════════════════════════════════ */

  $('#play')?.addEventListener('click', toggle);
  $('#next')?.addEventListener('click', () => goTo(current + 1));
  $('#prev')?.addEventListener('click', () => goTo(current - 1));
  $('#notes-toggle')?.addEventListener('click', () => toggleNotes());
  $('#notes-close')?.addEventListener('click', () => toggleNotes(false));

  // The dropzone is a real affordance: click it, or drop any file on it, and
  // the demo advances. Nothing is uploaded or read.
  if (drop) {
    drop.addEventListener('click', () => { if (drop.dataset.state === 'idle') goTo(2); });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.state = 'idle'; drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      goTo(2);
    });
  }

  // Channel tabs on the drafted request.
  const tabs = [$('#tab-sms'), $('#tab-email')].filter(Boolean);
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    });
  });

  $('#send')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Sent';
    const sent = $('#draft-sent');
    if (sent) sent.hidden = false;
  });

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case ' ': case 'Spacebar': e.preventDefault(); toggle(); break;
      case 'ArrowRight': case 'PageDown': e.preventDefault(); goTo(current + 1); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); goTo(current - 1); break;
      case '1': case '2': case '3': case '4': {
        const act = Number(e.key);
        const first = BEATS.findIndex((b) => b.act === act);
        if (first >= 0) goTo(first);
        break;
      }
      case 'r': case 'R': restart(); break;
      case 's': case 'S': toggleNotes(); break;
      case 'Escape': toggleNotes(false); break;
    }
  });

  /* ══ Start ════════════════════════════════════════════════════════════════ */

  // A presenter who gets a question about an earlier agent can reopen it.
  Object.values(nodes).forEach((node) => {
    if (!node) return;
    const head = $('.node-head', node);
    if (!head) return;
    head.style.cursor = 'pointer';
    head.addEventListener('click', () => {
      if (node.dataset.state === 'idle') return;
      node.dataset.open = node.dataset.open === 'true' ? 'false' : 'true';
    });
  });

  bindXrefs(document);
  buildNotes();
  resetVisualState();
  paint();
  applyBeat(0);
})();
