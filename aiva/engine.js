/* ============================================================================
   AIVA — engine.js
   The value model. Pure functions: state in, business case out. No DOM.

   The eight agentic fit dimensions are not asked directly. They are derived
   here from the seven suitability answers and the current-state bands, so the
   score reflects what the business owner actually told AIVA about the work.
   ============================================================================ */

window.AIVA = window.AIVA || {};

(function (AIVA) {
  'use strict';

  const S = AIVA.schema;
  const HOURS_PER_FTE_YEAR = 1720;
  const ONCOST = 1.30;                 // salary loading -> fully-burdened cost
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const n = (v) => (Number.isFinite(+v) ? +v : 0);
  const fromScale = (v) => clamp(((n(v) - 1) / 4) * 100, 0, 100);

  const lookup = (list, value, key) => (list.find((x) => x.value === value) || {})[key];

  /* --------------------------------------------------------------------------
     Derived current-state primitives
     ----------------------------------------------------------------------- */

  function baseline(state) {
    const c = state.current;
    const periods = lookup(S.FREQUENCIES, c.frequency, 'periodsPerYear') || 12;
    const cases = n(c.transactionsPerPeriod) * periods;
    const hours = (cases * n(c.minutesPerTransaction)) / 60;
    const hourlyCost = (n(c.annualSalary) * ONCOST) / HOURS_PER_FTE_YEAR;
    const labourCost = hours * hourlyCost;
    return {
      periodsPerYear: periods,
      casesPerYear: cases,
      hoursPerYear: hours,
      hourlyCost,
      fteConsumed: hours / HOURS_PER_FTE_YEAR,
      labourCost,
      costPerCase: cases > 0 ? labourCost / cases : 0,
      systemsCount: lookup(S.SYSTEM_BANDS, c.systemsBand, 'count') || 1,
      handoffsCount: lookup(S.HANDOFF_BANDS, c.handoffsBand, 'count') || 0
    };
  }

  /* --------------------------------------------------------------------------
     1. Derive the eight fit dimensions (1–5) from the answers.
     A user override on any dimension wins.
     ----------------------------------------------------------------------- */

  function deriveFitAnswers(state, base) {
    const su = state.suitability;
    const b01 = (v) => (v ? 1 : 0);
    const systemsScore = lookup(S.SYSTEM_BANDS, state.current.systemsBand, 'score') || 1;
    const handoffsScore = lookup(S.HANDOFF_BANDS, state.current.handoffsBand, 'score') || 1;
    const pain = n(state.current.painLevel);

    /* Each derivation returns a 1–5 answer grounded in concrete evidence. */
    const d = {
      complexity: 1 + b01(su.knowledgeDecisions) * 1.4 + b01(su.repetitiveAnalysis) * 0.6
        + b01(su.multiSource) * 0.8 + (pain >= 4 ? 0.8 : 0),
      systems: 0.5 + systemsScore * 0.7 + b01(su.multiSource) * 1.2,
      handoffs: 0.5 + handoffsScore * 0.7 + b01(su.movesBetweenPeople) * 1.3,
      decisions: 1 + b01(su.knowledgeDecisions) * 1.8 + b01(su.approvals) * 1.1 + b01(su.repetitiveAnalysis) * 0.6,
      knowledge: 1 + b01(su.knowledgeDecisions) * 1.6 + b01(su.multiSource) * 1.0 + b01(su.createsDocuments) * 0.6,
      docGeneration: 1 + b01(su.createsDocuments) * 2.4 + b01(su.knowledgeDecisions) * 0.5,
      multiStep: 1 + b01(su.multiSource) * 1.0 + b01(su.movesBetweenPeople) * 1.0
        + handoffsScore * 0.4 + b01(su.repetitiveAnalysis) * 0.5,
      /* Human intervention: approvals and un-checkable outcomes push it up
         (more human needed); automatically checkable outcomes pull it down. */
      humanIntervention: 2 + b01(su.approvals) * 1.4 + b01(!su.checkableOutcomes) * 1.2 - b01(su.checkableOutcomes) * 0.4
    };

    const answers = {};
    S.FIT_DIMENSIONS.forEach((dim) => {
      const derived = clamp(Math.round(d[dim.key]), 1, 5);
      answers[dim.key] = {
        derived,
        value: state.fitOverrides[dim.key] !== undefined ? clamp(n(state.fitOverrides[dim.key]), 1, 5) : derived,
        overridden: state.fitOverrides[dim.key] !== undefined
      };
    });
    return answers;
  }

  function agenticFit(state, base) {
    const answers = deriveFitAnswers(state, base);
    const dims = S.FIT_DIMENSIONS.map((d) => {
      const raw = answers[d.key].value;
      const normalised = d.invert ? 100 - fromScale(raw) : fromScale(raw);
      return {
        key: d.key, label: d.label, weight: d.weight, raw, score: normalised,
        derived: answers[d.key].derived, overridden: answers[d.key].overridden
      };
    });
    const score = clamp(dims.reduce((s, d) => s + d.score * d.weight, 0), 0, 100);
    const band = S.FIT_BANDS.find((b) => score >= b.min);
    return {
      score, band, answers, dimensions: dims,
      strongest: [...dims].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 3),
      weakest: [...dims].sort((a, b) => (a.score - b.score) || (a.invert ? -1 : 1)).slice(0, 2)
    };
  }

  function automationCeiling(state, fitScore) {
    // No explicit prior-automation input in the staged model; fit governs headroom.
    return clamp(fitScore * 0.75, 5, 80);
  }

  /* --------------------------------------------------------------------------
     2. Benefit lines at full adoption (steady state)
     ----------------------------------------------------------------------- */

  function benefits(state, base) {
    const d = state.drivers;
    const lines = [];

    const timeSaved = d.productivity.on ? clamp(n(d.productivity.timeSaved), 0, 95) / 100 : 0;
    const hoursSaved = base.hoursPerYear * timeSaved;
    const labourValue = hoursSaved * base.hourlyCost;
    const redeploy = d.capacity.on ? clamp(n(d.capacity.redeployShare), 0, 100) / 100 : 0;

    lines.push({
      key: 'productivity', series: 1, label: 'Productivity', on: d.productivity.on,
      value: labourValue * (1 - redeploy),
      basis: `${Math.round(timeSaved * 100)}% of ${Math.round(base.hoursPerYear).toLocaleString()} baseline hours removed`
        + (redeploy > 0 ? `; ${Math.round((1 - redeploy) * 100)}% booked as cost reduction` : '')
    });

    lines.push({
      key: 'capacity', series: 2, label: 'Capacity returned', on: d.capacity.on && d.productivity.on,
      value: labourValue * redeploy,
      basis: `${Math.round(redeploy * 100)}% of freed hours redeployed to higher-value work`
    });

    const errors = base.casesPerYear * (clamp(n(d.quality.errorRate), 0, 100) / 100);
    const reworkCost = errors * n(d.quality.costPerError);
    const improvement = clamp(n(d.quality.improvement), 0, 100) / 100;
    lines.push({
      key: 'quality', series: 3, label: 'Quality', on: d.quality.on,
      value: d.quality.on ? reworkCost * improvement : 0,
      basis: `${Math.round(improvement * 100)}% of ${Math.round(errors).toLocaleString()} annual errors avoided at ${AIVA.fmt ? AIVA.fmt.money(n(d.quality.costPerError)) : n(d.quality.costPerError)} each`
    });

    const expectedLoss = n(d.risk.incidentsPerYear) * n(d.risk.costPerIncident);
    const reduction = clamp(n(d.risk.reduction), 0, 100) / 100;
    lines.push({
      key: 'risk', series: 4, label: 'Risk', on: d.risk.on,
      value: d.risk.on ? expectedLoss * reduction : 0,
      basis: `${Math.round(reduction * 100)}% of ${AIVA.fmt ? AIVA.fmt.money(expectedLoss) : expectedLoss} expected annual loss avoided`
    });

    const margin = clamp(n(d.revenue.marginPct), 0, 100) / 100;
    lines.push({
      key: 'revenue', series: 5, label: 'Revenue', on: d.revenue.on,
      value: d.revenue.on ? n(d.revenue.annualUplift) * margin : 0,
      basis: `${Math.round(margin * 100)}% contribution margin on incremental revenue`
    });

    const uplift = clamp(n(d.customer.retentionUplift), 0, 100) / 100;
    lines.push({
      key: 'customer', series: 6, label: 'Customer', on: d.customer.on,
      value: d.customer.on ? n(d.customer.valueAtRisk) * uplift : 0,
      basis: `${Math.round(uplift * 100)}% of at-risk customer value protected`
    });

    const active = lines.filter((l) => l.on && l.value > 0);
    const total = active.reduce((s, l) => s + l.value, 0);
    lines.forEach((l) => { l.share = total > 0 && l.on ? l.value / total : 0; });

    return {
      lines, active,
      annualBenefit: total,
      hoursSaved,
      fteReturned: hoursSaved / HOURS_PER_FTE_YEAR,
      capacityHours: hoursSaved * redeploy,
      capacityFte: (hoursSaved * redeploy) / HOURS_PER_FTE_YEAR,
      errorsPerYear: errors,
      concentration: active.length ? Math.max(...active.map((l) => l.share)) : 1,
      strategicOn: state.drivers.strategic.on
    };
  }

  /* --------------------------------------------------------------------------
     3. Cash flows and financial metrics
     ----------------------------------------------------------------------- */

  function financials(state, ben) {
    const horizon = clamp(Math.round(n(state.invest.horizonYears)), 1, 7);
    const deploy = clamp(n(state.invest.deployMonths), 0, 36);
    const adoption = clamp(n(state.invest.adoptionY1), 0, 100) / 100;
    const rate = clamp(n(state.invest.discountRate), 0, 40) / 100;
    const capex = n(state.invest.implementation) + n(state.invest.changeCost);
    const run = n(state.invest.annualRun);

    const factors = [];
    for (let y = 1; y <= horizon; y++) {
      if (y === 1) factors.push(clamp((12 - deploy) / 12, 0, 1) * adoption);
      else if (y === 2) factors.push(clamp((adoption + 1) / 2, 0, 1));
      else factors.push(1);
    }

    const years = factors.map((f, i) => {
      const benefit = ben.annualBenefit * f;
      const net = benefit - run;
      return { year: i + 1, factor: f, benefit, runCost: run, net, discounted: net / Math.pow(1 + rate, i + 1) };
    });

    const totalBenefit = years.reduce((s, y) => s + y.benefit, 0);
    const totalRun = run * horizon;
    const totalInvestment = capex + totalRun;
    const netBenefit = totalBenefit - totalInvestment;
    const npv = -capex + years.reduce((s, y) => s + y.discounted, 0);
    const roi = totalInvestment > 0 ? (netBenefit / totalInvestment) * 100 : 0;
    const bcr = totalInvestment > 0 ? totalBenefit / totalInvestment : 0;

    let cumulative = -capex;
    let paybackMonths = null;
    const monthly = [{ month: 0, cumulative }];
    const liveMonthsY1 = Math.max(1, 12 - deploy);
    for (let m = 1; m <= horizon * 12; m++) {
      const y = Math.min(years.length, Math.ceil(m / 12)) - 1;
      const inflow = y === 0 ? (m > deploy ? years[0].benefit / liveMonthsY1 : 0) : years[y].benefit / 12;
      const outflow = run / 12;
      const prev = cumulative;
      cumulative += inflow - outflow;
      if (paybackMonths === null && prev < 0 && cumulative >= 0) {
        paybackMonths = m - 1 + (inflow - outflow !== 0 ? -prev / (inflow - outflow) : 0);
      }
      monthly.push({ month: m, cumulative });
    }

    return {
      horizon, capex, run, totalBenefit, totalRun, totalInvestment, netBenefit,
      npv, roi, bcr, paybackMonths, years, monthly, irr: irrOf(-capex, years.map((y) => y.net))
    };
  }

  function irrOf(t0, flows) {
    if (t0 >= 0 || !flows.length) return null;
    const npvAt = (r) => t0 + flows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i + 1), 0);
    if (npvAt(0) <= 0) return null;
    let lo = 0, hi = 10;
    if (npvAt(hi) > 0) return null;
    for (let i = 0; i < 120; i++) { const mid = (lo + hi) / 2; if (npvAt(mid) > 0) lo = mid; else hi = mid; }
    return ((lo + hi) / 2) * 100;
  }

  /* --------------------------------------------------------------------------
     4. Confidence — driven by the three Low/Medium/High answers, tempered by
     completeness, realism against the ceiling, and benefit concentration.
     ----------------------------------------------------------------------- */

  function confScore(level) { return (lookup(S.CONFIDENCE_LEVELS, level, 'score')) || 50; }

  function confidence(state, ben, ceiling) {
    const vol = confScore(state.invest.confidenceVolume);
    const cost = confScore(state.invest.confidenceCost);
    const benefit = confScore(state.invest.confidenceBenefits);
    const completeness = completenessOf(state) * 100;

    const ambition = state.drivers.productivity.on ? clamp(n(state.drivers.productivity.timeSaved), 0, 100) : 0;
    const overreach = Math.max(0, ambition - ceiling);
    const realism = clamp(100 - overreach * 2.5, 0, 100);
    const spread = clamp(100 - Math.max(0, ben.concentration - 0.65) * 200, 0, 100);

    const components = [
      { label: 'Confidence in volume', weight: 0.22, score: vol },
      { label: 'Confidence in cost', weight: 0.20, score: cost },
      { label: 'Confidence in benefits', weight: 0.26, score: benefit },
      { label: 'Assessment completeness', weight: 0.14, score: completeness },
      { label: 'Realism against agentic ceiling', weight: 0.10, score: realism },
      { label: 'Benefit diversification', weight: 0.08, score: spread }
    ];
    return { score: clamp(components.reduce((s, c) => s + c.score * c.weight, 0), 0, 100), components };
  }

  function completenessOf(state) {
    const d = state.drivers;
    const checks = [
      !!state.meta.caseName, !!state.discovery.workflowName,
      (state.discovery.problem || '').trim().length >= 40,
      (state.discovery.currentWorkflow || '').trim().length >= 80,
      (state.discovery.success || '').trim().length >= 20,
      n(state.current.transactionsPerPeriod) > 0, n(state.current.peopleInvolved) > 0,
      n(state.current.minutesPerTransaction) > 0, n(state.current.annualSalary) > 0,
      n(state.invest.implementation) > 0, n(state.invest.annualRun) > 0, n(state.invest.deployMonths) > 0,
      Object.keys(d).some((k) => d[k].on),
      !!state.meta.organisation || !!state.meta.sponsor
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  /* --------------------------------------------------------------------------
     5. Business Value Score — the weighted model
     25% financial · 20% agentic suitability · 15% strategic · 15% risk
     10% customer · 15% confidence
     ----------------------------------------------------------------------- */

  function valueScore(state, fit, fin, ben, conf) {
    const roiScore = clamp((fin.roi / 250) * 100, 0, 100);
    const paybackScore = fin.paybackMonths === null ? 0 : clamp(100 - ((fin.paybackMonths - 6) / 30) * 100, 0, 100);
    const npvScore = clamp((fin.npv / Math.max(1, fin.capex)) * 50, 0, 100);
    const financial = roiScore * 0.45 + paybackScore * 0.35 + npvScore * 0.20;

    const riskLine = ben.lines.find((l) => l.key === 'risk');
    const riskMaterial = ben.annualBenefit > 0 ? clamp((riskLine.value / ben.annualBenefit) * 300, 0, 100) : 0;
    const risk = fromScale(state.current.painLevel) * 0.35 + riskMaterial * 0.65;

    const custLine = ben.lines.find((l) => l.key === 'customer');
    const custMaterial = ben.annualBenefit > 0 ? clamp((custLine.value / ben.annualBenefit) * 400, 0, 100) : 0;
    const customer = fromScale(state.drivers.customer.on ? state.drivers.customer.experienceImpact : 1) * 0.6
      + custMaterial * 0.2 + fromScale(state.current.painLevel) * 0.2;

    const strategic = fromScale(state.discovery.strategicAlignment) * (state.drivers.strategic.on ? 1 : 0.7);

    const components = [
      { label: 'Financial value', weight: 0.25, score: financial, note: 'ROI, payback and NPV against the investment' },
      { label: 'Agentic suitability', weight: 0.20, score: fit.score, note: 'Fit across the eight dimensions' },
      { label: 'Strategic alignment', weight: 0.15, score: strategic, note: 'Link to a stated strategic priority' },
      { label: 'Risk reduction', weight: 0.15, score: risk, note: 'Exposure and expected loss avoided' },
      { label: 'Customer impact', weight: 0.10, score: customer, note: 'Experience, pressure and retained value' },
      { label: 'Confidence', weight: 0.15, score: conf.score, note: 'Evidence behind the numbers' }
    ];
    return { score: clamp(components.reduce((s, c) => s + c.score * c.weight, 0), 0, 100), components };
  }

  /* --------------------------------------------------------------------------
     6. Investment Score
     ----------------------------------------------------------------------- */

  function investmentScore(state, fin, ben) {
    const bcrScore = clamp((fin.bcr / 4) * 100, 0, 100);
    const paybackScore = fin.paybackMonths === null ? 0 : clamp(100 - ((fin.paybackMonths - 6) / 30) * 100, 0, 100);
    const runRatio = ben.annualBenefit > 0 ? fin.run / ben.annualBenefit : 1;
    const runScore = clamp(100 - runRatio * 200, 0, 100);
    const deliveryScore = clamp(100 - (n(state.invest.deployMonths) - 3) * 8, 0, 100);
    const components = [
      { label: 'Benefit-to-cost ratio', weight: 0.40, score: bcrScore, note: fin.bcr.toFixed(2) + ':1 over the horizon' },
      { label: 'Speed of payback', weight: 0.25, score: paybackScore, note: fin.paybackMonths === null ? 'No payback in horizon' : fin.paybackMonths.toFixed(1) + ' months' },
      { label: 'Run-cost efficiency', weight: 0.20, score: runScore, note: Math.round(runRatio * 100) + '% of annual benefit spent on run' },
      { label: 'Delivery simplicity', weight: 0.15, score: deliveryScore, note: n(state.invest.deployMonths) + ' months to deploy' }
    ];
    return { score: clamp(components.reduce((s, c) => s + c.score * c.weight, 0), 0, 100), components };
  }

  /* --------------------------------------------------------------------------
     7. Sensitivity
     ----------------------------------------------------------------------- */

  function sensitivity(state, ben) {
    const cases = [
      { label: 'Conservative', benefit: 0.7, cost: 1.25, note: 'Benefits 30% lower, costs 25% higher' },
      { label: 'Base case', benefit: 1, cost: 1, note: 'As entered' },
      { label: 'Upside', benefit: 1.2, cost: 0.95, note: 'Benefits 20% higher, costs 5% lower' }
    ];
    return cases.map((c) => {
      const scenario = JSON.parse(JSON.stringify(state));
      scenario.invest.implementation = n(state.invest.implementation) * c.cost;
      scenario.invest.changeCost = n(state.invest.changeCost) * c.cost;
      scenario.invest.annualRun = n(state.invest.annualRun) * c.cost;
      const scaled = Object.assign({}, ben, { annualBenefit: ben.annualBenefit * c.benefit });
      const f = financials(scenario, scaled);
      return { label: c.label, note: c.note, roi: f.roi, npv: f.npv, payback: f.paybackMonths };
    });
  }

  /* --------------------------------------------------------------------------
     8. Executive recommendation — the Discovery -> Prototype -> POC ->
     Production ladder. The stage is chosen from value, fit, financials and
     confidence together; the actions are the specific next steps.
     ----------------------------------------------------------------------- */

  function recommendation(state, fit, value, invest, fin, ben, conf) {
    const payback = fin.paybackMonths;
    const v = value.score, f = fit.score, cf = conf.score;

    let stage, verdict, stance, tone;

    if (f < 45) {
      stage = 'Reshape';
      verdict = 'Reshape — traditional automation likely fits better';
      stance = 'The work does not show the characteristics that make agentic AI the right instrument. The value may be real, but integration, RPA or process simplification will capture it more cheaply and with less delivery risk.';
      tone = 'serious';
    } else if (v >= 70 && f >= 70 && fin.npv > 0 && payback !== null && payback <= 18 && cf >= 60) {
      stage = 'Production Business Case';
      verdict = 'Proceed to Production Business Case';
      stance = 'The workflow is agent-shaped, the value is material and well evidenced, and the payback sits comfortably inside the funding window. Take this to the investment committee as a production case.';
      tone = 'good';
    } else if (v >= 58 && f >= 60 && fin.npv > 0) {
      stage = 'POC';
      verdict = 'Proceed to Proof of Concept';
      stance = 'The case is sound but rests on assumptions that a controlled proof of concept should convert into measured facts before full funding is released. Fund a scoped POC against the highest-value part of the workflow.';
      tone = 'good';
    } else if (v >= 44 || (f >= 55 && cf < 55)) {
      stage = 'Prototype';
      verdict = 'Proceed to Prototype';
      stance = 'The opportunity is real but the evidence is not yet strong enough for an investment decision. Build a prototype to test feasibility and firm up the baseline before committing to a POC.';
      tone = 'warn';
    } else {
      stage = 'Discovery';
      verdict = 'Return to Discovery';
      stance = 'On the numbers as entered, the case does not yet justify build investment. Run a short discovery to sharpen the baseline, confirm the value drivers and decide whether to reshape the scope or redirect the funding.';
      tone = 'warn';
    }

    const actions = [];
    if (cf < 55) actions.push('Strengthen the baseline: measure transaction volume and effort from system data before the next gate rather than relying on estimates.');
    if (payback === null) actions.push('No payback occurs inside the appraisal horizon. Reduce implementation scope or stage delivery so value lands earlier.');
    else if (payback > 24) actions.push(`Payback at ${payback.toFixed(0)} months is long for an agentic workflow. Sequence delivery so the highest-value step ships first.`);
    if (fit.weakest.length) actions.push(`Design around the weakest fit dimensions — ${fit.weakest.map((d) => d.label.toLowerCase()).join(' and ')} — as these govern how much autonomy the agent can safely hold.`);
    if (!state.suitability.checkableOutcomes) actions.push('Outcomes cannot yet be checked automatically. Define the success signal for each case early — it is what makes autonomy safe and the benefit provable.');
    if (ben.concentration > 0.65 && ben.active.length) {
      const top = ben.active.reduce((a, b) => (a.value > b.value ? a : b));
      actions.push(`${Math.round(ben.concentration * 100)}% of the benefit sits in one driver (${top.label.toLowerCase()}). Validate that line specifically — the case stands or falls on it.`);
    }
    if (state.drivers.capacity.on && n(state.drivers.capacity.redeployShare) > 50) {
      actions.push('Most labour value is booked as returned capacity, not cost reduction. Name where those hours go, or the CFO will discount the benefit.');
    }
    if (fin.run / Math.max(1, ben.annualBenefit) > 0.3) actions.push('Run cost consumes more than 30% of the annual benefit. Challenge the platform and inference assumptions before committing.');
    if (!actions.length) actions.push('Lock the baseline measures now so realised benefit can be tracked against this case after go-live.');

    return { stage, verdict, stance, tone, actions: actions.slice(0, 6) };
  }

  /* --------------------------------------------------------------------------
     Orchestration
     ----------------------------------------------------------------------- */

  function evaluate(state) {
    const base = baseline(state);
    const fit = agenticFit(state, base);
    const ceiling = automationCeiling(state, fit.score);
    const ben = benefits(state, base);
    const fin = financials(state, ben);
    const conf = confidence(state, ben, ceiling);
    const value = valueScore(state, fit, fin, ben, conf);
    const invest = investmentScore(state, fin, ben);
    const rec = recommendation(state, fit, value, invest, fin, ben, conf);
    return { base, fit, ceiling, ben, fin, conf, value, invest, rec, completeness: completenessOf(state), sensitivity: sensitivity(state, ben) };
  }

  AIVA.engine = {
    evaluate, baseline, agenticFit, deriveFitAnswers, benefits, financials,
    confidence, valueScore, investmentScore, recommendation, automationCeiling,
    completenessOf, HOURS_PER_FTE_YEAR, ONCOST, clamp
  };
})(window.AIVA);
