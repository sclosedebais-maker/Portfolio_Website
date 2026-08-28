# AIVA — Agentic AI Value Accelerator

**Value Discovery & Business Case Engine.** A guided assessment that takes a
business workflow and returns what an executive needs to make an investment
call: the agentic fit, the value at stake, the return, and a clear
recommendation — with a downloadable Word and PDF business case.

Built for the *Agentic AI Catalyst* portfolio: the point is not AI assessment,
it is **investment confidence for agentic initiatives**, and a repeatable path
from idea → prototype → POC → production business case.

## Just open it

No build step, no dependencies, nothing fetched from a server. Open
`aiva/index.html` in a browser and it works — including the charts, the live
calculations, and the Word/PDF export. Everything runs in the browser, so the
free-text workflow descriptions never leave the page.

```
aiva/
  index.html     the shell
  aiva.css       design system (Avanade colours, light + dark, print/PDF)
  schema.js      the question model — every field declared once
  format.js      currency, number and date formatting
  engine.js      the value model (pure functions: state in, business case out)
  reasoning.js   reads the free text, proposes drivers, type and agent pattern
  charts.js      inline-SVG dashboard charts (no chart library)
  export.js      the business case document + Word/PDF downloads
  app.js         the wizard controller, live panel and navigation
```

## The five-stage assessment

1. **Workflow discovery** — three free-text questions (the problem, the current
   workflow, what success looks like) plus classification. AIVA reads the text
   to identify value drivers, workflow type and the agent pattern that fits.
2. **Current state** — eight questions that set the baseline every benefit is
   calculated against.
3. **Agentic suitability** — seven yes/no questions that derive the eight
   agentic fit scoring dimensions and an agentic fit score.
4. **Value drivers** — productivity, capacity returned, quality, risk, revenue,
   customer, and a qualitative strategic driver, each calculated from the
   baseline.
5. **Investment & confidence** — cost, adoption and three confidence answers
   that feed the confidence score.

Then a **results dashboard** and a generated **business case** with Word and PDF
export.

## The model

- **Agentic Fit Score** — weighted across workflow complexity, number of
  systems, number of handoffs, decision points, knowledge intensity, document
  generation, multi-step execution and human intervention (scored inversely).
  Bands: 90+ Ideal · 70–89 Strong candidate · 50–69 Copilot candidate · below
  50 traditional automation better.
- **Business Value Score** — 25% financial · 20% agentic suitability · 15%
  strategic alignment · 15% risk reduction · 10% customer impact · 15%
  confidence.
- **Investment Score** — benefit-to-cost ratio, speed of payback, run-cost
  efficiency and delivery simplicity.
- **Financials** — productivity savings, capacity returned (never
  double-counted against savings), quality, risk, revenue and customer benefit;
  ROI, payback, NPV, IRR and a three-point sensitivity.
- **Confidence Score** — driven by the user's own confidence answers, tempered
  by completeness, realism against the automation ceiling, and how concentrated
  the benefit is.
- **Executive recommendation** — the Discovery → Prototype → POC → Production
  ladder, with specific next steps.

Labour value is split once between cost reduction and returned capacity, so the
"capacity returned, not jobs removed" line — the differentiator most value
calculators miss — never double-counts an hour it has already saved.

## Design

Avanade orange (`#FF5800`) on a near-black / paper ground, Segoe typography,
generous whitespace, and a Microsoft-consulting register. Light and dark themes
both ship; the toggle is remembered. The chart palette is validated for
colour-vision separation and contrast in both themes. `@media print` renders the
business case alone — that is the PDF path.

Figures are estimates for investment triage and should be validated before
funding.
