/* ============================================================================
   AIVA — reasoning.js
   Reads the three free-text discovery answers and reasons over them: which
   value drivers are likely real, which workflow type and agent pattern fit,
   which suitability answers the text supports, and what is missing.

   The reasoning runs entirely in the browser. It is a transparent, inspectable
   model — every conclusion names the words that produced it — so a description
   containing commercially sensitive detail never leaves the page.
   ============================================================================ */

window.AIVA = window.AIVA || {};

(function (AIVA) {
  'use strict';

  /* --------------------------------------------------------------------------
     Signal taxonomy. Each signal maps evidence -> drivers, suitability answers,
     and the sentence AIVA reads back.
     ----------------------------------------------------------------------- */

  const SIGNALS = [
    { id: 'rekeying', label: 'Manual data movement between systems',
      terms: ['re-key', 'rekey', 'copy', 'paste', 'manual entry', 'data entry', 'transcribe', 'retype', 're-type', 'spreadsheet', 'excel', 'upload', 'download', 'enter the details', 'consolidat', 'compile', 'collate'],
      drivers: ['productivity', 'quality'], suitability: ['multiSource', 'repetitiveAnalysis'],
      rationale: 'Effort is going into moving information rather than deciding about it — the most reliably automatable part of the workflow and usually the first benefit to land.' },
    { id: 'multisystem', label: 'Work spans multiple systems',
      terms: ['crm', 'sap', 'salesforce', 'servicenow', 'dynamics', 'mainframe', 'portal', 'sharepoint', 'outlook', 'inbox', 'core system', 'policy admin', 'ledger', 'erp', 'powerpoint', 'word', 'system', 'platform', 'application', 'multiple teams', 'multiple sources'],
      drivers: ['productivity'], suitability: ['multiSource'],
      rationale: 'An agent that acts across systems removes swivel-chair effort without waiting for those systems to be replaced.' },
    { id: 'handoff', label: 'Handoffs, queues and coordination',
      terms: ['handoff', 'hand off', 'escalat', 'route', 'assign', 'queue', 'forward', 'passes to', 'sent to', 'refer', 'triage', 'coordinat', 'back office', 'second line', 'submit', 'review'],
      drivers: ['productivity', 'customer'], suitability: ['movesBetweenPeople'],
      rationale: 'Each handoff adds waiting time customers feel and no one owns. Orchestration collapses the queue between steps, showing up in cycle time before cost.' },
    { id: 'approval', label: 'Approval and sign-off gates',
      terms: ['approv', 'sign-off', 'sign off', 'authoris', 'authoriz', 'delegation', 'four eyes', 'endorse', 'publication', 'publish', 'clearance'],
      drivers: ['productivity'], suitability: ['approvals'],
      rationale: 'Approval gates are where an agent stops and a person decides — the right place to design the human checkpoint deliberately.' },
    { id: 'judgement', label: 'Judgement against policy and precedent',
      terms: ['assess', 'interpret', 'judgement', 'judgment', 'policy', 'guideline', 'criteria', 'eligibility', 'wording', 'precedent', 'expertise', 'experienced', 'decide whether', 'determine', 'evaluate', 'analys', 'analyz'],
      drivers: ['productivity', 'quality'], suitability: ['knowledgeDecisions', 'repetitiveAnalysis'],
      rationale: 'Reading policy and applying it to a case is knowledge work classic automation cannot touch — exactly what a reasoning agent is for, with a person reviewing the call.' },
    { id: 'documents', label: 'Document drafting and reading',
      terms: ['draft', 'letter', 'report', 'paper', 'summar', 'document', 'pdf', 'contract', 'proposal', 'submission', 'template', 'correspondence', 'write up', 'write-up', 'file note', 'board pack', 'presentation'],
      drivers: ['productivity', 'quality'], suitability: ['createsDocuments'],
      rationale: 'Reading unstructured documents and drafting the response is high-effort, high-variance work — agentic drafting with human review removes most of the first-draft time.' },
    { id: 'compliance', label: 'Regulatory and control obligations',
      terms: ['compliance', 'regulat', 'audit', 'obligation', 'aml', 'kyc', 'privacy', 'breach', 'control', 'apra', 'asic', 'legislation', 'statutory', 'record keeping', 'record-keeping', 'governance'],
      drivers: ['risk', 'quality'], suitability: ['knowledgeDecisions'],
      rationale: 'Obligations create both the risk being reduced and the assurance the solution must carry. Consistent execution and a complete decision log often outvalue the labour saved.' },
    { id: 'errors', label: 'Errors, rework and inconsistency',
      terms: ['error', 'mistake', 'rework', 'incorrect', 'inconsisten', 'missed', 'omission', 'quality issue', 'defect', 'reopen', 'correction', 'depends on who', 'variation'],
      drivers: ['quality', 'risk'], suitability: ['repetitiveAnalysis'],
      rationale: 'Variation between people doing the same work is a quality cost rarely measured but always paid. Deterministic execution removes a large share of it.' },
    { id: 'backlog', label: 'Backlog, peaks and turnaround pressure',
      terms: ['backlog', 'delay', 'wait', 'turnaround', 'sla', 'peak', 'spike', 'seasonal', 'overtime', 'bottleneck', 'behind', 'too long', 'slow', 'time-consuming', 'time consuming'],
      drivers: ['capacity', 'customer'], suitability: ['movesBetweenPeople'],
      rationale: 'Demand outrunning capacity is a strong agentic signal: elastic execution absorbs peaks without hiring, and the benefit shows as service recovery rather than headcount.' },
    { id: 'customer', label: 'Direct customer or citizen impact',
      terms: ['customer', 'client', 'citizen', 'member', 'complaint', 'nps', 'satisfaction', 'onboarding', 'application', 'enquiry', 'inquiry', 'experience', 'churn', 'retention'],
      drivers: ['customer', 'capacity'], suitability: [],
      rationale: 'The workflow is felt outside the organisation. Faster, more consistent turnaround converts to retention and complaint reduction — value, not colour.' },
    { id: 'revenue', label: 'Revenue-bearing work',
      terms: ['quote', 'bid', 'tender', 'pipeline', 'sales', 'conversion', 'pricing', 'upsell', 'cross-sell', 'win rate', 'lead', 'opportunity', 'revenue', 'margin', 'billable'],
      drivers: ['revenue'], suitability: ['createsDocuments'],
      rationale: 'This workflow sits on the revenue line, not just the cost line. Faster or better responses convert into won work, usually outweighing the labour saved.' },
    { id: 'reporting', label: 'Reporting and executive coordination',
      terms: ['board', 'executive', 'elt', 'reporting', 'dashboard', 'kpi', 'monthly report', 'briefing', 'papers', 'pack', 'consolidat'],
      drivers: ['productivity', 'capacity'], suitability: ['multiSource', 'createsDocuments'],
      rationale: 'Executive reporting is coordination-heavy and deadline-driven. Assembling inputs and drafting the narrative is where agents recover the most time.' }
  ];

  /* Workflow-type classifier: term -> type. */
  const TYPE_HINTS = {
    'board': 'Executive Reporting', 'executive': 'Executive Reporting', 'elt': 'Executive Reporting', 'reporting': 'Executive Reporting',
    'claim': 'Customer Service', 'complaint': 'Customer Service', 'enquiry': 'Customer Service', 'customer': 'Customer Service', 'call centre': 'Customer Service',
    'invoice': 'Finance', 'ledger': 'Finance', 'reconcil': 'Finance', 'payment': 'Finance', 'accounts': 'Finance',
    'recruit': 'HR', 'onboarding': 'HR', 'employee': 'HR', 'leave': 'HR',
    'procure': 'Procurement', 'supplier': 'Procurement', 'purchase order': 'Procurement', 'sourcing': 'Procurement',
    'maintenance': 'Maintenance', 'asset': 'Maintenance', 'inspection': 'Field Operations', 'field': 'Field Operations',
    'compliance': 'Compliance', 'regulat': 'Compliance', 'audit': 'Compliance', 'kyc': 'Compliance', 'aml': 'Compliance',
    'risk': 'Risk', 'incident': 'Risk',
    'engineer': 'Engineering', 'design review': 'Engineering', 'defect': 'Engineering',
    'policy': 'Knowledge Work', 'assess': 'Knowledge Work', 'research': 'Knowledge Work', 'analysis': 'Knowledge Work'
  };

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function textOf(state) {
    return [state.discovery.problem, state.discovery.currentWorkflow, state.discovery.success]
      .filter(Boolean).join('\n\n').toLowerCase();
  }

  /* --------------------------------------------------------------------------
     Analyse
     ----------------------------------------------------------------------- */

  function analyse(state) {
    const text = textOf(state);
    const words = text.split(/\s+/).filter(Boolean).length;

    const detected = [];
    SIGNALS.forEach((sig) => {
      const hits = [];
      sig.terms.forEach((t) => {
        const re = new RegExp('(^|[^a-z])' + escapeRe(t) + '([a-z]*)', 'i');
        if (re.test(text)) hits.push(t);
      });
      if (hits.length) {
        detected.push({
          id: sig.id, label: sig.label, rationale: sig.rationale,
          terms: hits.slice(0, 5), strength: Math.min(1, hits.length / 3),
          drivers: sig.drivers, suitability: sig.suitability
        });
      }
    });
    detected.sort((a, b) => b.strength - a.strength || b.terms.length - a.terms.length);

    const driverScore = {};
    detected.forEach((d) => d.drivers.forEach((k, i) => {
      driverScore[k] = (driverScore[k] || 0) + d.strength * (i === 0 ? 1 : 0.6);
    }));

    /* Suitability suggestions: which yes/no answers the text supports. */
    const suitabilitySuggested = {};
    detected.forEach((d) => d.suitability.forEach((k) => { suitabilitySuggested[k] = true; }));

    /* Workflow-type vote. */
    const typeVotes = {};
    Object.keys(TYPE_HINTS).forEach((term) => {
      if (new RegExp('(^|[^a-z])' + escapeRe(term), 'i').test(text)) {
        const type = TYPE_HINTS[term];
        typeVotes[type] = (typeVotes[type] || 0) + 1;
      }
    });
    const workflowType = Object.keys(typeVotes).sort((a, b) => typeVotes[b] - typeVotes[a])[0] || null;

    /* Agent-pattern proposal from the shape of the evidence. */
    const has = (id) => detected.some((d) => d.id === id);
    let agenticPattern = null, patternWhy = '';
    if (has('judgement') && has('documents') && (has('multisystem') || has('handoff'))) {
      agenticPattern = 'Multi-Agent Workflow';
      patternWhy = 'Reasoning, drafting and coordination across systems point to specialised agents working together.';
    } else if (has('approval') || has('compliance')) {
      agenticPattern = 'Human-in-the-Loop Agent';
      patternWhy = 'Approvals or obligations mean an agent should execute while a person owns the decisions that matter.';
    } else if (has('judgement') || has('documents')) {
      agenticPattern = 'Single Agent';
      patternWhy = 'A defined piece of knowledge work an agent can complete end to end.';
    } else if (has('multisystem') || has('rekeying')) {
      agenticPattern = 'Copilot';
      patternWhy = 'The work is mostly retrieval and assembly — an agent working alongside the person in their tools fits best.';
    }

    let depth;
    if (words < 30) depth = { level: 'thin', score: 20, note: 'Too short to reason over. Add the systems touched, who does what, and where the work stalls.' };
    else if (words < 80) depth = { level: 'light', score: 48, note: 'Enough for a first read. Naming the systems and decision points would sharpen the analysis.' };
    else if (words < 180) depth = { level: 'solid', score: 76, note: 'A workable account. AIVA can propose drivers with reasonable confidence.' };
    else depth = { level: 'rich', score: 92, note: 'A detailed account. The proposals below are well evidenced by what you wrote.' };

    const gaps = [];
    if (words >= 30) {
      if (!has('multisystem')) gaps.push('No systems are named. The number of systems an agent must reach across is a strong fit signal — and the main integration cost.');
      if (!has('judgement') && !has('documents')) gaps.push('No judgement or document work is described. Without either, classic automation may serve you better than an agent.');
      if (!has('compliance') && !has('errors')) gaps.push('No quality or obligation pressure is described. If either exists, it usually carries more value than the labour saved.');
      if (!has('customer') && !has('revenue')) gaps.push('No customer or revenue impact is described. Cases built on cost alone tend to lose to cases that also move the top line.');
    }

    /* Extract a success target like "70%" for the narrative. */
    const successPct = (state.discovery.success || '').match(/(\d{1,3})\s*%/);

    return {
      words, signals: detected, driverScore, suitabilitySuggested,
      workflowType, agenticPattern, patternWhy, depth, gaps: gaps.slice(0, 3),
      successTarget: successPct ? +successPct[1] : null,
      suggestions: buildSuggestions(state, detected, driverScore, successPct ? +successPct[1] : null)
    };
  }

  /* --------------------------------------------------------------------------
     Concrete, editable proposals for the driver stage.
     Values stay conservative — a floor an executive can defend.
     ----------------------------------------------------------------------- */

  function buildSuggestions(state, detected, driverScore, successTarget) {
    const s = [];
    const has = (id) => detected.some((d) => d.id === id);
    const strength = (k) => driverScore[k] || 0;

    const mechanical = (has('rekeying') ? 1 : 0) + (has('reconciliation') ? 1 : 0) + (has('multisystem') ? 1 : 0) + (has('reporting') ? 1 : 0);
    const cognitive = (has('judgement') ? 1 : 0) + (has('documents') ? 1 : 0);
    let timeSaved = Math.min(65, 20 + mechanical * 8 + cognitive * 6);
    // If the owner stated a target, meet them partway between it and the model.
    if (successTarget) timeSaved = Math.round(Math.min(70, (timeSaved + Math.min(successTarget, 80)) / 2));

    if (strength('productivity') > 0) {
      s.push({ path: 'drivers.productivity.timeSaved', value: timeSaved, driver: 'productivity',
        label: `Set time saved to ${timeSaved}%`,
        why: successTarget ? `Balances your stated target of ${successTarget}% against what the described work supports.`
          : (mechanical >= 2 ? 'Several mechanical steps are described — the most removable part of the workflow.'
            : 'Judgement-heavy work is described; the removable share is real but smaller than a data-entry workflow.') });
      s.push({ path: 'drivers.productivity.on', value: true, silent: true });
    }

    if (has('backlog') || has('customer') || has('reporting')) {
      const redeploy = has('backlog') ? 55 : 45;
      s.push({ path: 'drivers.capacity.redeployShare', value: redeploy, driver: 'capacity',
        label: `Book ${redeploy}% of freed hours as returned capacity`,
        why: has('backlog') ? 'Backlog and peak pressure mean the realistic first use of freed hours is clearing work, not cutting cost.'
          : 'Deadline-driven work suggests freed time goes back into throughput rather than out as cost.' });
      s.push({ path: 'drivers.capacity.on', value: true, silent: true });
    }

    if (has('errors') || has('documents') || has('reporting')) {
      const improvement = has('errors') ? 50 : 35;
      s.push({ path: 'drivers.quality.improvement', value: improvement, driver: 'quality',
        label: `Set quality improvement to ${improvement}%`,
        why: has('errors') ? 'Rework and inconsistency are named in the description.'
          : 'Drafting and consolidation work carries a measurable defect rate even when it is not tracked.' });
      s.push({ path: 'drivers.quality.on', value: true, silent: true });
    }

    if (has('compliance')) {
      s.push({ path: 'drivers.risk.reduction', value: 35, driver: 'risk',
        label: 'Set risk reduction to 35%',
        why: 'Regulatory obligations are described. Consistent execution with a complete decision log reduces expected loss.' });
      s.push({ path: 'drivers.risk.on', value: true, silent: true });
    }

    if (has('revenue')) {
      s.push({ path: 'drivers.revenue.on', value: true, driver: 'revenue',
        label: 'Turn on the revenue driver',
        why: 'Revenue-bearing work is described. Enter the incremental revenue you would expect from faster or better responses.' });
    }

    if (has('customer')) {
      s.push({ path: 'drivers.customer.on', value: true, driver: 'customer',
        label: 'Turn on customer benefits',
        why: 'Customer impact is described. Even a conservative retention figure belongs in the case.' });
      s.push({ path: 'drivers.customer.experienceImpact', value: 4, silent: true });
    }

    return s;
  }

  /* --------------------------------------------------------------------------
     Narrative fragments for the business case document.
     ----------------------------------------------------------------------- */

  function narrative(state, analysis, result) {
    const top = analysis.signals.slice(0, 3).map((s) => s.label.toLowerCase());
    const wf = state.discovery.workflowName || 'the assessed workflow';

    const character = top.length
      ? `AIVA's reading of ${wf} evidences ${listOf(top)}. Together these distinguish agent-suited work from work better served by rules-based automation.`
      : `The description of ${wf} is brief, so the scores below rest largely on the structured answers.`;

    const fitLine = result.fit.score >= 70
      ? `At ${Math.round(result.fit.score)} out of 100 (${result.fit.band.label}), the workflow carries the reasoning, orchestration and document load agents handle well.`
      : result.fit.score >= 50
        ? `At ${Math.round(result.fit.score)} out of 100 (${result.fit.band.label}), there is a genuine agentic component; scope should be drawn tightly around the parts that carry it.`
        : `At ${Math.round(result.fit.score)} out of 100 (${result.fit.band.label}), agentic AI is unlikely to be the instrument that captures the value.`;

    return { character, fitLine };
  }

  function listOf(items) {
    if (items.length <= 1) return items[0] || '';
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  AIVA.reasoning = { analyse, narrative, SIGNALS };
})(window.AIVA);
