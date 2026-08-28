/* ============================================================================
   AIVA — schema.js
   The question model: default state, stage definitions and field descriptors.
   Every question in the wizard is declared once here; app.js renders from it.

   Question budget is deliberate. Stage 2 asks eight questions about the current
   state and Stage 3 asks seven yes/no questions about the work itself — the
   eight agentic fit dimensions are derived from those answers rather than asked
   directly, so a business owner is never asked to score their own workflow on a
   consulting framework they have not seen before.
   ============================================================================ */

window.AIVA = window.AIVA || {};

(function (AIVA) {
  'use strict';

  /* --------------------------------------------------------------------------
     Reference lists
     ----------------------------------------------------------------------- */

  const WORKFLOW_TYPES = ['Knowledge Work', 'Customer Service', 'Digital Operations',
    'Finance', 'HR', 'Procurement', 'Maintenance', 'Compliance', 'Risk',
    'Executive Reporting', 'Field Operations', 'Engineering', 'Other'];

  const AGENTIC_PATTERNS = [
    { value: 'Assistant', note: 'Answers questions and retrieves information on request.' },
    { value: 'Copilot', note: 'Works alongside a person inside their existing tools.' },
    { value: 'Single Agent', note: 'One agent completes a defined task end to end.' },
    { value: 'Multi-Agent Workflow', note: 'Several specialised agents coordinate across a process.' },
    { value: 'Human-in-the-Loop Agent', note: 'The agent executes; a person approves the decisions that matter.' },
    { value: 'Autonomous Process', note: 'The process runs without routine human involvement.' },
    { value: 'Unsure', note: 'Let AIVA propose the pattern from your description.' }
  ];

  const INDUSTRIES = ['Financial Services', 'Insurance', 'Government', 'Defence',
    'Utilities & Energy', 'Mining & Resources', 'Health', 'Retail & Consumer',
    'Communications, Media & Technology', 'Manufacturing', 'Professional Services', 'Other'];

  const FREQUENCIES = [
    { value: 'Daily', periodsPerYear: 250 },
    { value: 'Weekly', periodsPerYear: 52 },
    { value: 'Monthly', periodsPerYear: 12 },
    { value: 'Quarterly', periodsPerYear: 4 }
  ];

  const SALARY_BANDS = [90000, 120000, 150000, 180000];

  const SYSTEM_BANDS = [
    { value: '1', score: 1, count: 1 },
    { value: '2-3', score: 3, count: 2.5 },
    { value: '4-6', score: 4, count: 5 },
    { value: '7+', score: 5, count: 8 }
  ];

  const HANDOFF_BANDS = [
    { value: 'None', score: 1, count: 0 },
    { value: '1-3', score: 3, count: 2 },
    { value: '4-7', score: 4, count: 5.5 },
    { value: '8+', score: 5, count: 9 }
  ];

  const CONFIDENCE_LEVELS = [
    { value: 'Low', score: 35 },
    { value: 'Medium', score: 65 },
    { value: 'High', score: 92 }
  ];

  /* --------------------------------------------------------------------------
     The seven suitability questions. Each one lifts specific fit dimensions.
     ----------------------------------------------------------------------- */

  const SUITABILITY = [
    {
      key: 'multiSource',
      question: 'Does information need to be gathered from multiple sources?',
      help: 'Systems, inboxes, documents, spreadsheets, people — anywhere a person has to go looking.',
      yes: 'Retrieval and assembly across sources is the single most delegable part of knowledge work.'
    },
    {
      key: 'knowledgeDecisions',
      question: 'Are decisions made using rules or documented knowledge?',
      help: 'Policy, criteria, guidelines, precedent — anything written down that a person applies to a case.',
      yes: 'Decisions grounded in documented knowledge can be reasoned about, explained and audited by an agent.'
    },
    {
      key: 'repetitiveAnalysis',
      question: 'Is there repetitive analysis?',
      help: 'The same kind of comparison, check or assessment performed again and again on different cases.',
      yes: 'Repetition means the pattern is learnable and the benefit compounds across volume.'
    },
    {
      key: 'approvals',
      question: 'Does the process involve approvals?',
      help: 'Sign-off, authorisation, delegation limits, four-eyes review.',
      yes: 'Approval gates are the natural place to keep a human in the loop without slowing the rest of the work.'
    },
    {
      key: 'movesBetweenPeople',
      question: 'Does work move between people?',
      help: 'Handoffs, queues, escalations, referrals between teams.',
      yes: 'The wait between hands is usually larger than the work itself, and it is the first thing orchestration removes.'
    },
    {
      key: 'createsDocuments',
      question: 'Does the process create documents?',
      help: 'Letters, reports, assessments, papers, submissions, structured summaries.',
      yes: 'Drafting is high-effort, high-variance work where agentic generation with human review lands quickly.'
    },
    {
      key: 'checkableOutcomes',
      question: 'Can outcomes be checked automatically?',
      help: 'Is there a system, rule or downstream signal that tells you whether the output was right?',
      yes: 'Automatically checkable outcomes are what make autonomy safe — and what make the benefit provable.'
    }
  ];

  /* --------------------------------------------------------------------------
     The eight agentic fit dimensions and their weights.
     Answers are derived in engine.js from Stages 2 and 3, then optionally
     overridden by the user.
     ----------------------------------------------------------------------- */

  const FIT_DIMENSIONS = [
    { key: 'complexity', label: 'Workflow complexity', weight: 0.12, invert: false, help: 'Variation, branching and judgement carried end to end.' },
    { key: 'systems', label: 'Number of systems', weight: 0.13, invert: false, help: 'Distinct applications and data sources touched to complete one case.' },
    { key: 'handoffs', label: 'Number of handoffs', weight: 0.13, invert: false, help: 'Times the work passes between people, teams or queues.' },
    { key: 'decisions', label: 'Decision points', weight: 0.14, invert: false, help: 'Points where someone must assess, choose, approve or route.' },
    { key: 'knowledge', label: 'Knowledge intensity', weight: 0.13, invert: false, help: 'Policy, precedent and reference material that must be read and applied.' },
    { key: 'docGeneration', label: 'Document generation', weight: 0.12, invert: false, help: 'Drafting of letters, reports, assessments and submissions.' },
    { key: 'multiStep', label: 'Multi-step execution', weight: 0.13, invert: false, help: 'A sequence of dependent actions rather than a single transaction.' },
    { key: 'humanIntervention', label: 'Human intervention required', weight: 0.10, invert: true, help: 'Work that must stay with a person for legal, safety or relationship reasons. Higher lowers the fit.' }
  ];

  const FIT_BANDS = [
    { min: 90, label: 'Ideal Agentic AI', tone: 'good', note: 'Every characteristic that makes agentic delivery the right instrument is present.' },
    { min: 70, label: 'Strong Candidate', tone: 'good', note: 'Clearly agent-shaped work. Scope it tightly and it will deliver.' },
    { min: 50, label: 'Copilot Candidate', tone: 'warn', note: 'Better served by an agent working alongside people than by autonomous execution.' },
    { min: 0, label: 'Traditional Automation Better', tone: 'serious', note: 'The value may be real, but integration, RPA or process simplification will capture it more cheaply.' }
  ];

  /* --------------------------------------------------------------------------
     Value drivers. Series numbers are fixed and match the chart palette.
     Strategic value is deliberately qualitative — it is never given a dollar
     figure, because an invented one is the fastest way to lose a CFO.
     ----------------------------------------------------------------------- */

  const DRIVERS = [
    {
      key: 'productivity', series: 1, label: 'Productivity', quantified: true,
      headline: 'Time savings, faster decisions, less research effort',
      benefits: ['Time savings', 'Faster decisions', 'Reduced research effort'],
      formula: 'Volume × Time saved × Labour cost'
    },
    {
      key: 'capacity', series: 2, label: 'Capacity returned', quantified: true,
      headline: 'Hours given back to the team rather than taken out as cost',
      benefits: ['Backlog cleared', 'Peak demand absorbed', 'Higher-value work taken on'],
      formula: 'Hours returned × Labour rate'
    },
    {
      key: 'quality', series: 3, label: 'Quality', quantified: true,
      headline: 'Fewer errors, better consistency, better outputs',
      benefits: ['Reduced errors', 'Improved consistency', 'Better outputs'],
      formula: 'Current error cost × Expected improvement'
    },
    {
      key: 'risk', series: 4, label: 'Risk', quantified: true,
      headline: 'Compliance, policy adherence, auditability',
      benefits: ['Compliance', 'Policy adherence', 'Auditability'],
      formula: 'Incident cost × Reduction %'
    },
    {
      key: 'revenue', series: 5, label: 'Revenue', quantified: true,
      headline: 'Upsell, conversion, new services',
      benefits: ['Upsell', 'Conversion', 'New services'],
      formula: 'Expected uplift × Contribution margin'
    },
    {
      key: 'customer', series: 6, label: 'Customer', quantified: true,
      headline: 'Faster response, better experience, higher satisfaction',
      benefits: ['Faster response', 'Better experience', 'Higher satisfaction'],
      formula: 'Value at risk × Retention uplift'
    },
    {
      key: 'strategic', series: 0, label: 'Strategic', quantified: false,
      headline: 'Innovation, workforce augmentation, long-term capability',
      benefits: ['Innovation', 'Workforce augmentation', 'Long-term capability'],
      formula: 'Qualitative — carried in the value score, never as a dollar figure'
    }
  ];

  /* --------------------------------------------------------------------------
     Default state
     ----------------------------------------------------------------------- */

  const defaultState = () => ({
    version: 2,
    meta: {
      caseName: '',
      organisation: '',
      sponsor: '',
      preparedBy: '',
      currency: 'AUD',
      /* A fresh assessment starts pristine: the live results stay a blank
         slate until the user actually begins entering the workflow. */
      pristine: true
    },
    discovery: {
      problem: '',
      currentWorkflow: '',
      success: '',
      workflowName: '',
      workflowType: 'Knowledge Work',
      agenticPattern: 'Unsure',
      industry: 'Financial Services',
      strategicAlignment: 4,
      strategyText: '',
      strategyDocName: ''
    },
    current: {
      frequency: 'Weekly',
      transactionsPerPeriod: 150,
      peopleInvolved: 6,
      minutesPerTransaction: 45,
      annualSalary: 120000,
      systemsBand: '4-6',
      handoffsBand: '1-3',
      painLevel: 4
    },
    suitability: {
      multiSource: true,
      knowledgeDecisions: true,
      repetitiveAnalysis: true,
      approvals: true,
      movesBetweenPeople: true,
      createsDocuments: true,
      checkableOutcomes: false
    },
    fitOverrides: {},          /* dimension key -> 1–5, set only when a user overrides */
    drivers: {
      productivity: { on: true, timeSaved: 40, benefits: ['Time savings', 'Faster decisions'] },
      capacity: { on: true, redeployShare: 50, benefits: ['Backlog cleared'] },
      quality: { on: true, errorRate: 6, costPerError: 220, improvement: 45, benefits: ['Reduced errors', 'Improved consistency'] },
      risk: { on: true, incidentsPerYear: 6, costPerIncident: 25000, reduction: 30, benefits: ['Compliance', 'Auditability'] },
      revenue: { on: false, annualUplift: 0, marginPct: 35, benefits: [] },
      customer: { on: false, valueAtRisk: 0, retentionUplift: 10, experienceImpact: 3, benefits: [] },
      strategic: { on: true, benefits: ['Workforce augmentation', 'Long-term capability'], note: '' }
    },
    invest: {
      implementation: 260000,
      changeCost: 60000,
      annualRun: 70000,
      deployMonths: 4,
      adoptionY1: 60,
      discountRate: 9,
      horizonYears: 3,
      confidenceVolume: 'Medium',
      confidenceCost: 'Medium',
      confidenceBenefits: 'Medium'
    },
    appliedSuggestions: false
  });

  /* --------------------------------------------------------------------------
     Stage definitions
     ----------------------------------------------------------------------- */

  const num = (o) => Object.assign({ type: 'number', min: 0, step: 1 }, o);

  const STEPS = [
    {
      id: 'welcome', label: 'Welcome', note: 'What this does',
      title: 'Agentic AI Value Accelerator', custom: 'welcome'
    },

    {
      id: 'discovery', label: 'Workflow Discovery', note: 'In your words',
      eyebrow: 'Stage 01 of 05', title: 'Workflow discovery',
      intro: 'Three questions, answered in your own words. AIVA reads what you write to identify the value drivers, the workflow type and the agent pattern that fits — so the rest of the assessment starts from your situation rather than a blank template.',
      groups: [
        {
          title: 'Tell AIVA about the work',
          blurb: 'Write the way you would explain it to a colleague. Nothing you type leaves your browser.',
          fields: [
            {
              key: 'discovery.problem', label: 'What problem are you trying to solve?',
              type: 'textarea', span: true, required: true, minLength: 40, rows: 4,
              placeholder: 'Preparing board papers takes too long and requires coordination across multiple teams.',
              help: 'The business problem, not the technology. What is going wrong, and for whom?'
            },
            {
              key: 'discovery.currentWorkflow', label: 'Describe the current workflow',
              type: 'textarea', span: true, required: true, minLength: 80, rows: 6,
              placeholder: 'ELT members submit reports manually. Information is consolidated into PowerPoint and Word. Multiple reviews occur before publication.',
              help: 'Who does what, in which systems, in what order — and where it stalls. This is the answer AIVA learns the most from.'
            },
            {
              key: 'discovery.success', label: 'What does success look like?',
              type: 'textarea', span: true, required: true, minLength: 20, rows: 3,
              placeholder: 'e.g. Cut board-pack preparation from 10 days to 3, with no increase in headcount.',
              help: 'A measurable target is ideal — a number here becomes a testable assumption in the business case (e.g. "reduce turnaround by 70%", "clear the backlog within a quarter"). A qualitative aim such as "reduce manual effort" is fine too; AIVA will prompt you if a number would strengthen the case.',
              liveHint: 'quantify-success'
            }
          ]
        },
        {
          title: 'Case identity',
          blurb: 'These details appear on the cover of the business case.',
          fields: [
            { key: 'meta.caseName', label: 'Business case name', type: 'text', required: true, placeholder: 'e.g. Agentic board paper production' },
            { key: 'discovery.workflowName', label: 'Workflow assessed', type: 'text', required: true, placeholder: 'e.g. Monthly board pack preparation' },
            { key: 'meta.organisation', label: 'Organisation', type: 'text', placeholder: 'e.g. Northbridge Mutual' },
            { key: 'discovery.industry', label: 'Industry', type: 'select', options: INDUSTRIES },
            { key: 'meta.sponsor', label: 'Executive sponsor', type: 'text', placeholder: 'e.g. Chief Operating Officer' },
            { key: 'meta.preparedBy', label: 'Prepared by', type: 'text', placeholder: 'Your name' },
            { key: 'meta.currency', label: 'Reporting currency', type: 'select', options: ['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'SGD', 'CAD'] }
          ]
        },
        {
          title: 'Strategic alignment',
          blurb: 'How this workflow sits against your organisation\'s strategy. Paste the relevant strategy points — or attach a strategy document — and AIVA weaves them into the business case and the strategic-alignment score.',
          fields: [
            {
              key: 'discovery.strategyText', label: 'Your organisation\'s strategy points', type: 'textarea', span: true, rows: 4,
              placeholder: 'e.g. 1) Become a digital-first insurer by 2027.  2) Grow adviser capacity without growing headcount.  3) Reduce operational risk in regulated processes.  4) Build internal AI and automation capability.',
              help: 'The strategic priorities this workflow could support. Bullet points are perfect. Nothing you paste or attach leaves your browser.',
              attach: 'strategy'
            },
            {
              key: 'discovery.strategicAlignment', label: 'How strongly does this workflow support that strategy?', type: 'scale',
              help: 'Your own read on the alignment. This feeds the strategic-alignment component of the value score.',
              captions: ['Not on the strategic agenda', 'Loosely related', 'Supports a stated priority',
                'Named in the strategic plan', 'Board-level priority this year']
            }
          ]
        }
      ]
    },

    {
      id: 'current', label: 'Current State', note: 'Eight questions',
      eyebrow: 'Stage 02 of 05', title: 'Current state assessment',
      intro: 'Eight questions, no more. These set the baseline every benefit is calculated against — so use the best figures you have, and tell AIVA at Stage 05 how confident you are in them.',
      groups: [
        {
          title: 'Volume and effort',
          fields: [
            {
              key: 'current.frequency', label: 'How often is this performed?', type: 'choice',
              options: FREQUENCIES.map((f) => f.value)
            },
            num({ key: 'current.transactionsPerPeriod', label: 'Transactions per period', unit: 'cases', required: true, help: 'How many times the workflow runs in one of those periods.' }),
            num({ key: 'current.peopleInvolved', label: 'Number of people involved', unit: 'people', step: 1, required: true, help: 'People who touch this workflow, not full-time equivalents.' }),
            num({ key: 'current.minutesPerTransaction', label: 'Average effort per transaction', unit: 'minutes', required: true, help: 'Total hands-on minutes across everyone who touches one case.' })
          ]
        },
        {
          title: 'Cost and shape',
          fields: [
            {
              key: 'current.annualSalary', label: 'Average employee cost', type: 'currency-choice',
              options: SALARY_BANDS, unit: 'per year', allowCustom: true,
              help: 'Base salary. AIVA adds a 30% on-cost loading and converts to an hourly rate across 1,720 working hours.'
            },
            { key: 'current.systemsBand', label: 'Number of systems used', type: 'choice', options: SYSTEM_BANDS.map((s) => s.value) },
            { key: 'current.handoffsBand', label: 'Number of handoffs', type: 'choice', options: HANDOFF_BANDS.map((h) => h.value) },
            {
              key: 'current.painLevel', label: 'Current pain level', type: 'scale',
              help: 'How much this workflow hurts today — backlog, escalations, rework, frustration.',
              captions: ['Barely noticed', 'An irritation', 'A real problem', 'A serious problem', 'On the executive agenda']
            }
          ]
        }
      ]
    },

    {
      id: 'fit', label: 'Agentic Fit', note: 'Seven yes/no',
      eyebrow: 'Stage 03 of 05', title: 'Agentic suitability assessment',
      intro: 'Seven questions about the nature of the work. AIVA converts them into the eight scoring dimensions and returns an agentic fit score — including, where it applies, the honest answer that traditional automation would serve you better.',
      custom: 'fit'
    },

    {
      id: 'drivers', label: 'Value Drivers', note: 'Where value comes from',
      eyebrow: 'Stage 04 of 05', title: 'Value drivers',
      intro: 'Choose the benefits you would defend in front of a CFO, and AIVA quantifies each one from your baseline. Strategic value stays qualitative on purpose — an invented number there costs you the room.',
      custom: 'drivers'
    },

    {
      id: 'invest', label: 'Investment', note: 'Cost and confidence',
      eyebrow: 'Stage 05 of 05', title: 'Investment & cost assumptions',
      intro: 'What it takes to build and run — and how confident you are in the numbers you have entered. Confidence is scored and shown on the dashboard, because a stated confidence is worth more to an executive than a suspiciously precise return.',
      groups: [
        {
          title: 'Investment',
          fields: [
            num({ key: 'invest.implementation', label: 'Implementation cost', type: 'currency', step: 10000, required: true, help: 'Design, build, integration, testing and deployment.' }),
            num({ key: 'invest.changeCost', label: 'Change & adoption cost', type: 'currency', step: 5000, help: 'Training, process redesign, communications, capability uplift.' }),
            num({ key: 'invest.annualRun', label: 'Annual run cost', type: 'currency', step: 5000, required: true, help: 'Platform, licences, model inference, monitoring, support and assurance.' })
          ]
        },
        {
          title: 'Delivery and adoption',
          fields: [
            num({ key: 'invest.deployMonths', label: 'Time to deploy', unit: 'months', max: 36, help: 'From funding to the workflow running in production.' }),
            { key: 'invest.adoptionY1', label: 'Year 1 adoption', type: 'slider', min: 0, max: 100, step: 5, unit: '%', help: 'Share of eligible volume actually running through the agent in the first year.' },
            num({ key: 'invest.horizonYears', label: 'Appraisal horizon', unit: 'years', min: 1, max: 7, help: 'Years of benefit counted. Three is standard for an agentic workflow.' }),
            { key: 'invest.discountRate', label: 'Discount rate', type: 'slider', min: 0, max: 20, step: 0.5, unit: '%', help: 'Your hurdle rate, used for the NPV.' }
          ]
        },
        {
          title: 'How confident are you?',
          blurb: 'Answer honestly. Low confidence does not sink a case — it changes the recommendation from "fund it" to "prove it", which is usually the right next step anyway.',
          fields: [
            { key: 'invest.confidenceVolume', label: 'Confidence in volume', type: 'choice', options: ['Low', 'Medium', 'High'], help: 'How well do you know the transaction count and effort per case?' },
            { key: 'invest.confidenceCost', label: 'Confidence in cost', type: 'choice', options: ['Low', 'Medium', 'High'], help: 'How solid are the implementation and run cost estimates?' },
            { key: 'invest.confidenceBenefits', label: 'Confidence in benefits', type: 'choice', options: ['Low', 'Medium', 'High'], help: 'How sure are you the benefit will be captured and held?' }
          ]
        }
      ]
    },

    { id: 'results', label: 'Results Dashboard', note: 'The numbers', title: 'Results dashboard', custom: 'results' },
    { id: 'output', label: 'Business Case', note: 'The document', title: 'Business case output', custom: 'output' }
  ];

  AIVA.schema = {
    defaultState, STEPS, FIT_DIMENSIONS, FIT_BANDS, DRIVERS, SUITABILITY,
    WORKFLOW_TYPES, AGENTIC_PATTERNS, INDUSTRIES, FREQUENCIES, SALARY_BANDS,
    SYSTEM_BANDS, HANDOFF_BANDS, CONFIDENCE_LEVELS
  };
})(window.AIVA);
