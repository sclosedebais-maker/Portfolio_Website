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

  /* Browser speech-to-text, used for point-and-click dictation on text fields.
     Absent on some browsers (notably Firefox); the mic buttons are simply not
     rendered when it is unavailable. */
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const SPEECH_OK = !!SpeechRec;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* Which questions feed each derived fit dimension — shown in the spider
     diagram's explanation so the link to the yes/no answers is explicit. */
  const FIT_SOURCES = {
    complexity: ['Rules/knowledge decisions', 'Repetitive analysis', 'Multiple sources', 'Pain level'],
    systems: ['Number of systems', 'Multiple sources'],
    handoffs: ['Number of handoffs', 'Work moves between people'],
    decisions: ['Rules/knowledge decisions', 'Approvals', 'Repetitive analysis'],
    knowledge: ['Rules/knowledge decisions', 'Multiple sources', 'Creates documents'],
    docGeneration: ['Creates documents', 'Rules/knowledge decisions'],
    multiStep: ['Multiple sources', 'Work moves between people', 'Number of handoffs'],
    humanIntervention: ['Approvals', 'Outcomes checkable automatically (lowers this)']
  };

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

  /* The live results are a blank slate on a fresh assessment. The moment the
     user genuinely begins — reaches the current-state stage, or edits any
     figure or driver — the panel and the floating orb come to life and start
     building up. This is what makes each new discovery feel like a clean start. */
  function markStarted() {
    if (state.meta.pristine) { state.meta.pristine = false; save(); }
  }
  const isPristine = () => state.meta.pristine;

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

    if (isPristine()) {
      host.innerHTML = `
        <div class="panel-blank">
          <div class="panel-blank-orb" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="56" height="56"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--brand)" stroke-width="6" stroke-linecap="round" stroke-dasharray="8 200" transform="rotate(-90 32 32)"/></svg>
          </div>
          <p class="panel-blank-title">A blank slate</p>
          <p class="panel-blank-note">Your results build here as you answer. Nothing is calculated yet — start the assessment and watch the value come together.</p>
        </div>`;
      updateOrb(true);
      return;
    }

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
    updateOrb(false);
  }

  /* -------------------------------------------------------------------------
     Floating value orb — a small, fixed summary that scrolls with the reader
     the whole way down the page, counting up as the case comes together. It is
     the "rewarding progress" companion to the side panel, and stays visible on
     narrow screens where the side panel drops below the fold.
     ---------------------------------------------------------------------- */

  let orbEl = null;
  let orbLastValue = 0;
  function ensureOrb() {
    if (orbEl) return orbEl;
    orbEl = document.createElement('button');
    orbEl.id = 'value-orb';
    orbEl.className = 'value-orb';
    orbEl.type = 'button';
    orbEl.setAttribute('aria-label', 'Jump to results dashboard');
    orbEl.innerHTML = `
      <svg class="orb-ring" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
        <circle cx="36" cy="36" r="31" fill="none" stroke="var(--line)" stroke-width="5"/>
        <circle class="orb-ring-fill" cx="36" cy="36" r="31" fill="none" stroke="var(--brand)" stroke-width="5" stroke-linecap="round" transform="rotate(-90 36 36)"/>
      </svg>
      <span class="orb-inner">
        <span class="orb-label">Annual value</span>
        <span class="orb-value" data-orb-value>—</span>
        <span class="orb-sub" data-orb-sub>fit — · ROI —</span>
      </span>`;
    orbEl.addEventListener('click', () => { markStarted(); goto(indexOf('results')); });
    document.body.appendChild(orbEl);
    return orbEl;
  }

  function updateOrb(pristine) {
    const orb = ensureOrb();
    const stepId = STEPS[stepIndex] ? STEPS[stepIndex].id : '';
    // The orb is redundant on welcome and on the results/output pages themselves.
    const hide = stepId === 'welcome' || stepId === 'results' || stepId === 'output';
    orb.classList.toggle('is-hidden', hide);
    orb.setAttribute('aria-hidden', hide ? 'true' : 'false');
    if (hide) return;

    const ring = orb.querySelector('.orb-ring-fill');
    const C = 2 * Math.PI * 31;
    const valEl = orb.querySelector('[data-orb-value]');
    const subEl = orb.querySelector('[data-orb-sub]');

    if (pristine) {
      ring.setAttribute('stroke-dasharray', `${(0.02 * C).toFixed(1)} ${C.toFixed(1)}`);
      valEl.textContent = '—';
      subEl.textContent = 'ready when you are';
      orbLastValue = 0;
      return;
    }

    const r = result;
    const target = r.ben.annualBenefit;
    const completion = Math.max(0.04, r.completeness || completionFraction());
    ring.setAttribute('stroke-dasharray', `${(completion * C).toFixed(1)} ${C.toFixed(1)}`);
    subEl.textContent = `fit ${Math.round(r.fit.score)} · ROI ${fmt.percent(r.fin.roi)}`;

    if (target > orbLastValue + 1) {
      orb.classList.remove('orb-reward'); void orb.offsetWidth; orb.classList.add('orb-reward');
    }
    countUp(valEl, orbLastValue, target);
    orbLastValue = target;
  }

  /* Rough completion for the ring when the engine does not supply one. */
  function completionFraction() {
    const total = STEPS.length - 1;
    return Math.min(1, Math.max(stepIndex, 1) / total);
  }

  let countRaf = null;
  function countUp(node, from, to) {
    if (prefersReducedMotion()) { node.textContent = fmt.moneyShort(to); return; }
    const start = performance.now(), dur = 520;
    if (countRaf) cancelAnimationFrame(countRaf);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt.moneyShort(from + (to - from) * eased);
      if (p < 1) countRaf = requestAnimationFrame(tick);
    };
    countRaf = requestAnimationFrame(tick);
  }
  const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        control = `<div class="ta-wrap">
          <textarea id="${id}" data-key="${f.key}" rows="${f.rows || 6}" placeholder="${fmt.escapeHtml(f.placeholder || '')}">${fmt.escapeHtml(val || '')}</textarea>
          <div class="field-tools">${micButton(id)}${f.attach ? attachButton(id, f.attach) : ''}</div>
        </div>${f.liveHint ? liveHintSlot(f) : ''}`;
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
        control = `<div class="input-wrap${SPEECH_OK ? ' has-mic' : ''}">
          <input id="${id}" data-key="${f.key}" type="text" value="${fmt.escapeHtml(val || '')}" placeholder="${fmt.escapeHtml(f.placeholder || '')}">
          ${micButton(id, true)}</div>`;
    }

    return `<div class="${wrapCls}" data-field="${f.key}">${labelHtml}${control}<span class="field-error" hidden></span>${help}</div>`;
  }

  /* Point-and-click dictation button. Rendered only when the browser supports
     speech recognition; otherwise typing is unaffected. */
  function micButton(targetId, inline) {
    if (!SPEECH_OK) return '';
    return `<button type="button" class="dictate-btn${inline ? ' inline' : ''}" data-dictate="${targetId}" aria-label="Dictate this field" title="Click to dictate — speak and AIVA types it for you">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
      <span class="dictate-label">Dictate</span></button>`;
  }

  /* Attach a document (strategy). Text files are read straight into the field;
     other files have their name noted. Nothing is uploaded. */
  function attachButton(targetId, kind) {
    return `<label class="attach-btn" title="Attach a document — its text is read into this field, in your browser only">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      <span>Attach</span>
      <input type="file" data-attach="${kind}" data-attach-target="${targetId}" accept=".txt,.md,.csv,.rtf,.json,.html,.docx,.pdf" hidden></label>`;
  }

  function liveHintSlot(f) {
    return `<div class="live-hint" data-live-hint="${f.liveHint}" hidden></div>`;
  }

  function sliderControl(f, id, val) {
    return richSlider(f.key, val, { min: f.min, max: f.max, step: f.step || 1, unit: f.unit || '', id: id });
  }

  /* A slider with a filled track, a prominent live value and min/max ticks.
     Shared by the schema sliders and the value-driver sliders. The fill width
     is driven by the CSS var --pct, set here and kept in step on input. */
  function richSlider(key, val, o) {
    const min = o.min != null ? o.min : 0, max = o.max != null ? o.max : 100;
    const unit = o.unit || '';
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    const idAttr = o.id ? ` id="${o.id}"` : '';
    const fmtEnd = (v) => (unit === '%' ? v + '%' : (o.currencyTicks ? fmt.moneyShort(v) : v + (unit ? ' ' + unit : '')));
    return `<div class="slider" data-slider style="--pct:${pct.toFixed(1)}%">
      <div class="slider-row">
        <input${idAttr} data-key="${key}" type="range" min="${min}" max="${max}" step="${o.step || 1}" value="${val}" aria-valuetext="${val}${unit}">
        <output class="slider-value" data-slider-out>${val}${unit}</output>
      </div>
      <div class="slider-scale"><span>${fmtEnd(min)}</span><span>${fmtEnd(max)}</span></div>
    </div>`;
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
        updateSliderVisual(t);
        setValue(t.dataset.key, +t.value);
        if (t.dataset.key.indexOf('drivers.') === 0) liveDriverRefresh();
      } else if (t.dataset.key !== undefined && t.tagName !== 'SELECT') {
        const raw = (t.type === 'number') ? (t.value === '' ? 0 : +t.value) : t.value;
        setValue(t.dataset.key, raw);
        if (t.dataset.key.indexOf('drivers.') === 0) liveDriverRefresh();
      }
    });

    host.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.attach !== undefined) { handleAttach(t); return; }
      if (t.tagName === 'SELECT' && t.dataset.key !== undefined) {
        setValue(t.dataset.key, t.value);
        const note = host.querySelector(`[data-note-for="${t.id}"]`);
        const f = findField(t.dataset.key);
        if (note && f && f.optionNotes) note.textContent = f.optionNotes[t.value] || '';
        if (t.dataset.key === 'meta.currency') { renderStep(); }
      }
    });

    host.addEventListener('click', (e) => {
      const mic = e.target.closest('[data-dictate]');
      if (mic) { startDictation(mic); return; }
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

  /* Keep a slider's filled track and readout in step as it moves. */
  function updateSliderVisual(input) {
    const f = findField(input.dataset.key);
    const unit = (f && f.unit) || (input.closest('[data-slider]') ? inferUnit(input) : '');
    const wrap = input.closest('.slider');
    const min = +input.min, max = +input.max, v = +input.value;
    if (wrap) wrap.style.setProperty('--pct', (max > min ? ((v - min) / (max - min)) * 100 : 0).toFixed(1) + '%');
    const out = wrap ? wrap.querySelector('[data-slider-out]') : null;
    if (out) out.textContent = v + unit;
  }
  function inferUnit(input) {
    const out = input.closest('.slider').querySelector('[data-slider-out]');
    const m = out && out.textContent.match(/[^\d.\-]+$/);
    return m ? m[0] : '';
  }

  /* Live-refresh the value-drivers stage as a slider or figure moves: each
     driver's own value, its share bar, the running total, the capacity note
     and the benefit chart — so the money visibly moves with the input. */
  function liveDriverRefresh() {
    const r = result;
    r.ben.lines.forEach((line) => {
      const box = canvas().querySelector(`[data-driver-value="${line.key}"]`);
      if (!box) return;
      const share = r.ben.annualBenefit > 0 ? line.value / r.ben.annualBenefit : 0;
      const amount = box.querySelector('[data-driver-amount]');
      const shareEl = box.querySelector('[data-driver-share]');
      const contrib = box.querySelector('[data-driver-contrib]');
      const basis = box.querySelector('[data-driver-basis]');
      if (amount) amount.textContent = fmt.money(line.value);
      if (shareEl) shareEl.textContent = Math.round(share * 100) + '% of total';
      if (contrib) contrib.style.width = Math.round(share * 100) + '%';
      if (basis) basis.textContent = line.basis;
    });
    const totalEl = canvas().querySelector('[data-total-benefit]');
    if (totalEl) totalEl.textContent = fmt.money(r.ben.annualBenefit);
    const capNote = canvas().querySelector('[data-capacity-note]');
    if (capNote) capNote.textContent = r.ben.capacityFte > 0 ? r.ben.capacityFte.toFixed(1) + ' FTE of capacity returned, without removing staff' : '';
    const bars = canvas().querySelector('[data-benefit-bars]');
    if (bars) bars.innerHTML = A.charts.benefitBars(r.ben.lines);
  }

  function findField(key) {
    for (const s of STEPS) {
      if (!s.groups) continue;
      for (const g of s.groups) { const f = g.fields.find((x) => x.key === key); if (f) return f; }
    }
    return null;
  }

  /* Keys that carry numbers into the model — editing one begins the assessment
     and brings the blank-slate live panel to life. Discovery free text and the
     cover details deliberately do not, so the panel stays a clean slate until
     there is something real to calculate. */
  const NUMERIC_PREFIX = /^(current|drivers|invest)\./;
  const startsIfNumeric = (key) => { if (NUMERIC_PREFIX.test(key)) markStarted(); };

  function setValue(key, value) {
    set(key, value);
    startsIfNumeric(key);
    recompute();
    validateField(key);
    if (key === 'discovery.success') updateSuccessHint();
  }

  function pickScale(btn) {
    const key = btn.dataset.scale, v = +btn.dataset.value;
    set(key, v);
    startsIfNumeric(key);
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
    startsIfNumeric(key);
    btn.closest('.scale-row').querySelectorAll('.scale-btn').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.value === v));
    recompute();
  }

  function pickCurrencyChoice(btn) {
    const key = btn.dataset.cchoice, v = +btn.dataset.value;
    set(key, v);
    startsIfNumeric(key);
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
    markStarted();
    state.drivers[key].on = !state.drivers[key].on;
    recompute(); renderStep();
  }
  function toggleSuitability(key) {
    markStarted();
    state.suitability[key] = !state.suitability[key];
    recompute(); renderStep();
  }

  function applySuggestions() {
    markStarted();
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
      <div class="signal" style="grid-template-columns:auto 1fr">
        <span class="signal-dot" style="background:var(--ink-3)"></span>
        <div>
          <h4>AIVA reads this as ${a.workflowType ? fmt.escapeHtml(a.workflowType.toLowerCase()) : 'knowledge work'}</h4>
          <p>${a.agenticPattern ? 'Likely pattern: <strong>' + fmt.escapeHtml(a.agenticPattern) + '</strong> — ' + fmt.escapeHtml(a.patternWhy) : 'Keep describing the work and AIVA will suggest the agent pattern that fits.'}</p>
        </div>
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
        <div class="card-head"><h2>Agentic fit score</h2><p>Derived from your seven answers above and the current-state baseline. The score decides whether this is agent-shaped work.</p></div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:1.5rem;align-items:center">
          ${dial(r.fit.score, 132)}
          <div>
            <span class="chip ${band.tone}" style="font-size:.8rem;margin-bottom:.5rem">${fmt.escapeHtml(band.label)}</span>
            <p style="color:var(--ink-2);margin-bottom:.6rem">${fmt.escapeHtml(band.note)}</p>
            <p class="muted" style="font-size:.85rem">Interpretation: 90–100 Ideal · 70–89 Strong candidate · 50–69 Copilot candidate · below 50 traditional automation better.</p>
          </div>
        </div>

        <div class="radar-layout">
          <figure style="margin:0">
            <div class="chart-scroll" style="max-width:440px;margin:0 auto">${A.charts.fitRadar(r.fit.dimensions, { interactive: true })}</div>
            <figcaption><strong>Drag any point</strong> to adjust that dimension. The reading updates below.</figcaption>
          </figure>
          <div class="radar-key">
            <h3>How to read this</h3>
            <ul class="radar-key-list">
              <li><span class="rk-mark"></span><span>Each <strong>spoke</strong> is one of the eight scoring dimensions.</span></li>
              <li><span class="rk-line"></span><span>The <strong>further a point sits from the centre</strong>, the more that dimension favours an agent. The four rings mark the 1–5 scale.</span></li>
              <li><span class="rk-fill"></span><span>The <strong>orange shape</strong> is this workflow's profile. A large, even shape is ideal agentic work; a small or spiky one points to a copilot or traditional automation.</span></li>
            </ul>
            <p class="radar-key-note">The shape is built from your <strong>seven yes/no answers</strong> above and the systems, handoffs and pain figures from the current-state stage — it is not a separate questionnaire. Hover a point to see which answers drive it. <strong>Human intervention is inverse:</strong> the more a person must stay in the loop, the shorter that spoke and the lower the fit.</p>
            <div class="radar-readout" id="radar-readout" aria-live="polite"></div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Adjust the dimensions <span style="font-weight:400;font-size:.85rem;color:var(--ink-3)">— optional</span></h2>
          <p>AIVA derived each dimension from your answers. Override any that you know better by clicking a number or dragging on the diagram; your value is used in the score.</p></div>
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
        <div class="card-head"><h2>Total quantified benefit</h2><p>The sum of the drivers you have switched on, calculated from your baseline at full run rate. Slide any input below and watch this total move.</p></div>
        <div style="display:flex;flex-wrap:wrap;gap:1.5rem;align-items:center;justify-content:space-between">
          <div class="stat"><span class="stat-label">Annual benefit</span><span class="stat-value" data-total-benefit>${fmt.money(total)}</span>
            <span class="stat-note" data-capacity-note>${r.ben.capacityFte > 0 ? r.ben.capacityFte.toFixed(1) + ' FTE of capacity returned, without removing staff' : ''}</span></div>
          <div style="flex:1;min-width:280px" data-benefit-bars>${A.charts.benefitBars(r.ben.lines)}</div>
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
    const share = line && r.ben.annualBenefit > 0 ? line.value / r.ben.annualBenefit : 0;
    const valueLine = meta.quantified && on && line
      ? `<div class="driver-value" data-driver-value="${meta.key}">
           <div class="driver-value-head">
             <span>Annual value</span>
             <b data-driver-amount>${fmt.money(line.value)}</b>
             <span class="driver-share" data-driver-share>${Math.round(share * 100)}% of total</span>
           </div>
           <div class="driver-contrib"><div class="driver-contrib-fill" data-driver-contrib style="width:${Math.round(share * 100)}%;background:${swatch}"></div></div>
           <span class="muted driver-basis" data-driver-basis style="font-size:.78rem">${fmt.escapeHtml(line.basis)}</span>
         </div>`
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
        ${richSlider(key, val, { min: o.min || 0, max: o.max || 100, step: o.step || 5, unit: o.unit || '%' })}</div>`;
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
          <div class="ta-wrap">
            <textarea id="f_drivers_strategic_note" data-key="drivers.strategic.note" rows="3" placeholder="e.g. Builds internal agentic capability the enterprise strategy names as a priority; augments a workforce we cannot easily grow.">${fmt.escapeHtml(get('drivers.strategic.note') || '')}</textarea>
            <div class="field-tools">${micButton('f_drivers_strategic_note')}</div>
          </div></div>`;
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
    stopDictation();
    canvas().innerHTML = html;
    canvas().scrollIntoView({ behavior: 'auto', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    wireFitButtons();
    if (step.id === 'fit') wireRadar();
    if (step.id === 'discovery') updateSuccessHint();
    updatePanel();
  }

  /* -------------------------------------------------------------------------
     Interactive spider diagram — drag a vertex to override a fit dimension
     ---------------------------------------------------------------------- */

  function wireRadar() {
    const svg = canvas().querySelector('svg.radar.is-interactive');
    if (!svg) return;
    const cx = +svg.dataset.cx, cy = +svg.dataset.cy, R = +svg.dataset.r;
    const shape = svg.querySelector('.radar-shape');
    const readout = el('#radar-readout');
    const invertMap = {}; FIT_DIMENSIONS.forEach((d) => { invertMap[d.key] = d.invert; });

    // Map a client point into the SVG's own coordinate system.
    const toLocal = (evt) => {
      const p = svg.createSVGPoint();
      p.x = evt.clientX; p.y = evt.clientY;
      const m = svg.getScreenCTM();
      return m ? p.matrixTransform(m.inverse()) : { x: evt.clientX, y: evt.clientY };
    };

    let drag = null;

    const vertexAt = (i, frac) => {
      const angle = (Math.PI * 2 * i) / (+svg.dataset.n) - Math.PI / 2;
      return [cx + Math.cos(angle) * R * frac, cy + Math.sin(angle) * R * frac];
    };

    const redrawShape = () => {
      const verts = [...svg.querySelectorAll('.radar-vertex')]
        .sort((a, b) => (+a.dataset.vi) - (+b.dataset.vi))
        .map((v) => `${(+v.getAttribute('cx')).toFixed(1)},${(+v.getAttribute('cy')).toFixed(1)}`)
        .join(' ');
      shape.setAttribute('points', verts);
    };

    const fracToRaw = (frac, invert) =>
      clamp(invert ? Math.round((1 - frac) * 4) + 1 : Math.round(frac * 4) + 1, 1, 5);

    svg.querySelectorAll('.radar-handle').forEach((handle) => {
      handle.style.cursor = 'grab';
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const i = +handle.dataset.radarI;
        const key = handle.dataset.dim;
        handle.setPointerCapture(e.pointerId);
        handle.style.cursor = 'grabbing';
        svg.classList.add('is-dragging');
        drag = { i, key, invert: invertMap[key],
          vertex: svg.querySelector(`.radar-vertex[data-vi="${i}"]`), value: null };
      });
      handle.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const loc = toLocal(e);
        const angle = (Math.PI * 2 * drag.i) / (+svg.dataset.n) - Math.PI / 2;
        // Project the pointer onto the spoke and snap to the nearest ring.
        const proj = (loc.x - cx) * Math.cos(angle) + (loc.y - cy) * Math.sin(angle);
        let frac = clamp(proj / R, 0, 1);
        frac = Math.round(frac * 4) / 4;
        const [vx, vy] = vertexAt(drag.i, frac);
        drag.vertex.setAttribute('cx', vx.toFixed(1));
        drag.vertex.setAttribute('cy', vy.toFixed(1));
        handle.setAttribute('cx', vx.toFixed(1));
        handle.setAttribute('cy', vy.toFixed(1));
        redrawShape();
        drag.value = fracToRaw(frac, drag.invert);
        const dim = FIT_DIMENSIONS.find((d) => d.key === drag.key);
        if (readout) readout.innerHTML = `<strong>${fmt.escapeHtml(dim.label)}</strong> set to <b class="num">${drag.value}</b> of 5${drag.invert ? ' <span class="muted">(inverse — lower favours an agent)</span>' : ''}. Release to apply.`;
      });
      const finish = (e) => {
        if (!drag) return;
        handle.style.cursor = 'grab';
        svg.classList.remove('is-dragging');
        const d = drag; drag = null;
        try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        if (d.value != null) {
          markStarted();
          state.fitOverrides[d.key] = d.value;
          recompute();
          renderStep();
        }
      };
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
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
    if (stepIndex >= indexOf('current')) markStarted();
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
    s.meta = { caseName: 'Agentic claims triage', organisation: 'Northbridge Mutual', sponsor: 'Chief Operating Officer', preparedBy: 'Transformation Office', currency: 'AUD', pristine: false };
    s.discovery.strategyText = 'Become a digital-first insurer by 2027. Grow claims capacity without growing headcount. Reduce operational and compliance risk in regulated processes. Build internal AI and automation capability.';
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
     Dictation — point-and-click speech to text on any text field
     ---------------------------------------------------------------------- */

  let recog = null;
  let dictState = null;   // { targetId, btn, base, finalText }

  function stopDictation() {
    if (recog) { try { recog.stop(); } catch (e) { /* already stopped */ } }
  }

  function startDictation(btn) {
    const targetId = btn.dataset.dictate;
    const field = document.getElementById(targetId);
    if (!field) return;

    // Clicking the active mic stops it.
    if (dictState && dictState.targetId === targetId) { stopDictation(); return; }
    stopDictation();

    recog = new SpeechRec();
    recog.lang = document.documentElement.lang || 'en-AU';
    recog.interimResults = true;
    recog.continuous = true;

    const base = field.value ? field.value.replace(/\s+$/, '') + ' ' : '';
    dictState = { targetId, btn, base, finalText: '' };
    setMicState(btn, true);
    announceMic('Listening — speak now. Click the mic again to stop.');

    recog.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) dictState.finalText += chunk;
        else interim += chunk;
      }
      field.value = (dictState.base + dictState.finalText + interim).replace(/\s{2,}/g, ' ');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    recog.onerror = (e) => {
      announceMic(e.error === 'not-allowed'
        ? 'Microphone blocked. Allow microphone access in your browser to dictate.'
        : 'Dictation stopped.');
    };
    recog.onend = () => {
      if (dictState) setMicState(dictState.btn, false);
      dictState = null;
    };
    try { recog.start(); }
    catch (e) { setMicState(btn, false); dictState = null; }
  }

  function setMicState(btn, on) {
    btn.classList.toggle('is-recording', on);
    const label = btn.querySelector('.dictate-label');
    if (label) label.textContent = on ? 'Listening…' : 'Dictate';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function announceMic(msg) { toast(msg); }

  /* -------------------------------------------------------------------------
     Attach a document into a text field (in-browser only)
     ---------------------------------------------------------------------- */

  function handleAttach(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const target = document.getElementById(input.dataset.attachTarget);
    const kind = input.dataset.attach;
    const textLike = /\.(txt|md|csv|rtf|json|html?)$/i.test(file.name) || /^text\//.test(file.type) || file.type === 'application/json';

    if (kind === 'strategy') set('discovery.strategyDocName', file.name);

    if (textLike) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '').replace(/\r/g, '').trim();
        if (target) {
          const existing = target.value ? target.value.replace(/\s+$/, '') + '\n\n' : '';
          target.value = existing + text;
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        toast('Loaded “' + file.name + '” into the field. Edit it as you like.');
      };
      reader.onerror = () => toast('Could not read that file.');
      reader.readAsText(file);
    } else {
      // Binary formats (Word, PDF) can't be parsed without a library; note the
      // attachment and prompt the reader to paste the key points.
      recompute();
      toast('Attached “' + file.name + '”. It can\'t be read automatically — paste or dictate the key strategy points so AIVA can use them.');
    }
    input.value = '';
  }

  /* -------------------------------------------------------------------------
     Success-question live hint — nudge toward a measurable target
     ---------------------------------------------------------------------- */

  function updateSuccessHint() {
    const slot = canvas().querySelector('[data-live-hint="quantify-success"]');
    if (!slot) return;
    const text = String(get('discovery.success') || '');
    const hasNumber = /\d/.test(text) || /\b(half|double|triple|quarter|third)\b/i.test(text);
    const enough = text.trim().length >= 20;
    if (!enough || hasNumber) { slot.hidden = true; return; }
    slot.hidden = false;
    slot.innerHTML = `<span class="live-hint-icon" aria-hidden="true">↳</span>
      <span><strong>Add a number if you can.</strong> "Reduce manual effort" is a fine aim, but a measurable target — like "cut turnaround from 5 days to 1" or "reduce effort by 60%" — becomes a testable benefit in your business case. A qualitative aim still works if you don't have one.</span>`;
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
