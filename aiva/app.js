/* ============================================================================
   AIVA — app.js
   The wizard controller. Owns state, navigation, rendering and the live panel.
   Renders every ordinary field from the schema; the five custom stages
   (welcome, agentic fit, value drivers, results, business case) are built by
   dedicated renderers below.
   ============================================================================ */

(function () {
  'use strict';

  const A = window.AIVA;
  const { STEPS, FIT_DIMENSIONS, FIT_BANDS, DRIVERS, SUITABILITY,
    AGENTIC_PATTERNS, SALARY_BANDS } = A.schema;
  const fmt = A.fmt;
  const STORAGE_KEY = 'aiva.state.v2';

  /* -------------------------------------------------------------------------
     State
     ---------------------------------------------------------------------- */

  let state = load() || A.schema.defaultState();
  let stepIndex = 0;
  let maxVisited = 0;
  let result = null;
  let analysis = null;

  fmt.setCurrency(state.meta.currency);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2) return deepMerge(A.schema.defaultState(), parsed);
    } catch (e) { /* corrupt or unavailable — start fresh */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function deepMerge(base, over) {
    Object.keys(over).forEach((k) => {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k]) deepMerge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }

  const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
  const set = (path, value) => {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => (o[k] = o[k] || {}), state);
    obj[last] = value;
  };

  /* -------------------------------------------------------------------------
     Recompute — the single source of derived truth
     ---------------------------------------------------------------------- */

  function recompute() {
    fmt.setCurrency(state.meta.currency);
    analysis = A.reasoning.analyse(state);
    result = A.engine.evaluate(state);
    updatePanel();
    updateRail();
    refreshAnalysisLive();
    save();
  }

  /* Keep the discovery analysis card in step with the free text without
     re-rendering the whole canvas (which would drop focus from the textarea). */
  function refreshAnalysisLive() {
    if (STEPS[stepIndex] && STEPS[stepIndex].id !== 'discovery') return;
    const host = el('#discovery-analysis');
    if (!host) return;
    const fresh = document.createElement('div');
    fresh.innerHTML = renderAnalysis();
    const next = fresh.firstElementChild;
    if (next) host.replaceWith(next);
  }

  /* -------------------------------------------------------------------------
     Elements
     ---------------------------------------------------------------------- */

  const el = (sel) => document.querySelector(sel);
  const canvas = () => el('#canvas');
  const railSteps = () => el('#rail-steps');

  /* -------------------------------------------------------------------------
     Progress rail
     ---------------------------------------------------------------------- */

  function buildRail() {
    const host = railSteps();
    host.innerHTML = STEPS.map((s, i) => `
      <button class="rail-step" data-step="${i}" type="button">
        <span class="rail-step-num">${i === 0 ? '★' : i}</span>
        <span>
          <span class="rail-step-label">${fmt.escapeHtml(s.label)}</span>
          <span class="rail-step-note">${fmt.escapeHtml(s.note || '')}</span>
        </span>
      </button>`).join('');
    host.querySelectorAll('.rail-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.step;
        if (i <= maxVisited) goto(i);
      });
    });
  }

  function updateRail() {
    const total = STEPS.length - 1;              // welcome is not counted
    const answered = Math.max(0, Math.min(stepIndex, total));
    const pct = Math.round((answered / total) * 100);
    el('#rail-pct').textContent = pct + '%';
    el('#rail-fill').style.width = pct + '%';

    railSteps().querySelectorAll('.rail-step').forEach((btn, i) => {
      btn.classList.toggle('is-done', i < stepIndex && i <= maxVisited);
      btn.disabled = i > maxVisited;
      if (i === stepIndex) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
  }

  /* -------------------------------------------------------------------------
     Live value panel
     ---------------------------------------------------------------------- */

  function updatePanel() {
    const r = result;
    const host = el('#panel-body');
    const rec = r.rec;
    const paybackTxt = fmt.months(r.fin.paybackMonths);

    host.innerHTML = `
      <div class="stat">
        <span class="stat-label">Potential annual value</span>
        <span class="stat-value" id="pv-annual">${fmt.money(r.ben.annualBenefit)}</span>
        <span class="stat-note">${r.ben.capacityFte > 0 ? r.ben.capacityFte.toFixed(1) + ' FTE of capacity returned' : 'at full run rate'}</span>
      </div>
      <div class="stat-pair">
        <div class="stat">
          <span class="stat-label">Agentic fit</span>
          <span class="stat-value sm">${Math.round(r.fit.score)}<span style="font-size:.6em;color:var(--ink-3)">/100</span></span>
          <span class="stat-note">${fmt.escapeHtml(r.fit.band.label)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">ROI</span>
          <span class="stat-value sm">${fmt.percent(r.fin.roi)}</span>
          <span class="stat-note">Payback ${fmt.escapeHtml(paybackTxt)}</span>
        </div>
      </div>
      ${meter('Business value', r.value.score)}
      ${meter('Confidence', r.conf.score)}
      <div class="stat">
        <span class="stat-label">Recommendation</span>
        <span class="stat-value sm" style="font-size:1.05rem;color:${toneColor(rec.tone)}">${fmt.escapeHtml(rec.stage === 'Reshape' || rec.stage === 'Discovery' ? rec.verdict : 'Proceed to ' + rec.stage)}</span>
      </div>
      <div class="panel-flag">${fmt.escapeHtml(panelHint())}</div>`;
  }

  function meter(label, score) {
    return `<div class="meter">
      <div class="meter-top"><span>${fmt.escapeHtml(label)}</span><b>${Math.round(score)}/100</b></div>
      <div class="meter-track"><div class="meter-fill" style="width:${Math.round(score)}%;background:${scoreColor(score)}"></div></div>
    </div>`;
  }

  function panelHint() {
    const step = STEPS[stepIndex].id;
    if (step === 'welcome') return 'These figures update live as you answer. Start with the discovery questions on the left.';
    if (step === 'discovery') return analysis.depth.note;
    if (step === 'current') return 'Every benefit is calculated from these baseline figures. The panel above is already responding.';
    if (step === 'fit') return result.fit.band.note;
    if (step === 'drivers') return result.ben.concentration > 0.7 ? 'Most of the value sits in one driver — worth diversifying or validating it hard.' : 'Turn drivers on and off to see each one\'s contribution.';
    if (step === 'invest') return 'Your confidence answers feed the confidence score above and shape the recommendation.';
    return 'Assessment complete. Review the dashboard and export the business case.';
  }

  const scoreColor = (s) => s >= 60 ? 'var(--good)' : s >= 45 ? 'var(--warn)' : 'var(--serious)';
  const toneColor = (t) => t === 'good' ? 'var(--good)' : t === 'warn' ? 'var(--warn-strong,var(--warn))' : t === 'serious' ? 'var(--serious)' : 'var(--ink)';

  /* -------------------------------------------------------------------------
     Field renderers
     ---------------------------------------------------------------------- */

  function renderField(f) {
    const val = get(f.key);
    const id = 'f_' + f.key.replace(/\./g, '_');
    const help = f.help ? `<span class="field-help">${fmt.escapeHtml(f.help)}</span>` : '';
    const req = f.required ? ' <span aria-hidden="true" style="color:var(--brand-ink)">*</span>' : '';
    const labelHtml = `<label for="${id}">${fmt.escapeHtml(f.label)}${req}</label>`;
    const wrapCls = 'field' + (f.span ? ' span-2' : '');
    let control = '';

    switch (f.type) {
      case 'textarea':
        control = `<textarea id="${id}" data-key="${f.key}" rows="${f.rows || 6}" placeholder="${fmt.escapeHtml(f.placeholder || '')}">${fmt.escapeHtml(val || '')}</textarea>`;
        break;
      case 'select':
        control = `<select id="${id}" data-key="${f.key}">${f.options.map((o) =>
          `<option${o === val ? ' selected' : ''}>${fmt.escapeHtml(o)}</option>`).join('')}</select>`;
        if (f.optionNotes) control += `<span class="field-help" data-note-for="${id}">${fmt.escapeHtml(f.optionNotes[val] || '')}</span>`;
        break;
      case 'scale':
        return scaleField(f, id, val, labelHtml, help, wrapCls);
      case 'slider':
        control = sliderControl(f, id, val);
        break;
      case 'choice':
        return choiceField(f, id, val, labelHtml, help, wrapCls);
      case 'currency-choice':
        return currencyChoiceField(f, id, val, labelHtml, help, wrapCls);
      case 'currency':
        control = `<div class="input-wrap has-pre"><span class="affix affix-pre">${fmt.escapeHtml(fmt.symbol())}</span>
          <input id="${id}" data-key="${f.key}" type="number" inputmode="numeric" min="${f.min || 0}" step="${f.step || 1}" value="${val}"></div>`;
        break;
      case 'number':
        control = `<div class="input-wrap${f.unit ? ' has-post' : ''}">
          <input id="${id}" data-key="${f.key}" type="number" inputmode="decimal" min="${f.min != null ? f.min : 0}"${f.max != null ? ` max="${f.max}"` : ''} step="${f.step || 1}" value="${val}">
          ${f.unit ? `<span class="affix affix-post">${fmt.escapeHtml(f.unit)}</span>` : ''}</div>`;
        break;
      default: /* text */
        control = `<input id="${id}" data-key="${f.key}" type="text" value="${fmt.escapeHtml(val || '')}" placeholder="${fmt.escapeHtml(f.placeholder || '')}">`;
    }

    return `<div class="${wrapCls}" data-field="${f.key}">${labelHtml}${control}<span class="field-error" hidden></span>${help}</div>`;
  }

  function sliderControl(f, id, val) {
    return `<div class="slider-row">
      <input id="${id}" data-key="${f.key}" type="range" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${val}">
      <span class="slider-value" data-slider-out="${id}">${val}${f.unit || ''}</span></div>`;
  }

  function scaleField(f, id, val, labelHtml, help, wrapCls) {
    const btns = [1, 2, 3, 4, 5].map((v) =>
      `<button type="button" class="scale-btn" role="radio" aria-checked="${v === val}" aria-pressed="${v === val}" data-scale="${f.key}" data-value="${v}">${v}</button>`).join('');
    const caption = f.captions ? `<span class="scale-caption" data-caption="${f.key}"><strong>${val}</strong> · ${fmt.escapeHtml(f.captions[val - 1] || '')}</span>` : '';
    return `<div class="${wrapCls}" data-field="${f.key}"><span class="field-label">${labelHtml.replace(/^<label[^>]*>|<\/label>$/g, '')}</span>
      <div class="scale" role="radiogroup" aria-label="${fmt.escapeHtml(f.label)}"><div class="scale-row">${btns}</div>${caption}</div>${help}</div>`;
  }

  function choiceField(f, id, val, labelHtml, help, wrapCls) {
    const btns = f.options.map((o) =>
      `<button type="button" class="scale-btn" style="flex:1" aria-pressed="${o === val}" data-choice="${f.key}" data-value="${fmt.escapeHtml(o)}">${fmt.escapeHtml(o)}</button>`).join('');
    return `<div class="${wrapCls}" data-field="${f.key}"><span class="field-label">${fmt.escapeHtml(f.label)}</span>
      <div class="scale"><div class="scale-row" style="flex-wrap:wrap;gap:.4rem">${btns}</div></div>${help}</div>`;
  }

  function currencyChoiceField(f, id, val, labelHtml, help, wrapCls) {
    const isPreset = f.options.indexOf(val) !== -1;
    const btns = f.options.map((o) =>
      `<button type="button" class="scale-btn" style="flex:1;min-width:90px" aria-pressed="${o === val}" data-cchoice="${f.key}" data-value="${o}">${fmt.symbol()}${Math.round(o / 1000)}k</button>`).join('');
    const custom = `<div class="input-wrap has-pre" style="margin-top:.5rem"><span class="affix affix-pre">${fmt.symbol()}</span>
      <input data-key="${f.key}" type="number" min="0" step="5000" value="${val}" aria-label="${fmt.escapeHtml(f.label)} custom value"></div>`;
    return `<div class="${wrapCls}" data-field="${f.key}"><span class="field-label">${fmt.escapeHtml(f.label)}</span>
      <div class="scale"><div class="scale-row" style="flex-wrap:wrap">${btns}</div></div>${custom}
      <span class="field-help">${f.unit ? fmt.escapeHtml(f.unit) + '. ' : ''}${f.help ? fmt.escapeHtml(f.help) : ''}</span></div>`;
  }

  /* Render a group of fields into a card. */
  function renderGroup(g) {
    return `<section class="card">
      <div class="card-head"><h2>${fmt.escapeHtml(g.title)}</h2>${g.blurb ? `<p>${fmt.escapeHtml(g.blurb)}</p>` : ''}</div>
      <div class="field-grid">${g.fields.map(renderField).join('')}</div>
    </section>`;
  }

  /* -------------------------------------------------------------------------
     Wiring — one delegated set of listeners for the whole canvas
     ---------------------------------------------------------------------- */

  function wireCanvas() {
    const host = canvas();

    host.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.key !== undefined && (t.type === 'range')) {
        const out = host.querySelector(`[data-slider-out="${t.id}"]`);
        const f = findField(t.dataset.key);
        if (out) out.textContent = t.value + (f && f.unit ? f.unit : '');
        setValue(t.dataset.key, +t.value);
      } else if (t.dataset.key !== undefined && t.tagName !== 'SELECT') {
        const raw = (t.type === 'number') ? (t.value === '' ? 0 : +t.value) : t.value;
        setValue(t.dataset.key, raw);
      }
    });

    host.addEventListener('change', (e) => {
      const t = e.target;
      if (t.tagName === 'SELECT' && t.dataset.key !== undefined) {
        setValue(t.dataset.key, t.value);
        const note = host.querySelector(`[data-note-for="${t.id}"]`);
        const f = findField(t.dataset.key);
        if (note && f && f.optionNotes) note.textContent = f.optionNotes[t.value] || '';
        if (t.dataset.key === 'meta.currency') { renderStep(); }
      }
    });

    host.addEventListener('click', (e) => {
      const scale = e.target.closest('[data-scale]');
      if (scale) { pickScale(scale); return; }
      const choice = e.target.closest('[data-choice]');
      if (choice) { pickChoice(choice); return; }
      const cchoice = e.target.closest('[data-cchoice]');
      if (cchoice) { pickCurrencyChoice(cchoice); return; }
      const act = e.target.closest('[data-action]');
      if (act) { handleAction(act.dataset.action, act); }
    });
  }

  function findField(key) {
    for (const s of STEPS) {
      if (!s.groups) continue;
      for (const g of s.groups) { const f = g.fields.find((x) => x.key === key); if (f) return f; }
    }
    return null;
  }

  function setValue(key, value) {
    set(key, value);
    recompute();
    validateField(key);
  }

  function pickScale(btn) {
    const key = btn.dataset.scale, v = +btn.dataset.value;
    set(key, v);
    const group = btn.closest('.scale-row');
    group.querySelectorAll('.scale-btn').forEach((b) => {
      const on = +b.dataset.value === v;
      b.setAttribute('aria-checked', on); b.setAttribute('aria-pressed', on);
    });
    const cap = btn.closest('.field').querySelector('[data-caption]');
    const f = findField(key);
    if (cap && f && f.captions) cap.innerHTML = `<strong>${v}</strong> · ${fmt.escapeHtml(f.captions[v - 1] || '')}`;
    recompute();
  }

  function pickChoice(btn) {
    const key = btn.dataset.choice, v = btn.dataset.value;
    set(key, v);
    btn.closest('.scale-row').querySelectorAll('.scale-btn').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.value === v));
    recompute();
  }

  function pickCurrencyChoice(btn) {
    const key = btn.dataset.cchoice, v = +btn.dataset.value;
    set(key, v);
    const field = btn.closest('.field');
    field.querySelectorAll('[data-cchoice]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.value === v));
    const input = field.querySelector('input[data-key]');
    if (input) input.value = v;
    recompute();
  }

  /* -------------------------------------------------------------------------
     Validation
     ---------------------------------------------------------------------- */

  function validateField(key) {
    const f = findField(key);
    if (!f) return true;
    const wrap = canvas().querySelector(`[data-field="${cssEscape(key)}"]`);
    if (!wrap) return true;
    const err = wrap.querySelector('.field-error');
    let message = '';
    const val = get(key);
    if (f.required) {
      if (f.type === 'textarea' || f.type === 'text') { if (!String(val || '').trim()) message = 'This is required.'; }
      else if (f.type === 'number' || f.type === 'currency') { if (!(+val > 0)) message = 'Enter a value greater than zero.'; }
    }
    if (!message && f.minLength && String(val || '').trim().length < f.minLength) {
      message = `A little more detail helps — at least ${f.minLength} characters.`;
    }
    wrap.classList.toggle('is-invalid', !!message);
    if (err) { err.textContent = message; err.hidden = !message; }
    return !message;
  }

  function cssEscape(s) { return s.replace(/([.:])/g, '\\$1'); }

  function validateStep() {
    const step = STEPS[stepIndex];
    if (!step.groups) return true;
    let ok = true, firstBad = null;
    step.groups.forEach((g) => g.fields.forEach((f) => {
      if (!validateField(f.key) && !firstBad) firstBad = f.key;
      if (firstBad === f.key) ok = false;
    }));
    if (firstBad) {
      const wrap = canvas().querySelector(`[data-field="${cssEscape(firstBad)}"]`);
      if (wrap) { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = wrap.querySelector('input,textarea,select'); if (inp) inp.focus({ preventScroll: true }); }
    }
    return ok;
  }

  /* -------------------------------------------------------------------------
     Actions (buttons inside custom steps)
     ---------------------------------------------------------------------- */

  function handleAction(action, node) {
    switch (action) {
      case 'start': goto(1); break;
      case 'apply-suggestions': applySuggestions(); break;
      case 'apply-classification': applyClassification(); break;
      case 'toggle-driver': toggleDriver(node.dataset.driver); break;
      case 'toggle-suit': toggleSuitability(node.dataset.suit); break;
      case 'reset-fit': state.fitOverrides = {}; recompute(); renderStep(); toast('Fit dimensions reset to AIVA\'s derived values.'); break;
      case 'export-word': A.exporter.downloadWord(state, result, analysis); toast('Word document downloaded.'); break;
      case 'export-pdf': A.exporter.downloadPdf(); break;
      case 'restart': restart(); break;
      case 'sample': loadSample(); break;
      case 'goto-results': goto(indexOf('results')); break;
    }
  }

  function toggleDriver(key) {
    state.drivers[key].on = !state.drivers[key].on;
    recompute(); renderStep();
  }
  function toggleSuitability(key) {
    state.suitability[key] = !state.suitability[key];
    recompute(); renderStep();
  }

  function applySuggestions() {
    analysis.suggestions.forEach((s) => set(s.path, s.value));
    state.appliedSuggestions = true;
    recompute();
    toast('AIVA\'s driver proposals applied. Adjust any of them on the next stage.');
    renderStep();
  }

  function applyClassification() {
    if (analysis.workflowType) set('discovery.workflowType', analysis.workflowType);
    if (analysis.agenticPattern) set('discovery.agenticPattern', analysis.agenticPattern);
    recompute(); renderStep();
    toast('Workflow classification applied from your description.');
  }

  /* -------------------------------------------------------------------------
     Custom step renderers
     ---------------------------------------------------------------------- */

  function renderWelcome() {
    return `
      <section class="hero">
        <p class="eyebrow">AIVA · Agentic AI Value Accelerator</p>
        <h1>Turn an idea for an agent into an investment-grade business case.</h1>
        <p class="lede">AIVA takes a business workflow and returns what an executive actually needs to make a call: the agentic fit, the value at stake, the return, and a clear recommendation — from a short guided assessment, not a spreadsheet.</p>
        <div class="hero-cta">
          <button class="btn btn-primary" data-action="start" type="button">Start the assessment →</button>
          <button class="btn btn-ghost" data-action="sample" type="button">Explore with a worked example</button>
        </div>
      </section>
      <div class="tiles">
        ${welcomeTile('01', 'Discovery in your words', 'Describe the workflow in plain language. AIVA reads it to identify the value drivers, workflow type and agent pattern that fit.')}
        ${welcomeTile('02', 'Eight questions on today', 'A tight current-state baseline — volume, effort, cost and shape. No spreadsheet, no forty-field form.')}
        ${welcomeTile('03', 'Seven questions on fit', 'Yes/no questions about the nature of the work produce an agentic fit score, including the honest "automation would be better" answer.')}
        ${welcomeTile('04', 'The value, made explicit', 'Productivity, capacity returned, quality, risk, revenue and customer benefit — each calculated from your baseline, never invented.')}
        ${welcomeTile('05', 'Confidence, not false precision', 'You tell AIVA how sure you are. That confidence is scored and shown, so the number is trusted rather than doubted.')}
        ${welcomeTile('06', 'An exportable case', 'An executive dashboard and a full business case, downloadable to Word and PDF, ready for the investment conversation.')}
      </div>
      <div class="notice" style="margin-top:1.25rem"><span></span><span><strong>Private by design.</strong> Everything runs in your browser. Nothing you type — including the workflow description — is sent anywhere.</span></div>`;
  }
  function welcomeTile(num, title, body) {
    return `<div class="tile"><span class="tile-num">${num}</span><h3>${title}</h3><p>${body}</p></div>`;
  }

  /* Discovery gets the ordinary groups plus the live AIVA analysis panel. */
  function renderAnalysis() {
    const a = analysis;
    const suggestions = a.suggestions.filter((s) => !s.silent);
    const signals = a.signals.slice(0, 5);

    const cls = a.workflowType || a.agenticPattern;
    const classBlock = cls ? `
      <div class="signal" style="grid-template-columns:1fr auto;align-items:center">
        <div>
          <h4>AIVA's classification</h4>
          <p>${a.workflowType ? 'Workflow type looks like <strong>' + fmt.escapeHtml(a.workflowType) + '</strong>. ' : ''}${a.agenticPattern ? 'Suggested pattern: <strong>' + fmt.escapeHtml(a.agenticPattern) + '</strong> — ' + fmt.escapeHtml(a.patternWhy) : ''}</p>
        </div>
        <button class="btn btn-ghost" style="white-space:nowrap" data-action="apply-classification" type="button">Apply</button>
      </div>` : '';

    const signalHtml = signals.length ? signals.map((s) =>
      `<div class="signal">
        <span class="signal-dot" style="background:var(--brand)"></span>
        <div><h4>${fmt.escapeHtml(s.label)}</h4><p>${fmt.escapeHtml(s.rationale)}</p>
        <span class="signal-terms">matched: ${s.terms.map(fmt.escapeHtml).join(', ')}</span></div>
      </div>`).join('') : `<div class="notice"><span></span><span>Write a little more and AIVA will identify the value drivers worth testing.</span></div>`;

    const gaps = a.gaps.length ? `<div class="notice warn" style="margin-top:.9rem"><span></span><span><strong>Worth adding:</strong> ${fmt.escapeHtml(a.gaps[0])}</span></div>` : '';

    const suggestBtn = suggestions.length ? `
      <div style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center">
        <button class="btn btn-primary" data-action="apply-suggestions" type="button">Apply ${suggestions.length} driver proposal${suggestions.length > 1 ? 's' : ''}</button>
        <span class="stepnav-hint">${suggestions.map((s) => fmt.escapeHtml(s.label)).join(' · ')}</span>
      </div>` : '';

    return `<section class="card" id="discovery-analysis">
      <div class="analysis" style="margin-top:0">
        <div class="analysis-head">
          <span class="brand-mark" style="width:30px;height:30px;font-size:.7rem">AI</span>
          <h3>AIVA is reading your description</h3>
          <span class="chip ${a.depth.score >= 70 ? 'good' : a.depth.score >= 45 ? 'warn' : 'serious'}">${fmt.escapeHtml(a.depth.level)} · ${a.words} words</span>
        </div>
        ${classBlock}
        <div class="signal-list" style="margin-top:${cls ? '.7rem' : '0'}">${signalHtml}</div>
        ${gaps}
        ${suggestBtn}
      </div>
    </section>`;
  }

  function renderFit() {
    const r = result;
    const answers = r.fit.answers;
    const suitCards = SUITABILITY.map((q) => {
      const on = state.suitability[q.key];
      return `<div class="driver ${on ? 'is-on' : ''}">
        <div class="driver-head" data-action="toggle-suit" data-suit="${q.key}" role="button" tabindex="0" aria-pressed="${on}">
          <div><h3>${fmt.escapeHtml(q.question)}</h3><p>${fmt.escapeHtml(q.help)}</p></div>
          <span class="switch" aria-checked="${on}" role="switch" aria-label="${fmt.escapeHtml(q.question)}"></span>
        </div>
        ${on ? `<div class="driver-value" style="margin-top:.7rem;border-top:1px dashed var(--line-strong);padding-top:.6rem"><span style="color:var(--good)">Yes — </span><span>${fmt.escapeHtml(q.yes)}</span></div>` : ''}
      </div>`;
    }).join('');

    const dims = r.fit.dimensions.map((d) => {
      const f = FIT_DIMENSIONS.find((x) => x.key === d.key);
      const scaleBtns = [1, 2, 3, 4, 5].map((v) =>
        `<button type="button" class="scale-btn" aria-pressed="${v === d.raw}" data-fit="${d.key}" data-value="${v}">${v}</button>`).join('');
      return `<div class="field" style="grid-column:auto">
        <span class="field-label">${fmt.escapeHtml(d.label)}${d.invert ? ' <span class="chip" style="font-size:.62rem">inverse</span>' : ''}</span>
        <div class="scale"><div class="scale-row">${scaleBtns}</div>
          <span class="scale-caption">${d.overridden ? '<strong>Adjusted</strong>' : '<strong>AIVA-derived</strong>'} · contributes ${Math.round(d.score * d.weight * 10) / 10} of 100</span></div>
        <span class="field-help">${fmt.escapeHtml(f.help)}</span>
      </div>`;
    }).join('');

    const band = r.fit.band;
    return `
      <section class="card">
        <div class="card-head"><h2>The seven questions</h2><p>Answer for the work as it is today. AIVA converts these into the eight scoring dimensions below.</p></div>
        <div style="display:grid;gap:.7rem">${suitCards}</div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Agentic fit score</h2><p>Derived from your answers and the current-state baseline. The score decides whether this is agent-shaped work.</p></div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:1.5rem;align-items:center">
          ${dial(r.fit.score, 132)}
          <div>
            <span class="chip ${band.tone}" style="font-size:.8rem;margin-bottom:.5rem">${fmt.escapeHtml(band.label)}</span>
            <p style="color:var(--ink-2);margin-bottom:.6rem">${fmt.escapeHtml(band.note)}</p>
            <p class="muted" style="font-size:.85rem">Interpretation: 90–100 Ideal · 70–89 Strong candidate · 50–69 Copilot candidate · below 50 traditional automation better.</p>
          </div>
        </div>
        <figure style="margin-top:1.5rem">
          <div class="chart-scroll" style="max-width:420px;margin:0 auto">${A.charts.fitRadar(r.fit.dimensions)}</div>
          <figcaption>The eight dimensions. Human intervention is scored inversely — more required means a lower fit.</figcaption>
        </figure>
      </section>

      <section class="card">
        <div class="card-head"><h2>Adjust the dimensions <span style="font-weight:400;font-size:.85rem;color:var(--ink-3)">— optional</span></h2>
          <p>AIVA derived each dimension from your answers. Override any that you know better; your value is used in the score.</p></div>
        <div class="field-grid">${dims}</div>
        <button class="btn btn-ghost" data-action="reset-fit" type="button" style="margin-top:1rem">Reset to AIVA's values</button>
      </section>`;
  }

  function renderDrivers() {
    const r = result;
    const cards = DRIVERS.map((meta) => driverCard(meta, r)).join('');
    const total = r.ben.annualBenefit;
    return `
      <section class="card">
        <div class="card-head"><h2>Total quantified benefit</h2><p>The sum of the drivers you have switched on, calculated from your baseline at full run rate.</p></div>
        <div style="display:flex;flex-wrap:wrap;gap:1.5rem;align-items:center;justify-content:space-between">
          <div class="stat"><span class="stat-label">Annual benefit</span><span class="stat-value">${fmt.money(total)}</span>
            <span class="stat-note">${r.ben.capacityFte > 0 ? r.ben.capacityFte.toFixed(1) + ' FTE of capacity returned, without removing staff' : ''}</span></div>
          <div style="flex:1;min-width:280px">${A.charts.benefitBars(r.ben.lines)}</div>
        </div>
      </section>
      <div style="display:grid;gap:1rem">${cards}</div>`;
  }

  function driverCard(meta, r) {
    const d = state.drivers[meta.key];
    const line = r.ben.lines.find((l) => l.key === meta.key);
    const on = d.on;
    const swatch = meta.series ? A.charts.seriesColor(meta.series) : 'var(--ink-3)';
    const inner = on ? driverInputs(meta) : '';
    const valueLine = meta.quantified && on && line
      ? `<div class="driver-value"><span>Annual value</span><b>${fmt.money(line.value)}</b><span class="muted" style="font-size:.78rem">${fmt.escapeHtml(line.basis)}</span></div>`
      : (!meta.quantified && on ? `<div class="driver-value"><span class="muted" style="font-size:.82rem">Carried qualitatively in the value score — never as a dollar figure.</span></div>` : '');

    return `<div class="driver ${on ? 'is-on' : ''}">
      <div class="driver-head" data-action="toggle-driver" data-driver="${meta.key}" role="button" tabindex="0" aria-pressed="${on}">
        <span class="driver-swatch" style="background:${swatch}"></span>
        <div><h3>${fmt.escapeHtml(meta.label)}</h3><p>${fmt.escapeHtml(meta.headline)}</p>
          <p class="muted" style="font-size:.76rem;margin-top:.25rem;font-family:var(--font-num)">${fmt.escapeHtml(meta.formula)}</p></div>
        <span class="switch" aria-checked="${on}" role="switch" aria-label="Toggle ${fmt.escapeHtml(meta.label)}"></span>
      </div>
      ${inner ? `<div class="driver-body">${inner}</div>` : ''}
      ${valueLine}
    </div>`;
  }

  function driverInputs(meta) {
    const mk = (key, label, opts) => {
      const val = get(key);
      const o = opts || {};
      if (o.slider) return `<div class="field"><span class="field-label">${label}</span>
        <div class="slider-row"><input data-key="${key}" type="range" min="${o.min || 0}" max="${o.max || 100}" step="${o.step || 5}" value="${val}">
        <span class="slider-value" data-slider-out="s_${key.replace(/\./g, '_')}">${val}${o.unit || '%'}</span></div></div>`;
      const pre = o.currency ? `<div class="input-wrap has-pre"><span class="affix affix-pre">${fmt.symbol()}</span>` : '<div class="input-wrap' + (o.unit ? ' has-post' : '') + '">';
      return `<div class="field"><span class="field-label">${label}</span>${pre}
        <input data-key="${key}" type="number" min="0" step="${o.step || 1}" value="${val}">${o.unit && !o.currency ? `<span class="affix affix-post">${o.unit}</span>` : ''}</div></div>`;
    };

    switch (meta.key) {
      case 'productivity':
        return mk('drivers.productivity.timeSaved', 'Handling-time reduction', { slider: true, max: 90 });
      case 'capacity':
        return mk('drivers.capacity.redeployShare', 'Freed hours booked as returned capacity', { slider: true, max: 100 })
          + `<div class="field"><span class="field-help">The remainder is taken as productivity cost reduction. Set to 100% if no headcount will be removed.</span></div>`;
      case 'quality':
        return mk('drivers.quality.errorRate', 'Current error / rework rate', { slider: true, max: 50 })
          + mk('drivers.quality.costPerError', 'Cost per error', { currency: true, step: 10 })
          + mk('drivers.quality.improvement', 'Expected error reduction', { slider: true, max: 100 });
      case 'risk':
        return mk('drivers.risk.incidentsPerYear', 'Risk incidents per year', { unit: 'events' })
          + mk('drivers.risk.costPerIncident', 'Cost per incident', { currency: true, step: 1000 })
          + mk('drivers.risk.reduction', 'Expected reduction', { slider: true, max: 100 });
      case 'revenue':
        return mk('drivers.revenue.annualUplift', 'Incremental annual revenue', { currency: true, step: 10000 })
          + mk('drivers.revenue.marginPct', 'Contribution margin', { slider: true, max: 100 });
      case 'customer':
        return mk('drivers.customer.valueAtRisk', 'Annual customer value at risk', { currency: true, step: 10000 })
          + mk('drivers.customer.retentionUplift', 'Share protected', { slider: true, max: 100 })
          + `<div class="field"><span class="field-label">Experience impact</span>
             <div class="scale"><div class="scale-row">${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="scale-btn" aria-pressed="${v === get('drivers.customer.experienceImpact')}" data-scale="drivers.customer.experienceImpact" data-value="${v}">${v}</button>`).join('')}</div></div></div>`;
      case 'strategic':
        return `<div class="field span-2"><span class="field-label">Strategic rationale <span style="font-weight:400;color:var(--ink-3)">— appears in the business case</span></span>
          <textarea data-key="drivers.strategic.note" rows="3" placeholder="e.g. Builds internal agentic capability the enterprise strategy names as a priority; augments a workforce we cannot easily grow.">${fmt.escapeHtml(get('drivers.strategic.note') || '')}</textarea></div>`;
      default: return '';
    }
  }

  function renderResults() {
    const r = result;
    const complexity = fmt.complexityBand(r.fit.score);
    const kpis = [
      { label: 'Potential annual value', value: fmt.moneyShort(r.ben.annualBenefit), note: 'At full run rate' },
      { label: 'Value confidence', value: Math.round(r.conf.score) + '%', note: fmt.band(r.conf.score).label + ' evidence base' },
      { label: 'Agentic AI fit', value: Math.round(r.fit.score) + '%', note: r.fit.band.label },
      { label: 'Complexity', value: complexity, note: 'To automate' },
      { label: 'Estimated delivery cost', value: fmt.moneyShort(r.fin.capex), note: '+ ' + fmt.moneyShort(r.fin.run) + '/yr run' },
      { label: 'Expected ROI', value: fmt.percent(r.fin.roi), note: r.fin.horizon + '-year horizon' },
      { label: 'Payback', value: fmt.months(r.fin.paybackMonths), note: r.fin.irr !== null ? 'IRR ' + fmt.percent(r.fin.irr) : 'From go-live' },
      { label: 'Net present value', value: fmt.moneyShort(r.fin.npv), note: 'At ' + fmt.percent(state.invest.discountRate) + ' discount' }
    ];

    const scoreCards = [
      { title: 'Agentic AI Fit', score: r.fit.score, note: r.fit.band.label },
      { title: 'Business Value', score: r.value.score, note: fmt.band(r.value.score).label + ' — weighted across six factors' },
      { title: 'Investment', score: r.invest.score, note: fmt.band(r.invest.score).label + ' — efficiency of the spend' },
      { title: 'Confidence', score: r.conf.score, note: fmt.band(r.conf.score).label + ' — evidence behind the numbers' }
    ].map((s) => `<div class="score">${dial(s.score, 76)}<div><h3>${s.title}</h3><p>${fmt.escapeHtml(s.note)}</p></div></div>`).join('');

    const capacity = r.ben.capacityHours > 0 ? `
      <section class="card" style="border-color:var(--brand);background:var(--brand-soft)">
        <div style="display:flex;flex-wrap:wrap;gap:1.5rem;align-items:center;justify-content:space-between">
          <div>
            <p class="eyebrow" style="margin-bottom:.4rem">The differentiator most tools miss</p>
            <h2 style="font-size:1.3rem;margin-bottom:.3rem">Capacity returned, not jobs removed</h2>
            <p style="color:var(--ink-2);max-width:52ch">Agentic AI more often creates capacity than eliminates roles. This case returns <strong>${fmt.number(r.ben.capacityHours)} hours</strong> a year — equivalent to <strong>${r.ben.capacityFte.toFixed(1)} FTE</strong> — redeployed to higher-value work without removing staff.</p>
          </div>
          <div class="stat" style="text-align:right"><span class="stat-value" style="font-size:2.6rem">${r.ben.capacityFte.toFixed(1)}</span><span class="stat-label">FTE equivalent returned</span></div>
        </div>
      </section>` : '';

    return `
      <div class="rec" style="border-left-color:${toneColor(r.rec.tone)}">
        <p class="eyebrow">AI Opportunity Value Assessment · Executive recommendation</p>
        <p class="rec-verdict" style="color:${toneColor(r.rec.tone)}">${fmt.escapeHtml(r.rec.verdict)}</p>
        <p>${fmt.escapeHtml(r.rec.stance)}</p>
      </div>

      <div class="kpi-grid">
        ${kpis.map((k) => `<div class="kpi"><span class="kpi-label">${fmt.escapeHtml(k.label)}</span><div class="kpi-value">${fmt.escapeHtml(k.value)}</div><span class="kpi-note">${fmt.escapeHtml(k.note)}</span></div>`).join('')}
      </div>

      ${capacity}

      <section class="card">
        <div class="card-head"><h2>Assessment scores</h2></div>
        <div class="score-grid">${scoreCards}</div>
      </section>

      <div class="chart-grid">
        <section class="card">
          <div class="card-head"><h2>Where the value comes from</h2></div>
          <div class="chart-scroll">${A.charts.benefitBars(r.ben.lines)}</div>
          ${A.charts.legend(r.ben.active.map((l) => ({ label: l.label, color: A.charts.seriesColor(l.series) })))}
          <details class="table-toggle"><summary>View as table</summary><div class="table-wrap">${A.charts.benefitTable(r.ben.lines)}</div></details>
        </section>
        <section class="card">
          <div class="card-head"><h2>Payback curve</h2></div>
          <div class="chart-scroll">${A.charts.cashflowLine(r.fin)}</div>
          <figcaption>Cumulative net cash flow. The line crosses zero at payback.</figcaption>
        </section>
        <section class="card">
          <div class="card-head"><h2>Value score composition</h2></div>
          <div class="chart-scroll">${A.charts.scoreBars(r.value.components)}</div>
          <figcaption>The weighted model: 25% financial · 20% agentic suitability · 15% strategic · 15% risk · 10% customer · 15% confidence.</figcaption>
        </section>
        <section class="card">
          <div class="card-head"><h2>Yearly benefit and run cost</h2></div>
          <div class="chart-scroll">${A.charts.yearlyColumns(r.fin)}</div>
          ${A.charts.legend([{ label: 'Benefit', color: 'var(--c3)' }, { label: 'Run cost', color: 'var(--c1)' }])}
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>Sensitivity</h2><p>How the return moves if the assumptions prove optimistic or conservative.</p></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Scenario</th><th class="num">ROI</th><th class="num">NPV</th><th class="num">Payback</th><th>Basis</th></tr></thead>
          <tbody>${r.sensitivity.map((s) => `<tr><td>${s.label}</td><td class="num">${fmt.percent(s.roi)}</td><td class="num">${fmt.money(s.npv)}</td><td class="num">${fmt.months(s.payback)}</td><td class="muted">${fmt.escapeHtml(s.note)}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>`;
  }

  function renderOutput() {
    const r = result;
    const meta = `
      <div class="doc-meta">
        ${state.meta.organisation ? `<span>Organisation<br><b>${fmt.escapeHtml(state.meta.organisation)}</b></span>` : ''}
        <span>Workflow<br><b>${fmt.escapeHtml(state.discovery.workflowName || '—')}</b></span>
        ${state.meta.sponsor ? `<span>Sponsor<br><b>${fmt.escapeHtml(state.meta.sponsor)}</b></span>` : ''}
        ${state.meta.preparedBy ? `<span>Prepared by<br><b>${fmt.escapeHtml(state.meta.preparedBy)}</b></span>` : ''}
        <span>Date<br><b>${fmt.escapeHtml(fmt.today())}</b></span>
        <span>Recommendation<br><b>${fmt.escapeHtml(r.rec.stage === 'Reshape' ? 'Reshape' : 'Proceed to ' + r.rec.stage)}</b></span>
      </div>`;

    return `
      <div class="no-print" style="margin-bottom:1.1rem">
        <div class="notice good"><span></span><span>Your business case is ready. Review it below, then download it for Word or PDF. Everything on this page is included in the export.</span></div>
      </div>
      <article class="doc" id="business-case">
        <div class="doc-band">
          <p class="eyebrow">AIVA · Agentic AI Value Accelerator</p>
          <h2>${fmt.escapeHtml(state.meta.caseName || 'Agentic AI Business Case')}</h2>
          <p>Business Case &amp; Value Assessment</p>
          ${meta}
        </div>
        <div class="doc-body">${A.exporter.buildBody(state, r, analysis, 'screen')}</div>
        <div class="export-bar no-print">
          <span class="note">Word opens in Microsoft Word or Google Docs. PDF uses your browser's print dialog — choose “Save as PDF”.</span>
          <button class="btn btn-primary" data-action="export-word" type="button">Download Word</button>
          <button class="btn btn-dark" data-action="export-pdf" type="button">Download PDF</button>
        </div>
      </article>
      <div class="no-print" style="margin-top:1.25rem;display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn btn-ghost" data-action="goto-results" type="button">← Back to dashboard</button>
        <button class="btn btn-ghost" data-action="restart" type="button">Start a new assessment</button>
      </div>`;
  }

  /* SVG donut dial for a 0–100 score. */
  function dial(score, size) {
    const s = Math.round(score);
    const r = (size - 16) / 2, c = 2 * Math.PI * r, cx = size / 2;
    const dash = (s / 100) * c;
    const color = s >= 70 ? 'var(--good)' : s >= 50 ? 'var(--brand)' : s >= 35 ? 'var(--warn)' : 'var(--serious)';
    return `<svg class="dial" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Score ${s} of 100">
      <circle class="dial-track" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke-width="10"/>
      <circle class="dial-fill" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke-width="10" stroke-linecap="round"
        stroke="${color}" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${cx} ${cx})"/>
      <text class="dial-num" x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central" style="font-size:${size * 0.26}px">${s}</text>
    </svg>`;
  }

  /* -------------------------------------------------------------------------
     Step rendering + navigation
     ---------------------------------------------------------------------- */

  function renderStep() {
    const step = STEPS[stepIndex];
    let html = '';

    if (step.id !== 'welcome') {
      html += `<div class="step-head">
        <p class="eyebrow">${fmt.escapeHtml(step.eyebrow || 'Results')}</p>
        <h1>${fmt.escapeHtml(step.title)}</h1>
        ${step.intro ? `<p>${fmt.escapeHtml(step.intro)}</p>` : ''}
      </div>`;
    }

    if (step.custom === 'welcome') html += renderWelcome();
    else if (step.custom === 'fit') html += renderFit();
    else if (step.custom === 'drivers') html += renderDrivers();
    else if (step.custom === 'results') html += renderResults();
    else if (step.custom === 'output') html += renderOutput();
    else if (step.groups) {
      html += step.groups.map(renderGroup).join('');
      if (step.id === 'discovery') html += renderAnalysis();
    }

    html += renderNav();
    canvas().innerHTML = html;
    canvas().scrollIntoView({ behavior: 'auto', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    wireFitButtons();
    updatePanel();
  }

  function wireFitButtons() {
    canvas().querySelectorAll('[data-fit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.fit, v = +btn.dataset.value;
        state.fitOverrides[key] = v;
        recompute(); renderStep();
      });
    });
    // keyboard toggle for driver/suitability header rows
    canvas().querySelectorAll('[data-action="toggle-driver"],[data-action="toggle-suit"]').forEach((row) => {
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });
    });
  }

  function renderNav() {
    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;
    const isWelcome = step.id === 'welcome';
    if (isWelcome) return '';
    const nextLabel = STEPS[stepIndex + 1] ? (STEPS[stepIndex + 1].id === 'results' ? 'See results →' : STEPS[stepIndex + 1].id === 'output' ? 'Generate business case →' : 'Continue →') : '';
    return `<nav class="stepnav no-print">
      <button class="btn btn-ghost" data-nav="prev" type="button">← Back</button>
      <div class="spacer"></div>
      <span class="stepnav-hint">Stage ${Math.min(stepIndex, 5)} of 5 · saved automatically</span>
      ${!isLast ? `<button class="btn btn-primary" data-nav="next" type="button">${nextLabel}</button>`
        : `<button class="btn btn-ghost" data-action="restart" type="button">Start over</button>`}
    </nav>`;
  }

  function goto(i) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, i));
    maxVisited = Math.max(maxVisited, stepIndex);
    recompute();
    renderStep();
  }
  const indexOf = (id) => STEPS.findIndex((s) => s.id === id);

  function next() {
    if (STEPS[stepIndex].groups && !validateStep()) { toast('A couple of fields need attention before continuing.'); return; }
    goto(stepIndex + 1);
  }
  function prev() { goto(stepIndex - 1); }

  /* -------------------------------------------------------------------------
     Reset / sample
     ---------------------------------------------------------------------- */

  function restart() {
    if (!confirm('Start a new assessment? This clears the current inputs.')) return;
    state = A.schema.defaultState();
    maxVisited = 0;
    fmt.setCurrency(state.meta.currency);
    goto(0);
    toast('Cleared. Ready for a new assessment.');
  }

  function loadSample() {
    state = sampleState();
    maxVisited = STEPS.length - 1;
    fmt.setCurrency(state.meta.currency);
    goto(indexOf('results'));
    toast('Loaded a worked example — an agentic claims-triage workflow.');
  }

  function sampleState() {
    const s = A.schema.defaultState();
    s.meta = { caseName: 'Agentic claims triage', organisation: 'Northbridge Mutual', sponsor: 'Chief Operating Officer', preparedBy: 'Transformation Office', currency: 'AUD' };
    s.discovery.problem = 'First-notification-of-loss claims take too long to triage. Consultants spend most of their time gathering information across systems rather than assessing the claim, and storm-season peaks create a backlog that drives complaints and SLA breaches.';
    s.discovery.currentWorkflow = 'A claim arrives by email or through the portal. A consultant opens the case in the claims system, re-keys the customer details from the PDF, checks the policy in the policy admin system and the customer history in the CRM, then reads the policy wording to decide whether the claim is in scope. Complex claims are escalated to a senior assessor, who drafts an assessment letter and sends it for approval. Volumes spike after storms and the backlog builds. Errors in policy interpretation cause rework and complaints.';
    s.discovery.success = 'Reduce triage handling time by 60% and clear the storm-season backlog without adding headcount.';
    s.discovery.workflowName = 'First-notification-of-loss triage';
    s.discovery.workflowType = 'Customer Service';
    s.discovery.agenticPattern = 'Human-in-the-Loop Agent';
    s.discovery.industry = 'Insurance';
    s.discovery.strategicAlignment = 4;
    s.current = { frequency: 'Daily', transactionsPerPeriod: 140, peopleInvolved: 12, minutesPerTransaction: 38, annualSalary: 120000, systemsBand: '4-6', handoffsBand: '1-3', painLevel: 4 };
    s.suitability = { multiSource: true, knowledgeDecisions: true, repetitiveAnalysis: true, approvals: true, movesBetweenPeople: true, createsDocuments: true, checkableOutcomes: true };
    s.drivers.productivity = { on: true, timeSaved: 55, benefits: ['Time savings', 'Faster decisions', 'Reduced research effort'] };
    s.drivers.capacity = { on: true, redeployShare: 55, benefits: ['Backlog cleared', 'Peak demand absorbed'] };
    s.drivers.quality = { on: true, errorRate: 8, costPerError: 260, improvement: 50, benefits: ['Reduced errors', 'Improved consistency'] };
    s.drivers.risk = { on: true, incidentsPerYear: 5, costPerIncident: 40000, reduction: 35, benefits: ['Compliance', 'Auditability'] };
    s.drivers.customer = { on: true, valueAtRisk: 900000, retentionUplift: 12, experienceImpact: 4, benefits: ['Faster response', 'Higher satisfaction'] };
    s.drivers.revenue = { on: false, annualUplift: 0, marginPct: 35, benefits: [] };
    s.drivers.strategic = { on: true, benefits: ['Workforce augmentation', 'Long-term capability'], note: 'Builds the agentic delivery capability named in the group technology strategy, and augments a claims workforce that is hard to scale in peak season.' };
    s.invest = { implementation: 420000, changeCost: 90000, annualRun: 110000, deployMonths: 5, adoptionY1: 55, discountRate: 9, horizonYears: 3, confidenceVolume: 'High', confidenceCost: 'Medium', confidenceBenefits: 'Medium' };
    return s;
  }

  /* -------------------------------------------------------------------------
     Tooltip layer (shared by all charts)
     ---------------------------------------------------------------------- */

  function initTooltip() {
    const tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    document.body.appendChild(tipEl);
    let raf = null;
    document.addEventListener('pointermove', (e) => {
      const host = e.target.closest('[data-tip]');
      if (!host) { tipEl.classList.remove('is-visible'); return; }
      tipEl.textContent = host.getAttribute('data-tip');
      tipEl.classList.add('is-visible');
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pad = 14;
        let x = e.clientX + pad, y = e.clientY + pad;
        const rect = tipEl.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - pad;
        if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - pad;
        tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
      });
    }, { passive: true });
    document.addEventListener('pointerleave', () => tipEl.classList.remove('is-visible'));
  }

  /* -------------------------------------------------------------------------
     Toast
     ---------------------------------------------------------------------- */

  let toastTimer = null;
  function toast(msg) {
    let t = el('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3600);
  }

  /* -------------------------------------------------------------------------
     Theme
     ---------------------------------------------------------------------- */

  function initTheme() {
    const KEY = 'aiva.theme';
    const stored = safeGet(KEY);
    if (stored) document.documentElement.setAttribute('data-theme', stored);
    const btn = el('#theme-toggle');
    const label = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
        || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      btn.querySelector('span').textContent = isDark ? 'Light' : 'Dark';
    };
    label();
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const isDark = cur === 'dark' || (!cur && matchMedia('(prefers-color-scheme: dark)').matches);
      const nextT = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextT);
      safeSet(KEY, nextT);
      label();
    });
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* -------------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  function init() {
    buildRail();
    initTheme();
    initTooltip();

    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { nav.dataset.nav === 'next' ? next() : prev(); }
    });
    el('#topbar-restart').addEventListener('click', restart);
    el('#topbar-sample').addEventListener('click', loadSample);

    wireCanvas();
    recompute();
    renderStep();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
