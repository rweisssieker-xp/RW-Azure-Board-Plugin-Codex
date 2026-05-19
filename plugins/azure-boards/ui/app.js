(() => {
  "use strict";

  const TERMINAL_STATES = new Set(["closed", "done", "completed", "removed", "inactive", "resolved"]);
  const REQUIREMENT_TYPES = new Set(["requirement", "user story", "feature", "epic", "product backlog item"]);
  const RISK_TERMS = ["audit", "compliance", "datenschutz", "deadline", "e-rechnung", "eudamed", "gudid", "gesetz", "security", "udi", "risk", "delay"];
  const VALUE_TERMS = ["automation", "automatisiert", "customer", "finance", "integration", "kunde", "production", "rechnung", "schnittstelle", "umsatz"];
  const REPORTS = [
    { id: "delivery-risk", label: "Delivery Risk Radar", run: renderDeliveryRisk },
    { id: "requirement-decision", label: "Requirement Decision Cockpit", run: renderRequirementDecision },
    { id: "portfolio-rationalization", label: "Portfolio Rationalization", run: renderPortfolioRationalization },
    { id: "evidence-ledger", label: "Evidence Ledger", run: renderEvidenceLedger },
    { id: "steering-pack", label: "AI Steering Committee Pack", run: renderSteeringPack },
    { id: "bulk-close-preview", label: "Bulk Close Preview", run: renderBulkClosePreview }
  ];

  const sampleItems = [
    {
      id: 101,
      type: "Feature",
      title: "E-Rechnung validation workflow for finance closing",
      state: "Active",
      assignedTo: "Mira Finance",
      priority: 1,
      tags: ["Compliance", "Finance", "Evidence"],
      createdDate: "2026-01-12T09:00:00Z",
      changedDate: "2026-05-08T13:25:00Z",
      areaPath: "ERP\\Finance",
      description: "Automate validation and audit evidence for German E-Rechnung processing before month-end closing. Current manual checks create compliance risk and delay invoice release.",
      acceptanceCriteria: "Given inbound invoices with XML evidence, when validation runs, then invalid tax, supplier, and archive cases are reported with a traceable approval decision.",
      fields: {
        "Custom.BusinessValue": 9,
        "Custom.TargetBenefit": 95000,
        "Custom.Cost": 28000,
        "Microsoft.VSTS.Scheduling.StoryPoints": 13
      },
      relations: [{ rel: "AttachedFile", attributes: { name: "audit-sample.pdf" } }]
    },
    {
      id: 102,
      type: "Requirement",
      title: "Customer portal invoice download",
      state: "New",
      assignedTo: "",
      priority: 2,
      tags: ["Customer", "Portal"],
      createdDate: "2026-02-01T10:00:00Z",
      changedDate: "2026-02-11T10:00:00Z",
      areaPath: "ERP\\Customer",
      description: "Customers need self-service access to invoice PDFs and payment status to reduce service tickets and improve transparency.",
      acceptanceCriteria: "Customer sees invoice list, downloads PDF, and can filter by open or paid status.",
      fields: {
        "Custom.BusinessValue": 7,
        "Custom.TargetBenefit": 52000,
        "Microsoft.VSTS.Scheduling.StoryPoints": 8
      }
    },
    {
      id: 103,
      type: "User Story",
      title: "Legacy report color tweak",
      state: "New",
      assignedTo: "",
      priority: 4,
      tags: ["UI"],
      createdDate: "2025-11-15T08:00:00Z",
      changedDate: "2025-12-02T08:00:00Z",
      description: "Small report layout preference. No owner has confirmed business value.",
      acceptanceCriteria: "",
      fields: { "Custom.BusinessValue": 1, "Microsoft.VSTS.Scheduling.StoryPoints": 5 }
    },
    {
      id: 104,
      type: "Task",
      title: "Implement invoice XML parser",
      state: "Active",
      assignedTo: "Ravi Dev",
      priority: 2,
      parentId: 101,
      changedDate: "2026-05-10T11:00:00Z",
      description: "Parser implementation linked to E-Rechnung validation feature.",
      acceptanceCriteria: "Parser rejects malformed XML and stores validation evidence."
    },
    {
      id: 105,
      type: "Requirement",
      title: "De-scope duplicate warehouse label request",
      state: "Closed",
      assignedTo: "Nina Ops",
      priority: 3,
      tags: ["Warehouse", "Approved"],
      createdDate: "2025-12-03T09:00:00Z",
      changedDate: "2026-04-26T15:00:00Z",
      description: "Decision approved to close this duplicate label change after operations confirmed no additional value.",
      acceptanceCriteria: "Closure rationale approved by operations.",
      fields: { "Custom.BusinessValue": 2, "Custom.RealizedBenefit": 0 },
      relations: [{ rel: "AttachedFile", attributes: { name: "closure-approval.msg" } }]
    }
  ];

  const sampleEvidence = [
    { workItemId: 101, type: "comment", actor: "Mira Finance", date: "2026-05-09T08:30:00Z", text: "Approved for audit review. Evidence: validation sample and finance sign-off attached." },
    { workItemId: 105, type: "update", actor: "Nina Ops", date: "2026-04-26T15:00:00Z", text: "Decision accepted: duplicate scope closed after warehouse review." }
  ];

  const state = {
    items: sampleItems.map(clone),
    evidence: sampleEvidence.map(clone),
    activeTab: "input",
    currentReportId: REPORTS[0].id,
    lastReport: null,
    lastMarkdown: ""
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ensureShell();
    bindTabs();
    bindInputControls();
    bindReportControls();
    setInputValue(JSON.stringify({ items: state.items, evidence: state.evidence }, null, 2));
    updateDataStatus();
    switchTab("input");
    runSelectedReport();
  }

  function ensureShell() {
    if ($("#reportSelector") && $("#runReportButton") && $("#reportOutput")) return;
    document.body.innerHTML = `
      <main class="cockpit-app">
        <header class="hero">
          <h1>Azure Boards AI Cockpit</h1>
          <p>Static no-write review cockpit using local sample or pasted JSON data.</p>
        </header>
        <nav class="tabs" aria-label="Cockpit sections">
          <button type="button" data-tab="input" class="tab-button">Input</button>
          <button type="button" data-tab="reports" class="tab-button">Reports</button>
          <button type="button" data-tab="markdown" class="tab-button">Markdown</button>
        </nav>
        <section id="inputTab" data-tab-panel="input">
          <div class="toolbar">
            <button type="button" id="loadSampleButton">Load sample</button>
            <button type="button" id="parseJsonButton">Parse JSON</button>
            <input id="jsonFileInput" type="file" accept="application/json,.json" />
          </div>
          <textarea id="jsonInput" rows="18" spellcheck="false"></textarea>
          <p id="dataStatus"></p>
        </section>
        <section id="reportsTab" data-tab-panel="reports">
          <div class="toolbar">
            <select id="reportSelector"></select>
            <button type="button" id="runReportButton">Run report</button>
            <button type="button" id="downloadJsonButton">Download JSON</button>
            <button type="button" id="downloadMarkdownButton">Download Markdown</button>
          </div>
          <div id="reportOutput"></div>
        </section>
        <section id="markdownTab" data-tab-panel="markdown">
          <div id="markdownPreview"></div>
        </section>
      </main>`;
    injectFallbackStyles();
  }

  function injectFallbackStyles() {
    if ($("#azureBoardsCockpitFallbackStyles")) return;
    const style = document.createElement("style");
    style.id = "azureBoardsCockpitFallbackStyles";
    style.textContent = `
      body { margin: 0; background: #f7f8fa; color: #172033; font: 14px/1.45 Arial, sans-serif; }
      .cockpit-app { max-width: 1180px; margin: 0 auto; padding: 24px; }
      .hero { margin-bottom: 18px; }
      .hero h1 { margin: 0 0 6px; font-size: 28px; }
      .hero p, #dataStatus { color: #526070; }
      .tabs, .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
      button, select, input[type="file"] { border: 1px solid #c8d0dc; border-radius: 6px; background: #fff; color: #172033; padding: 8px 10px; }
      button.active, .tab-button.active { border-color: #2563eb; color: #123c9c; font-weight: 700; }
      textarea { box-sizing: border-box; width: 100%; min-height: 420px; border: 1px solid #c8d0dc; border-radius: 6px; padding: 12px; background: #fff; color: #172033; font-family: Consolas, Monaco, monospace; }
      .report-card section, .report-card header, details { margin: 18px 0; }
      .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
      .metric { border: 1px solid #d9e0ea; border-radius: 6px; background: #fff; padding: 10px; }
      .metric span { display: block; color: #526070; font-size: 12px; }
      .table-wrap { overflow: auto; border: 1px solid #d9e0ea; border-radius: 6px; background: #fff; }
      table { width: 100%; border-collapse: collapse; min-width: 720px; }
      th, td { border-bottom: 1px solid #e7ebf0; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #eef2f7; color: #243044; }
      pre { overflow: auto; background: #172033; color: #eef2f7; padding: 12px; border-radius: 6px; }
      .error { color: #b42318; }
    `;
    document.head.appendChild(style);
  }

  function bindTabs() {
    $$("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
  }

  function bindInputControls() {
    on("#loadSampleButton", "click", () => {
      state.items = sampleItems.map(clone);
      state.evidence = sampleEvidence.map(clone);
      setInputValue(JSON.stringify({ items: state.items, evidence: state.evidence }, null, 2));
      updateDataStatus("Sample data loaded.");
      runSelectedReport();
    });
    on("#parseJsonButton", "click", () => parseJsonInput());
    on("#jsonFileInput", "change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setInputValue(String(reader.result || ""));
        parseJsonInput();
      };
      reader.readAsText(file);
    });
  }

  function bindReportControls() {
    const selector = $("#reportSelector");
    if (selector) {
      selector.innerHTML = REPORTS.map((report) => `<option value="${escapeAttr(report.id)}">${escapeHtml(report.label)}</option>`).join("");
      selector.value = state.currentReportId;
      selector.addEventListener("change", () => {
        state.currentReportId = selector.value;
        runSelectedReport();
      });
    }
    on("#runReportButton", "click", () => runSelectedReport());
    on("#downloadJsonButton", "click", () => download("azure-boards-report.json", JSON.stringify(state.lastReport || {}, null, 2), "application/json"));
    on("#downloadMarkdownButton", "click", () => download("azure-boards-report.md", state.lastMarkdown || reportToMarkdown(state.lastReport), "text/markdown"));
  }

  function switchTab(tab) {
    state.activeTab = tab || "input";
    const tabReportMap = {
      reports: "requirement-decision",
      portfolio: "portfolio-rationalization",
      governance: "evidence-ledger",
      bulk: "bulk-close-preview"
    };
    if (tabReportMap[state.activeTab] && state.currentReportId !== tabReportMap[state.activeTab]) {
      state.currentReportId = tabReportMap[state.activeTab];
      runSelectedReport();
      return;
    }
    $$("[data-tab]").forEach((button) => {
      const isActive = button.dataset.tab === state.activeTab;
      button.classList.toggle("active", isActive);
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    $$("[data-tab-panel]").forEach((panel) => {
      const reportTabs = new Set(["reports", "portfolio", "governance", "bulk"]);
      const shouldShow = panel.dataset.tabPanel === state.activeTab || (panel.dataset.tabPanel === "reports" && reportTabs.has(state.activeTab));
      panel.hidden = !shouldShow;
    });
  }

  function parseJsonInput() {
    try {
      const parsed = JSON.parse(getInputValue());
      const normalized = normalizePayload(parsed);
      state.items = normalized.items;
      state.evidence = normalized.evidence;
      updateDataStatus("Parsed JSON locally.");
      runSelectedReport();
      switchTab("reports");
    } catch (error) {
      updateDataStatus(`JSON parse failed: ${error.message}`, true);
    }
  }

  function normalizePayload(payload) {
    const source = Array.isArray(payload) ? { items: payload } : objectFrom(payload);
    const items = arrayFrom(source.items || source.workItems || source.value || source.records).map(normalizeItem).filter((item) => item.id);
    const evidence = arrayFrom(source.evidence || source.comments || source.updates || source.attachmentTexts).map((entry) => objectFrom(entry));
    if (!items.length) throw new Error("Expected an array of Work Items or an object with items/workItems/value.");
    return { items, evidence };
  }

  function runSelectedReport() {
    const reportDef = REPORTS.find((report) => report.id === state.currentReportId) || REPORTS[0];
    state.currentReportId = reportDef.id;
    const selector = $("#reportSelector");
    if (selector) selector.value = reportDef.id;
    state.lastReport = reportDef.run(state.items, state.evidence);
    state.lastMarkdown = state.lastReport.markdown || reportToMarkdown(state.lastReport);
    renderReport(state.lastReport);
    renderMarkdownPreview(state.lastMarkdown);
    if (reportDef.id === "steering-pack") switchTab("markdown");
    else if (reportDef.id === "bulk-close-preview") switchTab("bulk");
    else switchTab("reports");
  }

  function renderDeliveryRisk(items) {
    const normalized = items.map(normalizeItem);
    const findings = normalized
      .map((item) => {
        if (isTerminal(item.state)) return null;
        const age = daysSince(item.changedDate);
        const signals = [];
        let score = 0;
        if (!item.assignedTo) {
          score += 20;
          signals.push("no assigned owner");
        }
        if (age >= 60) {
          score += age >= 120 ? 35 : 22;
          signals.push(`stale ${age} days`);
        }
        if ((item.priority || 99) <= 2) {
          score += 15;
          signals.push(`high priority ${item.priority}`);
        }
        if (keywordHits(item, RISK_TERMS)) {
          score += 25;
          signals.push("risk or compliance language");
        }
        if (!item.acceptanceCriteria && REQUIREMENT_TYPES.has(item.type.toLowerCase())) {
          score += 15;
          signals.push("missing acceptance criteria");
        }
        if (!signals.length) return null;
        return finding(item, score, signals, "Confirm owner, dated next action, and delivery evidence before the next checkpoint.");
      })
      .filter(Boolean)
      .sort(byScoreDesc);
    return baseReport("Delivery Risk Radar", findings, `${findings.length} risky Work Item(s) need delivery attention.`, {
      assessedItems: normalized.length,
      openItems: normalized.filter((item) => !isTerminal(item.state)).length,
      highRisk: findings.filter((entry) => entry.severity === "high" || entry.severity === "critical").length
    }, ["Confirm owner for unassigned risks.", "Update stale high-priority items.", "Escalate dependency blockers."]);
  }

  function renderRequirementDecision(items) {
    const decisions = items.map(normalizeItem)
      .filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()))
      .map((item) => {
        const evidence = evidenceScore(item);
        const value = keywordHits(item, VALUE_TERMS) * 15;
        const risk = keywordHits(item, RISK_TERMS) * 20;
        const stale = daysSince(item.changedDate);
        const priority = item.priority ? Math.max(0, 25 - item.priority * 5) : 0;
        const score = clamp(evidence + value + risk + priority - (stale >= 120 ? 35 : stale >= 60 ? 20 : 0) - (isTerminal(item.state) ? 40 : 0), 0, 100);
        const decision = isTerminal(item.state) ? "close" : evidence < 45 && stale >= 120 ? "park" : score >= 75 ? "accelerate" : score < 35 ? "park" : "review";
        return {
          id: item.id,
          title: item.title,
          state: item.state,
          decision,
          score,
          rationale: [`evidence ${evidence}`, `value signal ${value}`, `risk signal ${risk}`, `priority ${item.priority || "n/a"}`, stale ? `changed ${stale} days ago` : "no changed date"]
        };
      })
      .sort((left, right) => right.score - left.score || left.id - right.id);
    const findings = decisions.filter((entry) => entry.decision !== "review").map((entry) => ({
      id: entry.id,
      title: `#${entry.id} ${entry.title}`,
      score: entry.score,
      severity: entry.decision === "accelerate" ? "high" : entry.decision === "close" ? "medium" : "low",
      signals: entry.rationale,
      recommendation: decisionRecommendation(entry.decision)
    }));
    return {
      ...baseReport("Requirement Decision Cockpit", findings, `${decisions.length} requirement decision(s) scored. No writes were performed.`, countBy(decisions, "decision")),
      decisions
    };
  }

  function renderPortfolioRationalization(items) {
    const normalized = items.map(normalizeItem);
    const duplicateMap = duplicateTitles(normalized);
    const rows = normalized.filter((item) => !isTerminal(item.state)).map((item) => {
      const value = valueScore(item);
      const evidence = evidenceScore(item);
      const effort = effortScore(item);
      const stale = daysSince(item.changedDate);
      const duplicates = (duplicateMap.get(titleKey(item.title)) || []).filter((id) => id !== item.id);
      const decision = duplicates.length ? "merge" : value >= 65 && evidence >= 35 ? "keep" : value <= 28 && stale >= 120 ? "kill" : evidence < 35 || effort > value + 30 ? "rework" : value >= 45 ? "keep" : "kill";
      const score = decision === "keep" ? value : decision === "merge" ? 80 : decision === "kill" ? Math.min(100, 45 + Math.max(0, stale - 120) / 3 + Math.max(0, 40 - value)) : Math.min(100, 40 + Math.max(0, 60 - evidence));
      return { id: item.id, title: item.title, decision, value, evidence, effort, stale, duplicates: duplicates.map((id) => `#${id}`).join(", "), score: Math.round(score) };
    }).sort((left, right) => right.score - left.score || left.id - right.id);
    const findings = rows.map((row) => ({
      id: row.id,
      title: `#${row.id} ${row.title}`,
      score: row.score,
      severity: row.score >= 85 ? "critical" : row.score >= 65 ? "high" : row.score >= 35 ? "medium" : "low",
      signals: [`decision ${row.decision}`, `value score ${row.value}`, `evidence score ${row.evidence}`, `effort score ${row.effort}`, `stale ${row.stale} days`],
      recommendation: rationalizationRecommendation(row.decision)
    }));
    return {
      ...baseReport("Portfolio Rationalization", findings, `${rows.length} open portfolio item(s) classified for keep, kill, merge, or rework decisions.`, {
        assessedItems: normalized.length,
        openItems: rows.length,
        ...countBy(rows, "decision")
      }),
      rationalization: rows
    };
  }

  function renderEvidenceLedger(items, evidence) {
    const evidenceById = groupEvidence(evidence);
    const ledger = items.map(normalizeItem).filter((item) => isTerminal(item.state)).map((item) => {
      const supplied = evidenceById.get(item.id) || [];
      const signals = evidenceSignals(item, supplied);
      const missing = [];
      if (!item.changedDate) missing.push("missing closure date");
      if (!item.assignedTo && !supplied.some((entry) => actorFrom(entry))) missing.push("missing closure actor");
      if (!item.acceptanceCriteria) missing.push("missing acceptance criteria");
      if (!signals.length) missing.push("missing closure evidence");
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        state: item.state,
        closedDate: item.changedDate || "",
        closedBy: item.assignedTo || actorFrom(supplied[0]) || "",
        evidenceSignals: signals,
        missingSignals: missing,
        governanceStatus: missing.length === 0 ? "complete" : missing.length >= 3 ? "gap" : "review"
      };
    }).sort((left, right) => statusRank(left.governanceStatus) - statusRank(right.governanceStatus) || left.id - right.id);
    const findings = ledger.filter((entry) => entry.governanceStatus !== "complete").map((entry) => ({
      id: entry.id,
      title: entry.title,
      score: entry.governanceStatus === "gap" ? 90 : 60,
      severity: entry.governanceStatus === "gap" ? "high" : "medium",
      signals: entry.evidenceSignals.concat(entry.missingSignals),
      recommendation: "Add closure rationale, approver, and verifiable evidence before relying on this item in an audit ledger."
    }));
    return {
      ...baseReport("Closure Governance Ledger", findings, `${ledger.length} terminal Work Item(s) were evaluated for closure governance evidence.`, {
        terminalItems: ledger.length,
        complete: ledger.filter((entry) => entry.governanceStatus === "complete").length,
        review: ledger.filter((entry) => entry.governanceStatus === "review").length,
        gaps: ledger.filter((entry) => entry.governanceStatus === "gap").length
      }),
      ledger
    };
  }

  function renderSteeringPack(items, evidence) {
    const risk = renderDeliveryRisk(items, evidence);
    const portfolio = renderPortfolioRationalization(items, evidence);
    const decision = renderRequirementDecision(items, evidence);
    const findings = risk.findings.concat(portfolio.findings, decision.findings).sort(byScoreDesc).slice(0, 12);
    const metrics = {
      sourceReports: 3,
      assessedItems: items.length,
      deliveryRisks: risk.findings.length,
      portfolioFindings: portfolio.findings.length,
      decisionFindings: decision.findings.length
    };
    const report = baseReport("AI Steering Committee Pack", findings, `${findings.length} steering finding(s) prepared for executive review.`, metrics, [
      "Decide ownership for top escalations.",
      "Confirm scope, milestone confidence, and tradeoffs for the next steering cycle.",
      "Use board writes only through explicit preview/apply workflows."
    ]);
    report.markdown = [
      "# AI Steering Committee Pack",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      "## Executive Decisions",
      ...findings.slice(0, 6).map((entry) => `- #${entry.id} ${entry.title.replace(/^#\\d+\\s*/, "")}: ${entry.recommendation}`),
      "",
      "## Metrics",
      ...Object.entries(metrics).map(([key, value]) => `- ${key}: ${value}`),
      "",
      "_No Azure Boards write was performed._"
    ].join("\n");
    return report;
  }

  function renderBulkClosePreview(items) {
    const normalized = items.map(normalizeItem);
    const targets = [];
    const skipped = [];
    normalized.forEach((item) => {
      if (isTerminal(item.state)) {
        skipped.push({ id: item.id, title: item.title, reason: `already terminal (${item.state})` });
        return;
      }
      const childImpact = normalized
        .filter((child) => child.parentId === item.id && !isTerminal(child.state))
        .map((child) => closeTarget(child, "Child closure because parent is planned for closure.", []));
      targets.push(closeTarget(item, "Formal backlog cleanup based on value, WSJF, or governance review.", childImpact));
    });
    return {
      title: "Bulk Close Preview",
      generatedAt: new Date().toISOString(),
      writePerformed: false,
      approvalRequired: true,
      summary: `${targets.length} parent item(s) and ${targets.reduce((sum, target) => sum + target.childImpact.length, 0)} child item(s) planned for closure. No writes were performed.`,
      findings: targets.map((target) => ({
        id: target.id,
        title: target.title,
        score: target.risk === "medium" ? 70 : 45,
        severity: target.risk === "medium" ? "medium" : "low",
        signals: [`${target.currentState} -> ${target.targetState}`, `${target.childImpact.length} child impact(s)`, target.rationale],
        recommendation: "Review and explicitly approve this preview before applying any board write."
      })),
      metrics: {
        requestedItems: normalized.length,
        plannedParents: targets.length,
        plannedChildren: targets.reduce((sum, target) => sum + target.childImpact.length, 0),
        skippedItems: skipped.length
      },
      targets,
      skipped
    };
  }

  function renderReport(report) {
    const output = $("#reportOutput");
    if (!output) return;
    output.innerHTML = [
      `<article class="report-card">`,
      `<header><h2>${escapeHtml(report.title)}</h2><p>${escapeHtml(report.summary || "")}</p><p><strong>No Azure writes:</strong> ${report.writePerformed === false ? "confirmed" : "n/a"}</p></header>`,
      renderMetrics(report.metrics),
      renderFindings(report.findings || []),
      renderSpecialTables(report),
      `<details><summary>Raw JSON</summary><pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre></details>`,
      `</article>`
    ].join("");
  }

  function renderMetrics(metrics) {
    const entries = Object.entries(metrics || {});
    if (!entries.length) return "";
    return `<section><h3>Metrics</h3><div class="metric-grid">${entries.map(([key, value]) => `<div class="metric"><span>${escapeHtml(labelize(key))}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("")}</div></section>`;
  }

  function renderFindings(findings) {
    if (!findings.length) return `<section><h3>Findings</h3><p>No findings for the current input.</p></section>`;
    return `<section><h3>Findings</h3>${table(["ID", "Title", "Severity", "Score", "Signals", "Recommendation"], findings.map((entry) => [
      entry.id || "",
      entry.title || "",
      entry.severity || "",
      entry.score || "",
      arrayFrom(entry.signals).join("; "),
      entry.recommendation || ""
    ]))}</section>`;
  }

  function renderSpecialTables(report) {
    if (report.decisions) return `<section><h3>Decision Scores</h3>${table(["ID", "Title", "State", "Decision", "Score", "Rationale"], report.decisions.map((row) => [row.id, row.title, row.state, row.decision, row.score, row.rationale.join("; ")]))}</section>`;
    if (report.rationalization) return `<section><h3>Portfolio Decisions</h3>${table(["ID", "Title", "Decision", "Value", "Evidence", "Effort", "Stale", "Duplicates"], report.rationalization.map((row) => [row.id, row.title, row.decision, row.value, row.evidence, row.effort, row.stale, row.duplicates]))}</section>`;
    if (report.ledger) return `<section><h3>Ledger</h3>${table(["ID", "Title", "State", "Closed By", "Status", "Evidence", "Missing"], report.ledger.map((row) => [row.id, row.title, row.state, row.closedBy, row.governanceStatus, row.evidenceSignals.join("; "), row.missingSignals.join("; ")]))}</section>`;
    if (report.targets) return `<section><h3>Close Targets</h3>${table(["ID", "Title", "Current", "Target", "Risk", "Patch Preview", "Child Impact"], report.targets.map((row) => [row.id, row.title, row.currentState, row.targetState, row.risk, JSON.stringify(row.patchPreview), row.childImpact.length]))}</section>`;
    return "";
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell == null ? "" : cell))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function renderMarkdownPreview(markdown) {
    const preview = $("#markdownPreview");
    if (!preview) return;
    preview.innerHTML = markdownToHtml(markdown || "");
  }

  function reportToMarkdown(report) {
    if (!report) return "";
    const lines = [`# ${report.title}`, "", report.summary || "", "", "## Metrics"];
    Object.entries(report.metrics || {}).forEach(([key, value]) => lines.push(`- ${key}: ${value}`));
    lines.push("", "## Findings");
    (report.findings || []).forEach((entry) => lines.push(`- #${entry.id || ""} ${entry.title || ""}: ${entry.recommendation || ""}`));
    lines.push("", "_No Azure Boards write was performed._");
    return lines.join("\n");
  }

  function markdownToHtml(markdown) {
    const lines = markdown.split(/\r?\n/);
    return lines.map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("- ")) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    }).join("").replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
  }

  function baseReport(title, findings, summary, metrics, nextActions) {
    return {
      title,
      generatedAt: new Date().toISOString(),
      writePerformed: false,
      summary,
      findings,
      metrics: { findings: findings.length, ...(metrics || {}) },
      nextActions: nextActions || ["Use this as decision support only.", "Validate assumptions with accountable owners.", "Apply board writes only through explicit preview/apply tools."]
    };
  }

  function finding(item, score, signals, recommendation) {
    const bounded = clamp(score, 0, 100);
    return {
      id: item.id,
      title: `#${item.id} ${item.title}`,
      score: bounded,
      severity: bounded >= 85 ? "critical" : bounded >= 65 ? "high" : bounded >= 35 ? "medium" : "low",
      signals,
      recommendation
    };
  }

  function normalizeItem(raw, index) {
    const record = objectFrom(raw);
    const fields = objectFrom(record.fields);
    const id = numberFrom(record.id) || numberFrom(fields["System.Id"]) || index + 1;
    return {
      raw: record,
      id,
      type: stringFrom(record.type) || stringFrom(fields["System.WorkItemType"]) || "Work Item",
      title: stringFrom(record.title) || stringFrom(fields["System.Title"]) || `Work Item ${id}`,
      state: stringFrom(record.state) || stringFrom(fields["System.State"]) || "",
      assignedTo: identity(record.assignedTo) || identity(fields["System.AssignedTo"]) || "",
      priority: numberFrom(record.priority) || numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
      tags: tagsFrom(record.tags || fields["System.Tags"]),
      createdDate: stringFrom(record.createdDate) || stringFrom(fields["System.CreatedDate"]),
      changedDate: stringFrom(record.changedDate) || stringFrom(fields["System.ChangedDate"]),
      areaPath: stringFrom(record.areaPath) || stringFrom(fields["System.AreaPath"]),
      parentId: numberFrom(record.parentId) || parentIdFromRelations(record),
      description: stripHtml(stringFrom(record.description) || stringFrom(fields["System.Description"])),
      acceptanceCriteria: stripHtml(stringFrom(record.acceptanceCriteria) || stringFrom(fields["Microsoft.VSTS.Common.AcceptanceCriteria"])),
      attachments: attachmentNames(record),
      links: linkNames(record)
    };
  }

  function evidenceScore(item) {
    let score = 0;
    if (item.description.length >= 160) score += 25;
    else if (item.description.length >= 60) score += 12;
    if (item.acceptanceCriteria.length >= 80) score += 25;
    else if (item.acceptanceCriteria.length >= 30) score += 12;
    score += Math.min(20, item.attachments.length * 10);
    if (item.tags.length) score += 10;
    if (item.areaPath) score += 10;
    return clamp(score, 0, 100);
  }

  function valueScore(item) {
    const fields = objectFrom(item.raw.fields);
    const explicit = numberFrom(fields["Custom.BusinessValue"]) || numberFrom(fields["Microsoft.VSTS.Common.BusinessValue"]);
    const benefit = numberFrom(fields["Custom.TargetBenefit"]) || 0;
    const priorityScore = (6 - Math.min(item.priority || 3, 5)) * 10;
    const keywordBoost = keywordHits(item, VALUE_TERMS) ? 12 : 0;
    return clamp((explicit || 0) * 10 + Math.min(100, benefit / 2000) * 0.4 + priorityScore + keywordBoost, 0, 100);
  }

  function effortScore(item) {
    const fields = objectFrom(item.raw.fields);
    const effort = numberFrom(fields["Microsoft.VSTS.Scheduling.StoryPoints"]) || numberFrom(fields["Microsoft.VSTS.Scheduling.Effort"]) || 0;
    const typeBoost = /epic/i.test(item.type) ? 45 : /feature/i.test(item.type) ? 30 : /requirement|story|pbi/i.test(item.type) ? 18 : 10;
    return clamp(effort * 8 + typeBoost, 0, 100);
  }

  function evidenceSignals(item, supplied) {
    const text = `${item.description} ${arrayFrom(supplied).map(evidenceText).join(" ")}`;
    const signals = [];
    if (item.attachments.length) signals.push(`${item.attachments.length} attachment(s): ${item.attachments.slice(0, 3).join(", ")}`);
    if (item.links.length) signals.push(`${item.links.length} linked artifact(s)`);
    if (item.acceptanceCriteria) signals.push("acceptance criteria present");
    if (item.tags.some((tag) => /evidence|audit|approved|validated|verified/i.test(tag))) signals.push("evidence tag");
    if (/\b(evidence|audit|test|qa|review|approval|attached|validated|verified|decision)\b/i.test(text)) signals.push("evidence keywords in text");
    return signals;
  }

  function closeTarget(item, rationale, childImpact) {
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      currentState: item.state,
      targetState: "Closed",
      rationale,
      comment: `${rationale} Current item: ${item.type} #${item.id}. No write should be applied unless this preview is explicitly approved.`,
      patchPreview: [{ op: "replace", path: "/fields/System.State", value: "Closed" }],
      childImpact,
      risk: childImpact.length ? "medium" : "low"
    };
  }

  function decisionRecommendation(decision) {
    if (decision === "accelerate") return "Prioritize for decision and delivery sequencing.";
    if (decision === "close") return "Confirm terminal state and remove from active decision review.";
    if (decision === "park") return "Park until owner, value, or evidence changes.";
    return "Review evidence, value, and risk signals before changing state.";
  }

  function rationalizationRecommendation(decision) {
    if (decision === "keep") return "Keep in the portfolio, confirm owner, and protect capacity if evidence remains current.";
    if (decision === "kill") return "Review for closure or parking; avoid further spend unless a stronger business case is added.";
    if (decision === "merge") return "Consolidate duplicate demand under one accountable parent before prioritization.";
    return "Rework the business case, benefit evidence, effort estimate, or scope before a keep/kill decision.";
  }

  function duplicateTitles(items) {
    const groups = new Map();
    items.forEach((item) => {
      const key = titleKey(item.title);
      if (!key) return;
      groups.set(key, (groups.get(key) || []).concat(item.id));
    });
    Array.from(groups.entries()).forEach(([key, ids]) => {
      if (ids.length < 2) groups.delete(key);
    });
    return groups;
  }

  function groupEvidence(records) {
    const grouped = new Map();
    arrayFrom(records).forEach((record) => {
      const id = numberFrom(record.workItemId) || numberFrom(record.id);
      if (!id) return;
      grouped.set(id, (grouped.get(id) || []).concat(record));
    });
    return grouped;
  }

  function countBy(rows, key) {
    return rows.reduce((acc, row) => {
      const value = String(row[key] || "unknown");
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function updateDataStatus(message, isError) {
    const status = $("#dataStatus");
    if (!status) return;
    status.textContent = message || `${state.items.length} Work Item(s), ${state.evidence.length} evidence record(s). All processing is local.`;
    status.classList.toggle("error", Boolean(isError));
  }

  function download(filename, content, type) {
    if (!content) return;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getInputValue() {
    const input = $("#jsonInput") || $("#jsonPaste") || $("textarea");
    return input ? input.value : "";
  }

  function setInputValue(value) {
    const input = $("#jsonInput") || $("#jsonPaste") || $("textarea");
    if (input) input.value = value;
  }

  function on(selector, eventName, handler) {
    const element = $(selector);
    if (element) element.addEventListener(eventName, handler);
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function isTerminal(stateName) {
    return TERMINAL_STATES.has(String(stateName || "").toLowerCase());
  }

  function keywordHits(item, terms) {
    const text = `${item.title} ${item.description} ${item.acceptanceCriteria} ${item.tags.join(" ")}`.toLowerCase();
    return terms.filter((term) => text.includes(term)).length;
  }

  function daysSince(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86400000)) : 0;
  }

  function byScoreDesc(left, right) {
    return (right.score || 0) - (left.score || 0) || (left.id || 0) - (right.id || 0) || String(left.title).localeCompare(String(right.title));
  }

  function titleKey(title) {
    return String(title || "").toLowerCase().replace(/[#\d]/g, "").replace(/\b(the|a|an|for|to|in|with|and|und|der|die|das)\b/g, " ").replace(/\s+/g, " ").trim();
  }

  function statusRank(status) {
    return { gap: 0, review: 1, complete: 2 }[status] || 3;
  }

  function parentIdFromRelations(raw) {
    const relation = arrayFrom(raw.relations).find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
    const match = stringFrom(relation && relation.url).match(/\/(\d+)$/);
    return match ? Number(match[1]) : undefined;
  }

  function attachmentNames(raw) {
    return arrayFrom(raw.relations).filter((relation) => relation.rel === "AttachedFile").map((relation) => stringFrom(objectFrom(relation.attributes).name) || "attachment");
  }

  function linkNames(raw) {
    return arrayFrom(raw.relations).filter((relation) => relation.rel !== "AttachedFile" && relation.rel !== "System.LinkTypes.Hierarchy-Reverse").map((relation) => stringFrom(objectFrom(relation.attributes).name) || stringFrom(relation.rel) || "link");
  }

  function evidenceText(record) {
    const fields = objectFrom(record.fields);
    return [record.text, record.comment, record.message, record.summary, record.title, fields["System.History"]].map(stringFrom).filter(Boolean).join(" ");
  }

  function actorFrom(record) {
    return identity(record && (record.actor || record.revisedBy || record.createdBy || record.author)) || "";
  }

  function identity(value) {
    if (typeof value === "string") return value.trim();
    const object = objectFrom(value);
    return stringFrom(object.displayName) || stringFrom(object.uniqueName) || stringFrom(object.name);
  }

  function tagsFrom(value) {
    if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
    return stringFrom(value).split(";").map((entry) => entry.trim()).filter(Boolean);
  }

  function objectFrom(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function arrayFrom(value) {
    return Array.isArray(value) ? value : [];
  }

  function numberFrom(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function stringFrom(value) {
    return typeof value === "string" ? value : "";
  }

  function stripHtml(value) {
    return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function labelize(value) {
    return String(value).replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
