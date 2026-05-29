(() => {
  "use strict";

  const TERMINAL_STATES = new Set(["closed", "done", "completed", "removed", "inactive", "resolved"]);
  const REQUIREMENT_TYPES = new Set(["requirement", "user story", "feature", "epic", "product backlog item"]);
  const RISK_TERMS = ["audit", "compliance", "deadline", "security", "risk", "delay", "outage", "regulatory", "billing", "payment", "customer"];
  const VALUE_TERMS = ["automation", "customer", "finance", "integration", "production", "billing", "subscription", "revenue", "fulfillment"];
  const REPORTS = [
    { id: "delivery-risk", label: "Delivery Risk Radar", run: renderDeliveryRisk },
    { id: "requirement-decision", label: "Requirement Decision Cockpit", run: renderRequirementDecision },
    { id: "portfolio-rationalization", label: "Portfolio Rationalization", run: renderPortfolioRationalization },
    { id: "evidence-ledger", label: "Evidence Ledger", run: renderEvidenceLedger },
    { id: "steering-pack", label: "Executive Steering Pack", run: renderSteeringPack },
    { id: "bulk-close-preview", label: "Bulk Close Preview", run: renderBulkClosePreview },
    { id: "migration-cutover", label: "Migration Cutover Readiness", run: renderMigrationCutover },
    { id: "financial-ledger", label: "Financial Backlog Ledger", run: renderFinancialLedger },
    { id: "requirement-confidence", label: "Requirement Confidence Score", run: renderRequirementConfidence },
    { id: "rewrite-studio", label: "Requirement Rewrite Studio", run: renderRewriteStudio },
    { id: "exception-register", label: "Exception Register", run: renderExceptionRegister },
    { id: "operating-rhythm", label: "Operating Rhythm Planner", run: renderOperatingRhythm },
    { id: "okr-alignment", label: "OKR Alignment Scorer", run: renderOkrAlignment },
    { id: "compliance-readiness", label: "Compliance Readiness Review", run: renderComplianceReadiness },
    { id: "handover-pack", label: "Handover Pack Generator", run: renderHandoverPack },
    { id: "portfolio-fitness", label: "Portfolio Fitness Index", run: renderPortfolioFitness },
    { id: "elicitation-workbench", label: "Requirements Elicitation Workbench", run: renderElicitationWorkbench },
    { id: "gap-analysis", label: "Requirement Gap Analysis", run: renderGapAnalysis },
    { id: "text-transform", label: "Work Item Text Transform", run: renderTextTransform },
    { id: "convert-requirement", label: "Requirement Convert Workbench", run: renderConvertRequirement },
    { id: "test-factory", label: "Test Case Generation Factory", run: renderTestFactory },
    { id: "uat-suite", label: "UAT Suite Generator", run: renderUatSuite },
    { id: "regression-suite", label: "Regression Suite Generator", run: renderRegressionSuite },
    { id: "traceability", label: "Requirement-Test Traceability", run: renderTraceability },
    { id: "coverage", label: "Test Coverage Analysis", run: renderCoverage },
    { id: "defect-traceability", label: "Defect Traceability", run: renderDefectTraceability },
    { id: "mockup", label: "Mockup Generator", run: renderMockup },
    { id: "diagram", label: "Diagram Generator", run: renderDiagram },
    { id: "sop", label: "SOP Document Generator", run: renderSop },
    { id: "prompt-admin", label: "Prompt/Admin Preview", run: renderPromptAdmin },
    { id: "decision-memory", label: "Decision Memory", run: renderDecisionMemory },
    { id: "recommendation-quality", label: "Recommendation Quality Score", run: renderRecommendationQuality },
    { id: "value-inflation", label: "Value Inflation Detector", run: renderValueInflation },
    { id: "decision-court", label: "Decision Court", run: renderDecisionCourt },
    { id: "contract-lifecycle", label: "Requirement Contract Lifecycle", run: renderContractLifecycle },
    { id: "scenario-war-room", label: "Scenario War Room", run: renderScenarioWarRoom },
    { id: "autonomous-governance", label: "Autonomous Governance Agent", run: renderAutonomousGovernance },
    { id: "business-digital-twin", label: "Business Digital Twin", run: renderBusinessDigitalTwin },
    { id: "external-evidence", label: "External Evidence Import", run: renderExternalEvidence },
    { id: "event-log-mining", label: "Event Log Process Mining", run: renderEventLogMining },
    { id: "stakeholder-map", label: "Stakeholder Influence Map", run: renderStakeholderMap },
    { id: "roi-confidence", label: "ROI Confidence Workflow", run: renderRoiConfidence },
    { id: "enterprise-risk", label: "Enterprise Risk Heatmap", run: renderEnterpriseRisk },
    { id: "policy-studio", label: "Policy Studio", run: renderPolicyStudio },
    { id: "prompt-eval", label: "Prompt Eval Suite", run: renderPromptEval },
    { id: "model-risk", label: "Model Risk Governance", run: renderModelRisk },
    { id: "adoption-cockpit", label: "Adoption Cockpit", run: renderAdoptionCockpit },
    { id: "connector-readiness", label: "Connector Readiness Audit", run: renderConnectorReadiness },
    { id: "evidence-pipeline", label: "Evidence Ingestion Pipeline", run: renderEvidencePipeline },
    { id: "security-privacy", label: "Security Privacy Review", run: renderSecurityPrivacy },
    { id: "marketplace-readiness", label: "Marketplace Submission Readiness", run: renderMarketplaceReadiness },
    { id: "org-rollout", label: "Organization Rollout Readiness", run: renderOrgRollout },
    { id: "license-packaging", label: "License Packaging Advisor", run: renderLicensePackaging },
    { id: "customer-value-case", label: "Customer Value Case Builder", run: renderCustomerValueCase },
    { id: "signal-catalog", label: "Proprietary Signal Catalog", run: renderSignalCatalog },
    { id: "followup-scheduler", label: "Autonomous Followup Scheduler", run: renderFollowupScheduler },
    { id: "adoption-experiments", label: "Adoption Experiment Designer", run: renderAdoptionExperiments },
    { id: "persistent-snapshot", label: "Persistent Snapshot", run: renderPersistentSnapshot },
    { id: "approval-queue", label: "Approval Queue", run: renderApprovalQueue },
    { id: "audit-trail", label: "Decision Audit Trail", run: renderAuditTrail },
    { id: "role-cockpits", label: "Role Cockpit Configuration", run: renderRoleCockpits },
    { id: "admin-console", label: "Production Admin Console", run: renderAdminConsole },
    { id: "reminder-plan", label: "Automated Reminder Plan", run: renderReminderPlan },
    { id: "decision-pack", label: "Decision Pack Export", run: renderDecisionPack }
  ];

  const sampleItems = [
    {
      id: 101,
      type: "Feature",
      title: "Subscription billing validation workflow for finance close",
      state: "Active",
      assignedTo: "Mira Finance",
      priority: 1,
      tags: ["Compliance", "Finance", "Evidence"],
      createdDate: "2026-01-12T09:00:00Z",
      changedDate: "2026-05-08T13:25:00Z",
      areaPath: "Finance\\Billing",
      description: "Automate validation and audit evidence for subscription billing before month-end close. Current manual checks create revenue leakage risk and delay customer invoice release.",
      acceptanceCriteria: "Given inbound invoice records with contract evidence, when validation runs, then invalid tax, customer account, and archive cases are reported with a traceable approval decision.",
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
      areaPath: "Customer Success\\Portal",
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
      title: "Implement billing record parser",
      state: "Active",
      assignedTo: "Ravi Dev",
      priority: 2,
      parentId: 101,
      changedDate: "2026-05-10T11:00:00Z",
      description: "Parser implementation linked to the subscription billing validation feature.",
      acceptanceCriteria: "Parser rejects malformed billing records and stores validation evidence."
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
    },
    {
      id: 106,
      type: "Epic",
      title: "ERP cutover readiness for order-to-cash migration",
      state: "Active",
      assignedTo: "Iris PMO",
      priority: 1,
      tags: ["ERP", "Migration", "OrderToCash", "Cutover"],
      createdDate: "2026-03-05T09:00:00Z",
      changedDate: "2026-05-12T14:00:00Z",
      areaPath: "ERP\\OrderToCash",
      description: "Prepare order-to-cash migration readiness with owner sign-off, exception handling, finance evidence, and release rollback criteria.",
      acceptanceCriteria: "Cutover can proceed only when finance, operations, customer service, and integration owners approve readiness evidence.",
      fields: {
        "Custom.BusinessValue": 10,
        "Custom.TargetBenefit": 140000,
        "Custom.Cost": 65000,
        "Microsoft.VSTS.Scheduling.StoryPoints": 21
      },
      relations: [{ rel: "AttachedFile", attributes: { name: "cutover-readiness.xlsx" } }]
    }
  ];

  const sampleEvidence = [
    { workItemId: 101, type: "comment", actor: "Mira Finance", date: "2026-05-09T08:30:00Z", text: "Approved for audit review. Evidence: validation sample and finance sign-off attached." },
    { workItemId: 105, type: "update", actor: "Nina Ops", date: "2026-04-26T15:00:00Z", text: "Decision accepted: duplicate scope closed after warehouse review." },
    { workItemId: 106, type: "risk", actor: "Iris PMO", date: "2026-05-12T14:30:00Z", text: "Cutover needs final integration rollback approval before release readiness can be accepted." }
  ];

  const state = {
    items: sampleItems.map(clone),
    evidence: sampleEvidence.map(clone),
    activeTab: "input",
    currentReportId: REPORTS[0].id,
    lastReport: null,
    lastMarkdown: "",
    approvalPlan: null,
    approvalResult: null
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
          <h1>Azure Boards Review Cockpit</h1>
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
      portfolio: "portfolio-rationalization",
      governance: "evidence-ledger",
      productops: "persistent-snapshot",
      approval: "approval-queue",
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
      const reportTabs = new Set(["reports", "portfolio", "governance", "productops", "approval", "bulk"]);
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
    const report = baseReport("Executive Steering Pack", findings, `${findings.length} steering finding(s) prepared for executive review.`, metrics, [
      "Decide ownership for top escalations.",
      "Confirm scope, milestone confidence, and tradeoffs for the next steering cycle.",
      "Use board writes only through explicit preview/apply workflows."
    ]);
    report.markdown = [
      "# Executive Steering Pack",
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

  function renderMigrationCutover(items) {
    const normalized = items.map(normalizeItem);
    const critical = normalized.filter((item) => (item.priority || 3) <= 2 || /cutover|go-live|migration|regulatory|gudid|udi|integration|finance|production/i.test(`${item.title} ${item.description}`));
    const openCritical = critical.filter((item) => !isTerminal(item.state));
    const missingEvidence = critical.filter((item) => !evidenceSignals(item).length);
    const blockers = normalized.filter((item) => !isTerminal(item.state) && keywordHits(item, RISK_TERMS));
    const readinessScore = Math.max(0, 100 - openCritical.length * 8 - missingEvidence.length * 6 - blockers.length * 10);
    const goNoGo = readinessScore >= 80 ? "go" : readinessScore >= 55 ? "conditional-go" : "no-go";
    const findings = uniqueItems(openCritical.concat(missingEvidence, blockers)).map((item) => finding(item, 100 - readinessScore + (item.priority || 3) * 3, [`state ${item.state}`, `priority ${item.priority || "n/a"}`, evidenceSignals(item).length ? "evidence present" : "missing evidence"], "Resolve or explicitly accept this cutover risk before go-live."));
    const report = baseReport("Migration Cutover Readiness", findings, `Cutover readiness is ${goNoGo} with score ${readinessScore}/100.`, { readinessScore, openCritical: openCritical.length, missingEvidence: missingEvidence.length, blockers: blockers.length });
    report.readiness = { goNoGo, readinessScore };
    return report;
  }

  function renderFinancialLedger(items) {
    const ledger = items.map(normalizeItem).map((item) => {
      const expectedBenefit = targetBenefit(item);
      const realizedBenefit = realizedValue(item);
      const implementationCost = implementationCostFor(item);
      const delayCost = isTerminal(item.state) ? 0 : Math.min(120, daysSince(item.changedDate) || 1) * Math.max(1, 6 - (item.priority || 3)) * 250;
      return { id: item.id, title: item.title, state: item.state, expectedBenefit, realizedBenefit, implementationCost, delayCost, netValue: expectedBenefit + realizedBenefit - implementationCost - delayCost };
    }).sort((a, b) => b.netValue - a.netValue);
    const findings = ledger.map((row) => ({
      id: row.id,
      title: `#${row.id} ${row.title}`,
      score: Math.min(100, Math.abs(row.netValue) / 1000),
      severity: row.netValue < 0 ? "high" : "medium",
      signals: [`net value ${Math.round(row.netValue)}`, `expected ${Math.round(row.expectedBenefit)}`, `cost ${Math.round(row.implementationCost)}`, `delay ${Math.round(row.delayCost)}`],
      recommendation: row.netValue < 0 ? "Challenge or close unless a stronger business case exists." : "Protect capacity if evidence and owner are valid."
    }));
    const report = baseReport("Financial Backlog Ledger", findings, `${ledger.length} Work Item(s) translated into financial backlog ledger rows.`, { totalNetValue: Math.round(ledger.reduce((sum, row) => sum + row.netValue, 0)) });
    report.ledger = ledger;
    return report;
  }

  function renderRequirementConfidence(items) {
    const scores = items.map(normalizeItem).filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase())).map((item) => {
      const score = evidenceScore(item) + (item.assignedTo ? 15 : 0) + (targetBenefit(item) >= 25000 ? 15 : 0);
      const confidenceScore = clamp(score, 0, 100);
      const status = confidenceScore >= 75 ? "ready" : confidenceScore >= 45 ? "needs clarification" : "not investable";
      return { id: item.id, title: item.title, confidenceScore, status };
    });
    const findings = scores.map((row) => ({
      id: row.id,
      title: `#${row.id} ${row.title}`,
      score: row.confidenceScore,
      severity: row.status === "ready" ? "low" : row.status === "needs clarification" ? "medium" : "high",
      signals: [`status ${row.status}`, `confidence ${row.confidenceScore}`],
      recommendation: row.status === "ready" ? "Keep evidence current." : "Clarify evidence, owner, value, and acceptance criteria before investment."
    }));
    const report = baseReport("Requirement Confidence Score", findings, `${scores.length} requirement confidence score(s) generated.`, countBy(scores, "status"));
    report.scores = scores;
    return report;
  }

  function renderRewriteStudio(items) {
    const rewrites = items.map(normalizeItem).filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase())).map((item) => {
      const suggestedDescription = `Problem: ${item.description || "The current requirement does not state the business problem clearly."}\n\nGoal: Deliver a measurable business-process outcome with owner and evidence.\n\nBusiness value: Expected annual value USD ${Math.round(targetBenefit(item))}.\n\nNon-goals: Do not expand scope without approved business case.`;
      const suggestedAcceptanceCriteria = "- Expected outcome is observable.\n- Required evidence is attached or linked before closure.\n- Exceptions and rollback behavior are documented.\n- Benefit owner confirms realization tracking.";
      return { id: item.id, title: item.title, suggestedDescription, suggestedAcceptanceCriteria, patchPreview: [{ op: item.description ? "replace" : "add", path: "/fields/System.Description", value: suggestedDescription }, { op: item.acceptanceCriteria ? "replace" : "add", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: suggestedAcceptanceCriteria }], writePerformed: false };
    });
    const report = baseReport("Requirement Rewrite Studio", rewrites.map((row) => ({ id: row.id, title: `#${row.id} ${row.title}`, score: 70, severity: "medium", signals: ["rewrite patch preview prepared"], recommendation: "Review the proposed Description and Acceptance Criteria before applying any update." })), `${rewrites.length} rewrite preview(s) prepared.`, { rewrites: rewrites.length });
    report.rewrites = rewrites;
    return report;
  }

  function renderExceptionRegister(items, evidence) {
    const exceptions = items.map(normalizeItem).filter((item) => /exception|waiver|defer|accepted|approval|decision/i.test(`${item.title} ${item.description} ${evidenceForId(evidence, item.id).map(evidenceText).join(" ")}`)).map((item) => ({ id: item.id, title: item.title, owner: item.assignedTo || "unassigned", status: isTerminal(item.state) ? "closed-exception" : "open-exception", risk: keywordHits(item, RISK_TERMS) ? "high" : "medium" }));
    const report = baseReport("Exception Register", exceptions.map((row) => ({ id: row.id, title: `#${row.id} ${row.title}`, score: row.risk === "high" ? 85 : 60, severity: row.risk, signals: [`owner ${row.owner}`, `status ${row.status}`, `risk ${row.risk}`], recommendation: "Confirm exception owner, rationale, expiry, and compensating control." })), `${exceptions.length} exception candidate(s) found.`, { exceptions: exceptions.length });
    report.exceptions = exceptions;
    return report;
  }

  function renderOperatingRhythm(items) {
    const normalized = items.map(normalizeItem);
    const highRisk = normalized.filter((item) => !isTerminal(item.state) && ((item.priority || 3) <= 2 || keywordHits(item, RISK_TERMS))).slice(0, 10);
    const weak = normalized.filter((item) => isRequirement(item) && confidenceScore(item) < 45).slice(0, 15);
    const stale = normalized.filter((item) => !isTerminal(item.state) && daysSince(item.changedDate) > 30).slice(0, 20);
    const cadence = [
      { cadence: "daily", meeting: "Delivery risk standup", itemIds: highRisk.map((item) => item.id), decision: "Unblock, escalate, or accept risk." },
      { cadence: "weekly", meeting: "Requirement evidence clinic", itemIds: weak.map((item) => item.id), decision: "Rewrite, park, or close weak Requirements." },
      { cadence: "biweekly", meeting: "Process owner governance review", itemIds: stale.map((item) => item.id), decision: "Resolve stale work and policy gaps." },
      { cadence: "monthly", meeting: "Benefit realization review", itemIds: normalized.filter((item) => isTerminal(item.state) && targetBenefit(item) >= 25000 && realizedValue(item) === 0).map((item) => item.id), decision: "Confirm realized value or re-baseline business case." }
    ];
    const findings = cadence.filter((row) => row.itemIds.length).map((row) => ({ title: row.meeting, score: Math.min(100, row.itemIds.length * 12), severity: row.itemIds.length > 5 ? "high" : "medium", signals: [`cadence ${row.cadence}`, `${row.itemIds.length} target item(s)`], recommendation: row.decision }));
    const report = baseReport("Operating Rhythm Planner", findings, `${cadence.length} governance cadence block(s) prepared.`, { cadenceBlocks: cadence.length, activeBlocks: findings.length });
    report.cadence = cadence;
    return report;
  }

  function renderOkrAlignment(items) {
    const objectives = ["finance automation", "customer experience", "regulatory compliance", "integration stability", "operational efficiency"];
    const alignments = items.map(normalizeItem).map((item) => {
      const text = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
      const matched = objectives.filter((objective) => objective.split(/\s+/).some((word) => word.length > 3 && text.includes(word)));
      const score = Math.min(100, matched.length * 35 + (targetBenefit(item) >= 50000 ? 20 : 0) + ((item.priority || 3) <= 2 ? 10 : 0));
      return { id: item.id, title: item.title, status: score >= 70 ? "aligned" : score >= 35 ? "partial" : "unaligned", score, objectives: matched.join(", ") || "none" };
    });
    const findings = alignments.filter((row) => row.status !== "aligned").map((row) => ({ id: row.id, title: `#${row.id} ${row.title}`, score: 100 - row.score, severity: row.status === "unaligned" ? "high" : "medium", signals: [`status ${row.status}`, `objectives ${row.objectives}`], recommendation: "Clarify strategic objective or remove from active portfolio." }));
    const report = baseReport("OKR Alignment Scorer", findings, `${alignments.length} Work Item(s) scored against ${objectives.length} objective(s).`, { assessedItems: alignments.length, objectives: objectives.length });
    report.alignments = alignments;
    return report;
  }

  function renderComplianceReadiness(items) {
    const controls = items.map(normalizeItem).filter((item) => /regulatory|compliance|audit|gudid|udi|security|privacy/i.test(`${item.title} ${item.description} ${item.tags.join(" ")}`)).flatMap((item) => [
      controlRow(item, "owner", Boolean(item.assignedTo), "Missing accountable owner."),
      controlRow(item, "acceptance", item.acceptanceCriteria.length >= 40, "Missing testable acceptance criteria."),
      controlRow(item, "evidence", evidenceSignals(item).length > 0, "Missing audit or validation evidence."),
      controlRow(item, "exception", isTerminal(item.state) || !keywordHits(item, RISK_TERMS) || /decision|approved|exception|waiver/i.test(item.description), "Open risk has no decision or exception rationale.")
    ]);
    const failed = controls.filter((row) => row.status === "fail");
    const findings = failed.map((row) => ({ id: row.id, title: `#${row.id} ${row.title}`, score: 80, severity: "high", signals: [`control ${row.control}`, row.reason], recommendation: "Close the compliance evidence gap or document an explicit exception." }));
    const report = baseReport("Compliance Readiness Review", findings, `${failed.length} failed control(s) across ${controls.length} compliance checks.`, { controls: controls.length, failedControls: failed.length });
    report.controls = controls;
    return report;
  }

  function renderHandoverPack(items, evidence) {
    const normalized = items.map(normalizeItem);
    const critical = normalized.filter((item) => !isTerminal(item.state) && ((item.priority || 3) <= 2 || keywordHits(item, RISK_TERMS))).slice(0, 10);
    const decisions = normalized.filter((item) => /decision|approved|exception|waiver/i.test(`${item.description} ${evidenceForId(evidence, item.id).map(evidenceText).join(" ")}`)).slice(0, 10);
    const weak = normalized.filter((item) => isRequirement(item) && confidenceScore(item) < 45).slice(0, 10);
    const markdown = ["# Process Owner Handover Pack", "", "## Open Critical Work", ...critical.map((item) => `- #${item.id} ${item.title}`), "", "## Decisions And Exceptions", ...decisions.map((item) => `- #${item.id} ${item.title}`), "", "## Weak Requirements", ...weak.map((item) => `- #${item.id} ${item.title}: confidence ${confidenceScore(item)}/100`), "", "_No Azure Boards write was performed._"].join("\n");
    const findings = critical.concat(weak).map((item) => ({ id: item.id, title: `#${item.id} ${item.title}`, score: keywordHits(item, RISK_TERMS) ? 85 : 60, severity: keywordHits(item, RISK_TERMS) ? "high" : "medium", signals: [`owner ${item.assignedTo || "missing"}`, `confidence ${confidenceScore(item)}`], recommendation: "Include this item in the handover discussion." }));
    const report = baseReport("Handover Pack Generator", findings, "Handover pack generated from board evidence.", { critical: critical.length, decisions: decisions.length, weakRequirements: weak.length });
    report.markdown = markdown;
    return report;
  }

  function renderPortfolioFitness(items) {
    const normalized = items.map(normalizeItem);
    const open = normalized.filter((item) => !isTerminal(item.state));
    const stale = open.filter((item) => daysSince(item.changedDate) > 60);
    const ownerGaps = open.filter((item) => !item.assignedTo);
    const weak = normalized.filter((item) => isRequirement(item) && confidenceScore(item) < 45);
    const totalBenefit = normalized.reduce((sum, item) => sum + targetBenefit(item), 0);
    const totalCost = normalized.reduce((sum, item) => sum + implementationCostFor(item), 0);
    const ratio = totalCost ? totalBenefit / totalCost : 0;
    const score = Math.max(0, Math.min(100, Math.round(55 + Math.min(30, ratio * 10) - stale.length * 3 - ownerGaps.length * 2 - weak.length * 2)));
    const report = baseReport("Portfolio Fitness Index", stale.concat(ownerGaps, weak).map((item) => ({ id: item.id, title: `#${item.id} ${item.title}`, score: 70, severity: "medium", signals: [`changed ${daysSince(item.changedDate)} days ago`, `owner ${item.assignedTo || "missing"}`], recommendation: "Resolve, re-baseline, or remove from active portfolio." })), `Portfolio fitness is ${score >= 75 ? "healthy" : score >= 50 ? "strained" : "critical"} with score ${score}/100.`, { portfolioFitness: score, openItems: open.length, staleItems: stale.length, ownerGaps: ownerGaps.length, weakRequirements: weak.length });
    report.fitness = { score, valueCostRatio: Number(ratio.toFixed(2)), totalBenefit, totalCost };
    return report;
  }

  function renderElicitationWorkbench(items) {
    const requirements = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, userStory: `As a process owner, I want ${item.title.toLowerCase()} so that the outcome is measurable.`, confidence: confidenceScore(item), assumptions: ["Generated from local input only."], patchPreview: [{ op: "add", path: "/fields/System.Title", value: item.title }] }));
    const report = baseReport("Requirements Elicitation Workbench", requirements.map((row) => ({ id: row.id, title: `#${row.id} ${row.title}`, score: row.confidence, severity: row.confidence > 70 ? "medium" : "high", signals: ["elicited draft", "review required"], recommendation: "Review before creating or updating Azure Boards work." })), `${requirements.length} requirement draft(s) previewed.`, { requirements: requirements.length });
    report.requirements = requirements;
    return report;
  }

  function renderGapAnalysis(items, evidence) {
    const gaps = items.map(normalizeItem).filter(isRequirement).map((item) => ({ id: item.id, title: item.title, missing: [item.description.length < 80 ? "description" : "", item.acceptanceCriteria.length < 40 ? "acceptance" : "", item.assignedTo ? "" : "owner", evidenceSignals(item, evidence).length ? "" : "evidence"].filter(Boolean), qualityScore: confidenceScore(item) }));
    const report = baseReport("Requirement Gap Analysis", gaps.filter((row) => row.missing.length).map((row) => ({ id: row.id, title: `#${row.id} ${row.title}`, score: 100 - row.qualityScore, severity: "high", signals: row.missing, recommendation: "Clarify missing quality and evidence signals." })), `${gaps.length} requirement(s) analyzed.`, { gaps: gaps.filter((row) => row.missing.length).length });
    report.gaps = gaps;
    return report;
  }

  function renderTextTransform(items) {
    const item = normalizeItem(items[0] || {});
    const transformed = `${item.description || item.title}\n\nClarify business problem, target outcome, evidence, exception handling, owner, and acceptance criteria.`;
    const report = baseReport("Work Item Text Transform", [{ id: item.id, title: `#${item.id} ${item.title}`, score: 70, severity: "medium", signals: ["elaborate preview"], recommendation: "Review transformed text before applying a patch." }], "One Work Item text transform preview generated.", { transforms: 1 });
    report.transforms = [{ operation: "elaborate", transformedText: transformed, patchPreview: [{ op: "replace", path: "/fields/System.Description", value: transformed }] }];
    return report;
  }

  function renderConvertRequirement(items) {
    const item = normalizeItem(items[0] || {});
    const report = baseReport("Requirement Convert Workbench", [{ id: item.id, title: `#${item.id} ${item.title}`, score: confidenceScore(item), severity: "medium", signals: ["Gherkin preview"], recommendation: "Review conversion before creating linked artifacts." }], "Requirement converted to Gherkin.", { conversions: 1 });
    report.conversions = [{ id: item.id, target: "gherkin", content: `Feature: ${item.title}\nScenario: deliver outcome\nGiven process context\nWhen capability is used\nThen evidence is captured` }];
    return report;
  }

  function renderTestFactory(items) {
    const testCases = items.map(normalizeItem).filter(isRequirement).map((item) => ({ sourceRequirementId: item.id, title: `Test Case - ${item.title}`, steps: ["Prepare input data", "Execute process", "Validate evidence"], confidence: confidenceScore(item), patchPreview: [{ op: "add", path: "/fields/System.Title", value: `Test Case - ${item.title}` }] }));
    const report = baseReport("Test Case Generation Factory", testCases.map((row) => ({ id: row.sourceRequirementId, title: row.title, score: row.confidence, severity: "medium", signals: [`${row.steps.length} steps`], recommendation: "Review generated steps before apply." })), `${testCases.length} Test Case preview(s) generated.`, { testCases: testCases.length });
    report.testCases = testCases;
    return report;
  }

  function renderUatSuite(items) {
    const suite = items.map(normalizeItem).filter(isRequirement).map((item) => ({ requirementId: item.id, title: `UAT - ${item.title}`, script: ["Confirm preconditions", "Execute happy path", "Record sign-off"] }));
    const report = baseReport("UAT Suite Generator", suite.map((row) => ({ id: row.requirementId, title: row.title, score: 70, severity: "medium", signals: ["business script"], recommendation: "Review with business users." })), `${suite.length} UAT script(s) generated.`, { scripts: suite.length });
    report.suite = suite;
    return report;
  }

  function renderRegressionSuite(items) {
    const suite = items.map(normalizeItem).filter(isRequirement).map((item) => ({ requirementId: item.id, title: `Regression - ${item.title}`, priority: keywordHits(item, RISK_TERMS) ? "high" : "normal" }));
    const report = baseReport("Regression Suite Generator", suite.map((row) => ({ id: row.requirementId, title: row.title, score: row.priority === "high" ? 85 : 55, severity: row.priority === "high" ? "high" : "medium", signals: [`priority ${row.priority}`], recommendation: "Add to regression preview if coverage is missing." })), `${suite.length} regression candidate(s) generated.`, { regressionItems: suite.length });
    report.suite = suite;
    return report;
  }

  function renderTraceability(items) {
    const normalized = items.map(normalizeItem);
    const requirements = normalized.filter(isRequirement);
    const tests = normalized.filter((item) => /test/i.test(item.type) || /test/i.test(item.title));
    const links = requirements.flatMap((req) => tests.map((test) => ({ requirementId: req.id, testCaseId: test.id, relation: "TestedBy", confidence: 55, patchPreview: [{ op: "add", path: "/relations/-", value: test.id }] })));
    const report = baseReport("Requirement-Test Traceability", requirements.filter((req) => !links.some((link) => link.requirementId === req.id)).map((req) => ({ id: req.id, title: `#${req.id} ${req.title}`, score: 80, severity: "high", signals: ["missing linked test"], recommendation: "Generate or link at least one Test Case." })), `${links.length} traceability link preview(s) generated.`, { links: links.length });
    report.links = links;
    return report;
  }

  function renderCoverage(items) {
    const trace = renderTraceability(items);
    const coverage = items.map(normalizeItem).filter(isRequirement).map((item) => ({ requirementId: item.id, title: item.title, status: trace.links.some((link) => link.requirementId === item.id) ? "covered" : "missing" }));
    const report = baseReport("Test Coverage Analysis", coverage.filter((row) => row.status === "missing").map((row) => ({ id: row.requirementId, title: row.title, score: 85, severity: "high", signals: ["coverage missing"], recommendation: "Create, refresh, or de-duplicate test coverage." })), `${coverage.length} requirement(s) analyzed for test coverage.`, { coverageRows: coverage.length });
    report.coverage = coverage;
    return report;
  }

  function renderDefectTraceability(items) {
    const chains = items.map(normalizeItem).filter((item) => /bug|defect/i.test(item.type)).map((item) => ({ defectId: item.id, defectTitle: item.title, requirementId: item.parentId || null, testResult: "missing", confidence: item.parentId ? 60 : 30 }));
    const report = baseReport("Defect Traceability", chains.map((row) => ({ id: row.defectId, title: row.defectTitle, score: row.requirementId ? 50 : 75, severity: row.requirementId ? "medium" : "high", signals: [`requirement ${row.requirementId || "missing"}`], recommendation: "Link defect to requirement and failing test evidence." })), `${chains.length} defect traceability chain(s) analyzed.`, { defects: chains.length });
    report.chains = chains;
    return report;
  }

  function renderMockup(items) {
    const item = normalizeItem(items[0] || {});
    const report = baseReport("Mockup Generator", [{ id: item.id, title: item.title, score: 65, severity: "medium", signals: ["html mockup preview"], recommendation: "Review with users before treating as design intent." }], "One mockup preview generated.", { mockups: 1 });
    report.mockup = { sourceWorkItemId: item.id, format: "html", content: `<section><h1>${escapeHtml(item.title)}</h1><button>Submit for review</button></section>` };
    return report;
  }

  function renderDiagram(items) {
    const item = normalizeItem(items[0] || {});
    const report = baseReport("Diagram Generator", [{ id: item.id, title: item.title, score: 70, severity: "medium", signals: ["mermaid preview"], recommendation: "Review and version the diagram before publishing." }], "One diagram preview generated.", { diagrams: 1 });
    report.diagram = { sourceWorkItemId: item.id, format: "mermaid", content: `flowchart TD\nA["${item.title}"] --> B["Validate"] --> C["Evidence"]` };
    return report;
  }

  function renderSop(items) {
    const normalized = items.map(normalizeItem);
    const markdown = ["# Standard Operating Procedure", "", "## Scope", ...normalized.map((item) => `- #${item.id} ${item.title}`), "", "_No Azure Boards write was performed._"].join("\n");
    const report = baseReport("SOP Document Generator", normalized.map((item) => ({ id: item.id, title: item.title, score: 65, severity: "medium", signals: ["SOP source item"], recommendation: "Review SOP draft with process owner." })), "One SOP document draft generated.", { sourceItems: normalized.length });
    report.document = { format: "markdown", content: markdown };
    report.markdown = markdown;
    return report;
  }

  function renderPromptAdmin() {
    const report = baseReport("Prompt/Admin Preview", [{ title: "Default controls", score: 50, severity: "medium", signals: ["deterministic local fallback", "external-only secrets"], recommendation: "Validate hosted model settings before enabling private routing." }], "Prompt and admin configuration preview generated.", { issues: 0 });
    report.admin = { modelRanking: ["deterministic-local"], byodEnabled: false, secretStorage: "external-only" };
    return report;
  }

  function renderDecisionMemory(items, evidence) {
    const normalized = items.map(normalizeItem);
    const memory = normalized.map((item) => ({ workItemId: item.id, title: item.title, decision: isTerminal(item.state) ? "closed" : "open", rationale: item.description || "No rationale supplied.", decidedBy: item.assignedTo || "unknown", outcomeStatus: evidenceForId(evidence, item.id).length ? "observed" : "not observed", confidence: evidenceForId(evidence, item.id).length ? 80 : 45 }));
    const report = baseReport("Decision Memory", memory.filter((row) => row.outcomeStatus === "not observed").map((row) => ({ id: row.workItemId, title: row.title, score: 65, severity: "high", signals: [`decision ${row.decision}`, "missing outcome"], recommendation: "Add outcome evidence so future decisions can be audited." })), `${memory.length} decision memory entrie(s) assembled.`, { decisions: memory.length });
    report.memory = memory;
    return report;
  }

  function renderRecommendationQuality(items) {
    const scores = items.map(normalizeItem).map((item) => ({ workItemId: item.id, action: item.description.length < 80 ? "defer pending evidence" : "continue with controls", status: isTerminal(item.state) ? "confirmed" : "unknown", score: isTerminal(item.state) ? 90 : 50 }));
    const report = baseReport("Recommendation Quality Score", scores.filter((row) => row.status !== "confirmed").map((row) => ({ id: row.workItemId, title: row.action, score: 100 - row.score, severity: "medium", signals: [`status ${row.status}`], recommendation: "Add later outcome evidence to validate this recommendation." })), `${scores.length} recommendation(s) scored.`, { recommendations: scores.length });
    report.scores = scores;
    return report;
  }

  function renderValueInflation(items) {
    const inflation = items.map(normalizeItem).map((item) => {
      const fields = objectFrom(item.raw.fields);
      const businessValue = numberFrom(fields["Custom.BusinessValue"]) || 0;
      const evidence = evidenceScore(item);
      const inflationScore = Math.max(0, businessValue * 10 - evidence);
      return { id: item.id, title: item.title, businessValue, evidenceScore: evidence, inflationScore, status: inflationScore > 35 ? "challenge" : "supported" };
    });
    const report = baseReport("Value Inflation Detector", inflation.filter((row) => row.status !== "supported").map((row) => ({ id: row.id, title: row.title, score: row.inflationScore, severity: "high", signals: [`business value ${row.businessValue}`, `evidence ${row.evidenceScore}`], recommendation: "Challenge claimed value or request stronger benefit evidence." })), `${inflation.length} Work Item(s) checked for inflated value claims.`, { assessedItems: inflation.length });
    report.inflation = inflation;
    return report;
  }

  function renderDecisionCourt(items) {
    const cases = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, action: item.description.length < 80 ? "defer pending evidence" : "continue with controls", pro: [item.assignedTo ? "owner present" : "weak ownership"], contra: [item.acceptanceCriteria ? "delivery scope may be valid" : "acceptance missing"], missingFacts: [item.assignedTo ? "" : "owner", item.description.length >= 80 ? "" : "problem/value"].filter(Boolean), confidence: confidenceScore(item) }));
    const report = baseReport("Decision Court", cases.filter((row) => row.missingFacts.length).map((row) => ({ id: row.id, title: row.title, score: 100 - row.confidence, severity: "high", signals: row.missingFacts, recommendation: "Review court arguments before approving the recommendation." })), `${cases.length} decision court case(s) prepared.`, { cases: cases.length });
    report.cases = cases;
    return report;
  }

  function renderContractLifecycle(items) {
    const contracts = items.map(normalizeItem).filter(isRequirement).map((item) => ({ id: item.id, title: item.title, metric: /customer|support/i.test(`${item.title} ${item.description}`) ? "support ticket reduction" : "measurable business process outcome", owner: item.assignedTo || "unassigned", status: item.assignedTo ? "draft-ready" : "owner-missing", patchPreview: [{ op: item.description ? "replace" : "add", path: "/fields/System.Description", value: `Outcome metric: measurable business process outcome\nOwner: ${item.assignedTo || "unassigned"}` }] }));
    const report = baseReport("Requirement Contract Lifecycle", contracts.map((row) => ({ id: row.id, title: row.title, score: row.status === "owner-missing" ? 80 : 55, severity: row.status === "owner-missing" ? "high" : "medium", signals: [`status ${row.status}`, `metric ${row.metric}`], recommendation: "Review the outcome contract before applying the Description patch." })), `${contracts.length} outcome contract draft(s) generated.`, { contracts: contracts.length });
    report.contracts = contracts;
    return report;
  }

  function renderScenarioWarRoom(items) {
    const normalized = items.map(normalizeItem);
    const scenarios = ["Budget minus 20 percent", "Fixed go-live", "Compliance priority"].map((name) => ({ name, atRisk: normalized.filter((item) => !isTerminal(item.state) && (name.includes("Budget") ? !keywordHits(item, VALUE_TERMS) : keywordHits(item, RISK_TERMS))).map((item) => item.id), protectedItems: normalized.filter((item) => keywordHits(item, VALUE_TERMS)).map((item) => item.id), recommendation: "reduce scope and protect critical controls", confidence: 70 }));
    const report = baseReport("Scenario War Room", scenarios.map((row) => ({ title: row.name, score: 100 - row.confidence, severity: "medium", signals: [`at risk ${row.atRisk.length}`], recommendation: row.recommendation })), `${scenarios.length} management scenario(s) simulated.`, { scenarios: scenarios.length });
    report.scenarios = scenarios;
    return report;
  }

  function renderAutonomousGovernance(items) {
    const watchlist = items.map(normalizeItem).filter((item) => !isTerminal(item.state) && (!item.assignedTo || item.description.length < 80 || keywordHits(item, RISK_TERMS))).map((item) => ({ id: item.id, title: item.title, reason: [!item.assignedTo ? "missing owner" : "", item.description.length < 80 ? "weak description" : "", keywordHits(item, RISK_TERMS) ? "risk language" : ""].filter(Boolean) }));
    const agenda = [{ topic: "Top governance risks", itemIds: watchlist.slice(0, 10).map((entry) => entry.id), decisionNeeded: "assign owner, improve evidence, close, or accept risk" }];
    const actionPreviews = watchlist.map((entry) => ({ id: entry.id, title: entry.title, patchPreview: [{ op: "add", path: "/fields/System.Tags", value: "Governance Review" }], writePerformed: false }));
    const report = baseReport("Autonomous Governance Agent", watchlist.map((entry) => ({ id: entry.id, title: entry.title, score: 75, severity: "high", signals: entry.reason, recommendation: "Review in the next governance cycle and approve any patch separately." })), `${watchlist.length} watchlist item(s), ${agenda.length} agenda block(s), and ${actionPreviews.length} action preview(s) prepared.`, { watchlist: watchlist.length, agenda: agenda.length });
    report.watchlist = watchlist;
    report.agenda = agenda;
    report.actionPreviews = actionPreviews;
    return report;
  }

  function renderBusinessDigitalTwin(items, evidence) {
    const twin = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, kpiName: "business impact", impactScore: Math.min(100, valueScore(item) + evidenceForId(evidence, item.id).length * 12), linkedEvidence: evidenceForId(evidence, item.id).length, businessEffect: valueScore(item) > 50 ? "material" : "unproven" }));
    const report = baseReport("Business Digital Twin", twin.filter((row) => row.businessEffect === "unproven").map((row) => ({ id: row.id, title: row.title, score: 75, severity: "high", signals: [`linked evidence ${row.linkedEvidence}`], recommendation: "Link this work to external KPI evidence or lower its portfolio confidence." })), `${twin.length} Work Item(s) mapped to business-impact signals.`, { mappedItems: twin.length });
    report.twin = twin;
    return report;
  }

  function renderExternalEvidence(items, evidence) {
    const importedEvidence = (evidence.length ? evidence : items).map((record, index) => ({ id: index + 1, workItemId: record.workItemId || record.id || null, evidenceType: record.type || "generic", title: record.title || `Evidence ${index + 1}`, confidence: record.workItemId || record.id ? 70 : 30, normalized: true }));
    const report = baseReport("External Evidence Import", importedEvidence.filter((row) => !row.workItemId).map((row) => ({ id: row.id, title: row.title, score: 55, severity: "medium", signals: ["missing Work Item link"], recommendation: "Map external evidence to a Work Item before using it for decision assurance." })), `${importedEvidence.length} external evidence record(s) normalized.`, { records: importedEvidence.length });
    report.importedEvidence = importedEvidence;
    return report;
  }

  function renderEventLogMining() {
    const processMap = { transitions: { "Created -> Approved": 1 }, bottlenecks: [{ caseId: "sample", from: "Created", to: "Approved", waitHours: 72 }] };
    const report = baseReport("Event Log Process Mining", [{ title: "Created -> Approved", score: 72, severity: "high", signals: ["sample case", "72 hours"], recommendation: "Investigate this process wait outside Azure Boards state history." }], "2 event(s), 1 case(s), and 1 transition(s) analyzed.", { events: 2, cases: 1, bottlenecks: 1 });
    report.processMap = processMap;
    return report;
  }

  function renderStakeholderMap(items) {
    const normalized = items.map(normalizeItem);
    const nodes = normalized.map((item) => ({ id: `wi:${item.id}`, kind: "workItem", title: item.title }));
    const edges = normalized.map((item) => ({ from: item.assignedTo || "stakeholder:unknown", to: `wi:${item.id}`, relation: item.assignedTo ? "owns-or-influences" : "missing-accountability" }));
    const report = baseReport("Stakeholder Influence Map", edges.filter((edge) => edge.relation === "missing-accountability").map((edge) => ({ title: edge.to, score: 70, severity: "high", signals: ["missing stakeholder owner"], recommendation: "Identify decision owner, beneficiary, blocker, and cost owner." })), `${nodes.length} Work Item(s) and ${edges.length} influence edge(s) mapped.`, { workItems: nodes.length, edges: edges.length });
    report.map = { nodes, edges };
    return report;
  }

  function renderRoiConfidence(items, evidence) {
    const roi = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, expectedBenefit: targetBenefit(item), maturity: evidenceForId(evidence, item.id).length ? "evidence-backed" : "rough-estimate", confidence: evidenceForId(evidence, item.id).length ? 65 : 35 }));
    const report = baseReport("ROI Confidence Workflow", roi.filter((row) => row.confidence < 65).map((row) => ({ id: row.id, title: row.title, score: 100 - row.confidence, severity: "high", signals: [`maturity ${row.maturity}`], recommendation: "Request finance evidence or downgrade ROI confidence." })), `${roi.length} Work Item(s) assessed for ROI maturity.`, { assessedItems: roi.length });
    report.roi = roi;
    return report;
  }

  function renderEnterpriseRisk(items) {
    const heatmap = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, delivery: item.description.length < 80 ? 70 : 35, compliance: keywordHits(item, RISK_TERMS) ? 70 : 20, finance: keywordHits(item, VALUE_TERMS) ? 50 : 25, test: 60, ownership: item.assignedTo ? 10 : 80, total: item.assignedTo ? 45 : 70, band: item.assignedTo ? "elevated" : "critical" }));
    const report = baseReport("Enterprise Risk Heatmap", heatmap.filter((row) => row.band !== "normal").map((row) => ({ id: row.id, title: row.title, score: row.total, severity: row.band === "critical" ? "critical" : "high", signals: [`delivery ${row.delivery}`, `ownership ${row.ownership}`], recommendation: "Review enterprise risk and assign mitigation owner." })), `${heatmap.length} Work Item(s) scored across risk dimensions.`, { assessedItems: heatmap.length });
    report.heatmap = heatmap;
    return report;
  }

  function renderPolicyStudio(items) {
    const simulation = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, violations: [item.description ? "" : "System.Description", item.acceptanceCriteria ? "" : "AcceptanceCriteria", item.assignedTo ? "" : "System.AssignedTo"].filter(Boolean), status: item.description && item.acceptanceCriteria && item.assignedTo ? "would-pass" : "would-fail" }));
    const report = baseReport("Policy Studio", simulation.filter((row) => row.status === "would-fail").map((row) => ({ id: row.id, title: row.title, score: 65, severity: "high", signals: row.violations, recommendation: "Fix policy violations or add an exception before enforcing this policy." })), `${simulation.length} Work Item(s) simulated against a draft policy.`, { simulatedItems: simulation.length });
    report.policyDraft = { name: "Generated governance policy", requiredFields: ["System.Description", "AcceptanceCriteria", "System.AssignedTo"], version: "draft" };
    report.simulation = simulation;
    return report;
  }

  function renderPromptEval() {
    const evals = [{ id: 1, name: "default no-write prompt", cases: 1, failures: 0, status: "passed" }];
    const report = baseReport("Prompt Eval Suite", [], "1 prompt evaluated for no-write and stability expectations.", { prompts: 1 });
    report.evals = evals;
    return report;
  }

  function renderModelRisk() {
    const modelRisk = [{ id: 1, name: "deterministic-local", hosting: "local", risk: 25, recommendation: "Allowed with configured data policy." }];
    const report = baseReport("Model Risk Governance", [], "1 model route evaluated against data classes.", { models: 1 });
    report.modelRisk = modelRisk;
    report.policy = { secretStorage: "external-only", defaultRoute: "deterministic-local" };
    return report;
  }

  function renderAdoptionCockpit(items) {
    const adoption = [{ team: "Sample", activeUsers: 0, runs: 0, approvedPreviews: 0, adoptionScore: Math.min(40, items.length * 2), status: "low" }];
    const report = baseReport("Adoption Cockpit", adoption.map((row) => ({ title: row.team, score: 100 - row.adoptionScore, severity: "medium", signals: [`status ${row.status}`], recommendation: "Plan enablement, prompt templates, or governance cadence for this team." })), `${adoption.length} team adoption row(s) generated.`, { teams: adoption.length });
    report.adoption = adoption;
    return report;
  }

  function renderConnectorReadiness() {
    const readiness = [
      { connector: "Azure Boards", status: "ready", score: 100, missing: [] },
      { connector: "Azure Test Plans", status: "partial", score: 55, missing: ["health check"] },
      { connector: "ERP", status: "missing", score: 20, missing: ["configuration", "owner", "scopes"] }
    ];
    const report = baseReport("Connector Readiness Audit", readiness.filter((row) => row.status !== "ready").map((row) => ({ title: row.connector, score: 100 - row.score, severity: "high", signals: row.missing, recommendation: "Complete connector onboarding before enterprise rollout." })), `${readiness.length} enterprise connector(s) assessed.`, { connectors: readiness.length });
    report.readiness = readiness;
    return report;
  }

  function renderEvidencePipeline(items, evidence) {
    const pipeline = (evidence.length ? evidence : [{ workItemId: 101, title: "sample evidence", type: "csv" }]).map((entry, index) => ({ id: index + 1, workItemId: entry.workItemId || entry.id || "", title: entry.title || entry.name || `Evidence ${index + 1}`, type: entry.type || "text", classification: entry.secret ? "sensitive" : "internal", retainContent: false, status: entry.workItemId || entry.id ? "linkable" : "needs-mapping" }));
    const report = baseReport("Evidence Ingestion Pipeline", pipeline.filter((row) => row.status !== "linkable").map((row) => ({ title: row.title, score: 60, severity: "medium", signals: [`status ${row.status}`], recommendation: "Map evidence to a Work Item before using it in reports." })), `${pipeline.length} evidence record(s) normalized without persisted content.`, { records: pipeline.length });
    report.pipeline = pipeline;
    return report;
  }

  function renderSecurityPrivacy() {
    const controls = [
      { name: "tenant isolation", status: "missing", score: 20 },
      { name: "rbac", status: "missing", score: 20 },
      { name: "audit log", status: "missing", score: 20 },
      { name: "data redaction", status: "ready", score: 90 }
    ];
    const report = baseReport("Security Privacy Review", controls.filter((row) => row.status !== "ready").map((row) => ({ title: row.name, score: 100 - row.score, severity: "high", signals: [`status ${row.status}`], recommendation: "Add this enterprise control before hosted rollout." })), `${controls.length} security and privacy control(s) reviewed.`, { controls: controls.length });
    report.controls = controls;
    return report;
  }

  function renderMarketplaceReadiness() {
    const checklist = ["privacyUrl", "termsUrl", "supportUrl", "screenshots", "hostedMcpUrl"].map((item, index) => ({ id: index + 1, item, status: index < 2 ? "ready" : "missing", recommendation: `Add ${item} before review.` }));
    const report = baseReport("Marketplace Submission Readiness", checklist.filter((row) => row.status !== "ready").map((row) => ({ title: row.item, score: 85, severity: "high", signals: [`status ${row.status}`], recommendation: row.recommendation })), `${checklist.length} marketplace readiness item(s) checked.`, { items: checklist.length });
    report.checklist = checklist;
    return report;
  }

  function renderOrgRollout() {
    const rollout = [
      { area: "executive sponsor", status: "ready", score: 90 },
      { area: "admin consent", status: "missing", score: 25 },
      { area: "training plan", status: "missing", score: 25 },
      { area: "ERP pilot team", status: "pilot-needed", score: 55 }
    ];
    const report = baseReport("Organization Rollout Readiness", rollout.filter((row) => row.status !== "ready").map((row) => ({ title: row.area, score: 100 - row.score, severity: "high", signals: [`status ${row.status}`], recommendation: "Confirm owner, pilot scope, and enablement before rollout." })), `${rollout.length} rollout control(s) evaluated.`, { controls: rollout.length });
    report.rollout = rollout;
    return report;
  }

  function renderLicensePackaging() {
    const packages = [
      { edition: "Team", fitScore: 45, gates: ["read-only analytics", "basic previews"] },
      { edition: "Enterprise", fitScore: 88, gates: ["hosted MCP", "RBAC", "audit log"] },
      { edition: "Regulated", fitScore: 70, gates: ["private model routing", "redaction"] }
    ];
    const report = baseReport("License Packaging Advisor", [{ title: "Recommended edition: Enterprise", score: 88, severity: "low", signals: ["governance signals", "approval workflow"], recommendation: "Package enterprise controls as the default paid tier." }], `${packages.length} commercial package option(s) scored.`, { packages: packages.length });
    report.packages = packages;
    return report;
  }

  function renderCustomerValueCase(items, evidence) {
    const valueCases = items.map(normalizeItem).map((item) => ({ id: item.id, title: item.title, estimatedAnnualValue: targetBenefit(item), confidence: evidenceForId(evidence, item.id).length ? 75 : 45, status: evidenceForId(evidence, item.id).length ? "sales-ready" : "needs-evidence" }));
    const report = baseReport("Customer Value Case Builder", valueCases.filter((row) => row.status !== "sales-ready").map((row) => ({ id: row.id, title: row.title, score: 100 - row.confidence, severity: "medium", signals: [`confidence ${row.confidence}`], recommendation: "Add finance evidence and measurable outcome before using this as a customer value case." })), `${valueCases.length} customer value case(s) drafted.`, { cases: valueCases.length });
    report.valueCases = valueCases;
    return report;
  }

  function renderSignalCatalog(items, evidence) {
    const signals = [
      { name: "poor-description-patterns", count: items.filter((item) => normalizeItem(item).description.length < 80).length, strength: "emerging" },
      { name: "evidence-backed-closure", count: evidence.length, strength: evidence.length >= 3 ? "strong" : "weak" },
      { name: "feedback-labels", count: 0, strength: "weak" }
    ];
    const report = baseReport("Proprietary Signal Catalog", signals.filter((row) => row.strength === "weak").map((row) => ({ title: row.name, score: 65, severity: "medium", signals: [`count ${row.count}`], recommendation: "Collect more labeled examples before claiming this as a durable data advantage." })), `${signals.length} data-moat signal families cataloged.`, { signalFamilies: signals.length });
    report.signals = signals;
    return report;
  }

  function renderFollowupScheduler(items) {
    const followups = items.map(normalizeItem).filter((item) => !TERMINAL_STATES.has((item.state || "").toLowerCase())).slice(0, 10).map((item) => ({ id: item.id, title: item.title, owner: item.assignedTo || "unassigned", reason: item.assignedTo ? "stale-item-review" : "decision-or-risk-followup", channel: "manual-review", writePerformed: false }));
    const report = baseReport("Autonomous Followup Scheduler", followups.map((row) => ({ id: row.id, title: row.title, score: row.owner === "unassigned" ? 80 : 55, severity: "high", signals: [`owner ${row.owner}`, `reason ${row.reason}`], recommendation: "Review and schedule this follow-up through a separate communication workflow." })), `${followups.length} no-write follow-up recommendation(s) prepared.`, { followups: followups.length });
    report.followups = followups;
    return report;
  }

  function renderAdoptionExperiments() {
    const experiments = [{ team: "ERP pilot", targetOutcome: "increase approved preview usage", baselineRuns: 0, durationDays: 30, successMetric: "approved previews per active user" }];
    const report = baseReport("Adoption Experiment Designer", experiments.map((row) => ({ title: row.team, score: 70, severity: "medium", signals: [`baseline runs ${row.baselineRuns}`, `duration ${row.durationDays} days`], recommendation: "Run the experiment with explicit success metrics and compare before and after adoption." })), `${experiments.length} adoption experiment(s) designed.`, { experiments: experiments.length });
    report.experiments = experiments;
    return report;
  }

  function renderPersistentSnapshot(items, evidence) {
    const normalized = items.map(normalizeItem);
    const open = normalized.filter((item) => !TERMINAL_STATES.has(item.state.toLowerCase())).length;
    const stale = normalized.filter((item) => daysSince(item.changedDate) > 21 && !TERMINAL_STATES.has(item.state.toLowerCase())).length;
    const snapshot = {
      name: "weekly-erp-control",
      itemCount: normalized.length,
      evidenceCount: evidence.length,
      fingerprint: String(normalized.length) + "-" + String(evidence.length) + "-" + String(stale),
      metrics: { open, closed: normalized.length - open, stale },
      retention: "local-user-store"
    };
    const report = baseReport("Persistent Snapshot", stale ? [{ title: "Stale open work in baseline", score: 75, severity: "high", signals: [`${stale} stale item(s)`], recommendation: "Save a named baseline and compare the next review against this snapshot." }] : [], `${snapshot.name} captures board metrics, evidence count, and a deterministic fingerprint for later drift review.`, { items: normalized.length, evidence: evidence.length, stale });
    report.snapshot = snapshot;
    return report;
  }

  function renderApprovalQueue(items) {
    const queue = items.map(normalizeItem).filter((item) => !TERMINAL_STATES.has(item.state.toLowerCase())).slice(0, 8).map((item, index) => {
      const highRisk = (item.priority || 99) <= 1 || item.tags.some((tag) => /compliance|finance|migration|erp/i.test(tag));
      return {
        id: `approval-${index + 1}`,
        workItemId: item.id,
        title: item.title,
        status: "pending",
        selected: !highRisk,
        risk: highRisk ? "high" : item.assignedTo ? "medium" : "medium",
        recommendation: highRisk ? "Require accountable owner approval before apply." : "Eligible for selected apply preview after review.",
        verification: "Re-read, apply selected item, re-query."
      };
    });
    const report = baseReport("Approval Queue", queue.map((row) => ({ id: row.workItemId, title: row.title, score: row.risk === "high" ? 85 : 55, severity: row.risk, signals: [`status ${row.status}`, `selected ${row.selected}`], recommendation: row.recommendation })), `${queue.length} recommendation(s) staged for approval review.`, { pending: queue.length, selected: queue.filter((row) => row.selected).length });
    report.queue = queue;
    return report;
  }

  function renderAuditTrail(items, evidence) {
    const trail = evidence.map((entry, index) => ({
      id: `audit-${index + 1}`,
      workItemId: entry.workItemId || "",
      actor: entry.actor || "unknown",
      action: /accepted|approved/i.test(entry.text || "") ? "accepted" : /rejected|declined/i.test(entry.text || "") ? "rejected" : "recorded",
      rationale: entry.text || "Evidence record supplied.",
      outcome: "pending-verification"
    }));
    const report = baseReport("Decision Audit Trail", trail.map((row) => ({ id: row.workItemId, title: `${row.action} by ${row.actor}`, score: row.action === "recorded" ? 45 : 30, severity: "medium", signals: [row.outcome], recommendation: "Keep the decision event linked to the Work Item and verify outcome later." })), `${trail.length} decision event(s) normalized for audit review.`, { events: trail.length });
    report.trail = trail;
    return report;
  }

  function renderRoleCockpits(items) {
    const roles = [
      { role: "product-owner", title: "Product Owner Decision Cockpit", reports: ["Requirement Decision", "Approval Queue", "Gap Analysis"] },
      { role: "scrum-master", title: "Scrum Master Flow Cockpit", reports: ["Watchlist", "Flow Mining", "Reminder Plan"] },
      { role: "cio", title: "CIO Portfolio Cockpit", reports: ["Steering Pack", "Portfolio Fitness", "Benefit Follow-up"] },
      { role: "compliance", title: "Compliance Evidence Cockpit", reports: ["Evidence Ledger", "Audit Trail", "Policy Review"] }
    ];
    const report = baseReport("Role Cockpit Configuration", roles.map((row) => ({ title: row.title, score: 35, severity: "low", signals: row.reports, recommendation: "Use this as the default cockpit for the role." })), `${roles.length} role cockpit(s) prepared for the same board data.`, { roles: roles.length, items: items.length });
    report.cockpits = roles;
    return report;
  }

  function renderAdminConsole() {
    const controls = [
      { name: "policies", status: "ready", value: "versioned policy packs" },
      { name: "thresholds", status: "ready", value: "SLA 14 days, stale 21 days" },
      { name: "risk weights", status: "ready", value: "stale, blocked, unassigned, value" },
      { name: "data classes", status: "ready", value: "work-items, comments, evidence metadata" },
      { name: "LLM mode", status: "ready", value: "deterministic-local" },
      { name: "hosted MCP", status: "missing", value: "production endpoint required" },
      { name: "OAuth", status: "missing", value: "production Entra app required" }
    ];
    const report = baseReport("Production Admin Console", controls.filter((row) => row.status !== "ready").map((row) => ({ title: row.name, score: 85, severity: "high", signals: [row.value], recommendation: "Complete before production listing." })), `${controls.filter((row) => row.status === "ready").length}/${controls.length} admin controls ready.`, { controls: controls.length, ready: controls.filter((row) => row.status === "ready").length });
    report.adminControls = controls;
    return report;
  }

  function renderReminderPlan(items) {
    const reminders = items.map(normalizeItem).filter((item) => !TERMINAL_STATES.has(item.state.toLowerCase()) && (daysSince(item.changedDate) > 14 || !item.assignedTo)).slice(0, 8).map((item, index) => ({
      id: `reminder-${index + 1}`,
      type: targetBenefit(item) > 50000 ? "benefit-followup" : "watchlist",
      workItemId: item.id,
      title: item.title,
      owner: item.assignedTo || "process-owner",
      nextRun: "next review cycle",
      schedule: targetBenefit(item) > 50000 ? "FREQ=MONTHLY;INTERVAL=1" : "FREQ=DAILY;INTERVAL=7",
      message: "Review status, evidence, owner, and realized benefit."
    }));
    const report = baseReport("Automated Reminder Plan", reminders.map((row) => ({ id: row.workItemId, title: row.title, score: 60, severity: "medium", signals: [row.type, row.nextRun], recommendation: row.message })), `${reminders.length} reminder recommendation(s) prepared.`, { reminders: reminders.length });
    report.reminders = reminders;
    return report;
  }

  function renderDecisionPack(items, evidence) {
    const top = items.map(normalizeItem).slice(0, 5);
    const pack = {
      name: "cio-decision-pack",
      audience: "CIO",
      exports: ["Markdown", "JSON"],
      sections: ["Steering Pack", "Audit Pack", "Handover Pack", "Operating Rhythm"]
    };
    const report = baseReport("Decision Pack Export", top.map((item) => finding(item, targetBenefit(item) > 50000 ? 65 : 35, [`value ${targetBenefit(item)}`, `${evidenceForId(evidence, item.id).length} evidence record(s)`], "Include in the decision pack with owner, evidence, and next action.")), `${pack.name} combines steering, audit, handover, and rhythm sections.`, { items: top.length, evidence: evidence.length });
    report.pack = pack;
    report.markdown = `# ${pack.name}\n\n## Steering Pack\n${top.map((item) => `- #${item.id} ${item.title}`).join("\n")}\n\n## Audit Pack\nAccepted decisions, overrides, evidence gaps, and result-review status are included for compliance review.\n\n## Handover Pack\nOwners and evidence are listed for review.\n\n## Operating Rhythm\nReview pending approvals and benefit follow-ups in the next cycle.`;
    report.manifest = {
      schema: "rw.azureBoards.decisionPack.v1",
      exports: [
        { format: "json", filename: "cio-decision-pack.json" },
        { format: "markdown", filename: "cio-decision-pack.md" }
      ],
      imports: [{ format: "json", requiredSections: ["Steering Pack", "Audit Pack", "Handover Pack", "Operating Rhythm"] }]
    };
    report.importReview = { status: "ready", controls: ["name", "steering", "audit", "handover", "operating rhythm", "markdown"] };
    return report;
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
      renderWorkflowControls(report),
      `<details><summary>Raw JSON</summary><pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre></details>`,
      `</article>`
    ].join("");
    bindWorkflowControls(report);
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

  function renderWorkflowControls(report) {
    if (report.queue) {
      return [
        `<section class="workflow-panel" aria-label="Approval workflow">`,
        `<h3>Review and apply workflow</h3>`,
        `<div class="approval-list">${report.queue.map((row) => `
          <label class="approval-row">
            <input type="checkbox" data-approval-id="${escapeAttr(row.id)}" ${row.selected ? "checked" : ""}>
            <span><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.risk)} risk · #${escapeHtml(String(row.workItemId || ""))}</small></span>
          </label>`).join("")}</div>`,
        `<div class="button-row">
          <button class="button button--primary" type="button" id="approvalPlanButton">Prepare apply plan</button>
          <button class="button" type="button" id="approvalVerifyButton">Verify sample result</button>
        </div>`,
        `<div id="approvalWorkflowResult">${renderApprovalWorkflowResult()}</div>`,
        `</section>`
      ].join("");
    }
    return "";
  }

  function renderApprovalWorkflowResult() {
    const parts = [];
    if (state.approvalPlan) {
      parts.push(`<section><h4>Apply plan</h4>${table(["ID", "Work Item", "Status", "Verification"], state.approvalPlan.plan.map((row) => [row.id, row.workItemId, row.status, arrayFrom(row.verification).join("; ")]))}</section>`);
    }
    if (state.approvalResult) {
      parts.push(`<section><h4>Result review</h4>${table(["ID", "Work Item", "Result", "Current State", "Verified"], state.approvalResult.verification.map((row) => [row.recommendationId, row.workItemId, row.applyResult, row.currentState, row.verified]))}</section>`);
    }
    return parts.join("");
  }

  function bindWorkflowControls(report) {
    const planButton = $("#approvalPlanButton");
    if (planButton && report.queue) {
      planButton.addEventListener("click", () => {
        state.approvalPlan = buildApprovalApplyPlan(report.queue);
        state.approvalResult = null;
        const target = $("#approvalWorkflowResult");
        if (target) target.innerHTML = renderApprovalWorkflowResult();
      });
    }
    const verifyButton = $("#approvalVerifyButton");
    if (verifyButton && report.queue) {
      verifyButton.addEventListener("click", () => {
        if (!state.approvalPlan) state.approvalPlan = buildApprovalApplyPlan(report.queue);
        state.approvalResult = buildApprovalResultReview(state.approvalPlan.plan);
        const target = $("#approvalWorkflowResult");
        if (target) target.innerHTML = renderApprovalWorkflowResult();
      });
    }
  }

  function buildApprovalApplyPlan(queue) {
    const selected = new Set($$("[data-approval-id]").filter((input) => input.checked).map((input) => input.dataset.approvalId));
    const plan = queue.map((row) => {
      const isSelected = selected.has(row.id);
      const status = !isSelected ? "not-selected" : row.risk === "high" ? "needs-secondary-approval" : "ready-for-apply";
      return {
        id: row.id,
        workItemId: row.workItemId,
        title: row.title,
        status,
        verification: ["Re-read current Work Item", "Apply approved preview only", "Re-query Work Item", "Record audit outcome"]
      };
    });
    return {
      title: "Approval Apply Plan",
      writePerformed: false,
      plan,
      auditEvents: plan.filter((row) => row.status !== "not-selected").map((row) => ({ recommendationId: row.id, workItemId: row.workItemId, action: row.status === "needs-secondary-approval" ? "recorded" : "accepted", outcome: "pending-apply" }))
    };
  }

  function buildApprovalResultReview(plan) {
    const verification = plan.filter((row) => row.status !== "not-selected").map((row) => {
      const current = state.items.map(normalizeItem).find((item) => item.id === row.workItemId);
      const verified = row.status === "ready-for-apply" && Boolean(current);
      return {
        recommendationId: row.id,
        workItemId: row.workItemId,
        applyResult: row.status === "needs-secondary-approval" ? "blocked-secondary-approval" : "succeeded",
        currentState: current ? current.state : "not-requeried",
        verified
      };
    });
    return {
      title: "Approval Result Review",
      writePerformed: false,
      verification,
      auditEvents: verification.map((row) => ({ recommendationId: row.recommendationId, workItemId: row.workItemId, outcome: row.verified ? "verified" : "needs-review" }))
    };
  }

  function renderSpecialTables(report) {
    if (report.decisions) return `<section><h3>Decision Scores</h3>${table(["ID", "Title", "State", "Decision", "Score", "Rationale"], report.decisions.map((row) => [row.id, row.title, row.state, row.decision, row.score, row.rationale.join("; ")]))}</section>`;
    if (report.rationalization) return `<section><h3>Portfolio Decisions</h3>${table(["ID", "Title", "Decision", "Value", "Evidence", "Effort", "Stale", "Duplicates"], report.rationalization.map((row) => [row.id, row.title, row.decision, row.value, row.evidence, row.effort, row.stale, row.duplicates]))}</section>`;
    if (report.ledger && report.title === "Financial Backlog Ledger") return `<section><h3>Financial Ledger</h3>${table(["ID", "Title", "Expected Benefit", "Cost", "Risk Cost", "Realized", "Net Value"], report.ledger.map((row) => [row.id, row.title, row.expectedBenefit, row.implementationCost, row.riskCost, row.realizedValue, row.netValue]))}</section>`;
    if (report.ledger) return `<section><h3>Ledger</h3>${table(["ID", "Title", "State", "Closed By", "Status", "Evidence", "Missing"], report.ledger.map((row) => [row.id, row.title, row.state, row.closedBy, row.governanceStatus, arrayFrom(row.evidenceSignals).join("; "), arrayFrom(row.missingSignals).join("; ")]))}</section>`;
    if (report.targets) return `<section><h3>Close Targets</h3>${table(["ID", "Title", "Current", "Target", "Risk", "Patch Preview", "Child Impact"], report.targets.map((row) => [row.id, row.title, row.currentState, row.targetState, row.risk, JSON.stringify(row.patchPreview), row.childImpact.length]))}</section>`;
    if (report.scores) return `<section><h3>Confidence Scores</h3>${table(["ID", "Title", "Score", "Status"], report.scores.map((row) => [row.id, row.title, row.confidenceScore, row.status]))}</section>`;
    if (report.rewrites) return `<section><h3>Rewrite Previews</h3>${table(["ID", "Title", "Patch Preview"], report.rewrites.map((row) => [row.id, row.title, JSON.stringify(row.patchPreview)]))}</section>`;
    if (report.exceptions) return `<section><h3>Exception Register</h3>${table(["ID", "Title", "Owner", "Status", "Risk"], report.exceptions.map((row) => [row.id, row.title, row.owner, row.status, row.risk]))}</section>`;
    if (report.cadence) return `<section><h3>Operating Rhythm</h3>${table(["Cadence", "Meeting", "Items", "Decision"], report.cadence.map((row) => [row.cadence, row.meeting, arrayFrom(row.itemIds).join(", "), row.decision]))}</section>`;
    if (report.alignments) return `<section><h3>OKR Alignment</h3>${table(["ID", "Title", "Status", "Score", "Objectives"], report.alignments.map((row) => [row.id, row.title, row.status, row.score, row.objectives]))}</section>`;
    if (report.controls && report.title === "Security Privacy Review") return `<section><h3>Security Controls</h3>${table(["Name", "Status", "Score"], report.controls.map((row) => [row.name, row.status, row.score]))}</section>`;
    if (report.controls) return `<section><h3>Compliance Controls</h3>${table(["ID", "Title", "Control", "Status", "Reason"], report.controls.map((row) => [row.id, row.title, row.control, row.status, row.reason]))}</section>`;
    if (report.fitness) return `<section><h3>Portfolio Fitness</h3>${table(["Score", "Value/Cost", "Benefit", "Cost"], [[report.fitness.score, report.fitness.valueCostRatio, report.fitness.totalBenefit, report.fitness.totalCost]])}</section>`;
    if (report.requirements) return `<section><h3>Elicited Requirements</h3>${table(["ID", "Title", "Confidence"], report.requirements.map((row) => [row.id, row.title, row.confidence]))}</section>`;
    if (report.gaps) return `<section><h3>Requirement Gaps</h3>${table(["ID", "Title", "Score", "Missing"], report.gaps.map((row) => [row.id, row.title, row.qualityScore, arrayFrom(row.missing).join("; ")]))}</section>`;
    if (report.transforms) return `<section><h3>Transforms</h3>${table(["Operation", "Preview"], report.transforms.map((row) => [row.operation, row.transformedText]))}</section>`;
    if (report.conversions) return `<section><h3>Conversions</h3>${table(["ID", "Target", "Content"], report.conversions.map((row) => [row.id, row.target, row.content]))}</section>`;
    if (report.testCases) return `<section><h3>Test Cases</h3>${table(["Requirement", "Title", "Confidence"], report.testCases.map((row) => [row.sourceRequirementId, row.title, row.confidence]))}</section>`;
    if (report.coverage) return `<section><h3>Coverage</h3>${table(["Requirement", "Title", "Status"], report.coverage.map((row) => [row.requirementId, row.title, row.status]))}</section>`;
    if (report.links) return `<section><h3>Traceability Links</h3>${table(["Requirement", "Test Case", "Relation", "Confidence"], report.links.map((row) => [row.requirementId, row.testCaseId, row.relation, row.confidence]))}</section>`;
    if (report.mockup) return `<section><h3>Mockup</h3><pre>${escapeHtml(report.mockup.content || "")}</pre></section>`;
    if (report.diagram) return `<section><h3>Diagram</h3><pre>${escapeHtml(report.diagram.content || "")}</pre></section>`;
    if (report.memory) return `<section><h3>Decision Memory</h3>${table(["ID", "Title", "Decision", "Outcome", "Confidence"], report.memory.map((row) => [row.workItemId, row.title, row.decision, row.outcomeStatus, row.confidence]))}</section>`;
    if (report.inflation) return `<section><h3>Value Inflation</h3>${table(["ID", "Title", "Business Value", "Evidence", "Status"], report.inflation.map((row) => [row.id, row.title, row.businessValue, row.evidenceScore, row.status]))}</section>`;
    if (report.cases) return `<section><h3>Decision Court</h3>${table(["ID", "Title", "Action", "Confidence", "Missing"], report.cases.map((row) => [row.id, row.title, row.action, row.confidence, arrayFrom(row.missingFacts).join("; ")]))}</section>`;
    if (report.contracts) return `<section><h3>Outcome Contracts</h3>${table(["ID", "Title", "Metric", "Owner", "Status"], report.contracts.map((row) => [row.id, row.title, row.metric, row.owner, row.status]))}</section>`;
    if (report.actionPreviews) return `<section><h3>Governance Actions</h3>${table(["ID", "Title", "Patch Preview"], report.actionPreviews.map((row) => [row.id, row.title, JSON.stringify(row.patchPreview)]))}</section>`;
    if (report.twin) return `<section><h3>Business Twin</h3>${table(["ID", "Title", "KPI", "Impact", "Effect"], report.twin.map((row) => [row.id, row.title, row.kpiName, row.impactScore, row.businessEffect]))}</section>`;
    if (report.importedEvidence) return `<section><h3>External Evidence</h3>${table(["ID", "Work Item", "Type", "Confidence"], report.importedEvidence.map((row) => [row.id, row.workItemId, row.evidenceType, row.confidence]))}</section>`;
    if (report.processMap) return `<section><h3>Process Map</h3><pre>${escapeHtml(JSON.stringify(report.processMap, null, 2))}</pre></section>`;
    if (report.roi) return `<section><h3>ROI Confidence</h3>${table(["ID", "Title", "Benefit", "Maturity", "Confidence"], report.roi.map((row) => [row.id, row.title, row.expectedBenefit, row.maturity, row.confidence]))}</section>`;
    if (report.heatmap) return `<section><h3>Risk Heatmap</h3>${table(["ID", "Title", "Total", "Band"], report.heatmap.map((row) => [row.id, row.title, row.total, row.band]))}</section>`;
    if (report.evals) return `<section><h3>Prompt Eval</h3>${table(["ID", "Name", "Cases", "Failures", "Status"], report.evals.map((row) => [row.id, row.name, row.cases, row.failures, row.status]))}</section>`;
    if (report.modelRisk) return `<section><h3>Model Risk</h3>${table(["ID", "Name", "Hosting", "Risk"], report.modelRisk.map((row) => [row.id, row.name, row.hosting, row.risk]))}</section>`;
    if (report.adoption) return `<section><h3>Adoption</h3>${table(["Team", "Users", "Runs", "Score", "Status"], report.adoption.map((row) => [row.team, row.activeUsers, row.runs, row.adoptionScore, row.status]))}</section>`;
    if (report.readiness) return `<section><h3>Connector Readiness</h3>${table(["Connector", "Status", "Score", "Missing"], report.readiness.map((row) => [row.connector, row.status, row.score, arrayFrom(row.missing).join("; ")]))}</section>`;
    if (report.pipeline) return `<section><h3>Evidence Pipeline</h3>${table(["ID", "Work Item", "Type", "Classification", "Retain Content", "Status"], report.pipeline.map((row) => [row.id, row.workItemId, row.type, row.classification, row.retainContent, row.status]))}</section>`;
    if (report.checklist) return `<section><h3>Marketplace Checklist</h3>${table(["ID", "Item", "Status", "Recommendation"], report.checklist.map((row) => [row.id, row.item, row.status, row.recommendation]))}</section>`;
    if (report.rollout) return `<section><h3>Rollout Readiness</h3>${table(["Area", "Status", "Score"], report.rollout.map((row) => [row.area, row.status, row.score]))}</section>`;
    if (report.packages) return `<section><h3>Package Options</h3>${table(["Edition", "Fit Score", "Gates"], report.packages.map((row) => [row.edition, row.fitScore, arrayFrom(row.gates).join("; ")]))}</section>`;
    if (report.valueCases) return `<section><h3>Customer Value Cases</h3>${table(["ID", "Title", "Annual Value", "Confidence", "Status"], report.valueCases.map((row) => [row.id, row.title, row.estimatedAnnualValue, row.confidence, row.status]))}</section>`;
    if (report.signals) return `<section><h3>Signal Catalog</h3>${table(["Name", "Count", "Strength"], report.signals.map((row) => [row.name, row.count, row.strength]))}</section>`;
    if (report.followups) return `<section><h3>Followups</h3>${table(["ID", "Title", "Owner", "Reason", "Channel"], report.followups.map((row) => [row.id, row.title, row.owner, row.reason, row.channel]))}</section>`;
    if (report.experiments) return `<section><h3>Adoption Experiments</h3>${table(["Team", "Target", "Baseline", "Days", "Metric"], report.experiments.map((row) => [row.team, row.targetOutcome, row.baselineRuns, row.durationDays, row.successMetric]))}</section>`;
    if (report.snapshot) return `<section><h3>Snapshot</h3>${table(["Name", "Items", "Evidence", "Fingerprint", "Retention"], [[report.snapshot.name, report.snapshot.itemCount, report.snapshot.evidenceCount, report.snapshot.fingerprint, report.snapshot.retention]])}</section>`;
    if (report.queue) return `<section><h3>Approval Queue</h3>${table(["ID", "Work Item", "Title", "Risk", "Selected", "Status", "Verification"], report.queue.map((row) => [row.id, row.workItemId, row.title, row.risk, row.selected, row.status, row.verification]))}</section>`;
    if (report.trail) return `<section><h3>Audit Trail</h3>${table(["ID", "Work Item", "Actor", "Action", "Outcome", "Rationale"], report.trail.map((row) => [row.id, row.workItemId, row.actor, row.action, row.outcome, row.rationale]))}</section>`;
    if (report.cockpits) return `<section><h3>Role Cockpits</h3>${table(["Role", "Title", "Reports"], report.cockpits.map((row) => [row.role, row.title, arrayFrom(row.reports).join("; ")]))}</section>`;
    if (report.adminControls) return `<section><h3>Admin Controls</h3>${table(["Name", "Status", "Value"], report.adminControls.map((row) => [row.name, row.status, row.value]))}</section>`;
    if (report.reminders) return `<section><h3>Reminder Plan</h3>${table(["ID", "Type", "Work Item", "Title", "Owner", "Next Run", "Schedule"], report.reminders.map((row) => [row.id, row.type, row.workItemId, row.title, row.owner, row.nextRun, row.schedule]))}</section>`;
    if (report.pack) return `<section><h3>Decision Pack</h3>${table(["Name", "Audience", "Exports", "Sections"], [[report.pack.name, report.pack.audience, arrayFrom(report.pack.exports).join("; "), arrayFrom(report.pack.sections).join("; ")]])}<h3>Import/Export Manifest</h3><pre>${escapeHtml(JSON.stringify(report.manifest || {}, null, 2))}</pre><h3>Markdown Export</h3><pre>${escapeHtml(report.markdown || "")}</pre></section>`;
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

  function isRequirement(item) {
    return REQUIREMENT_TYPES.has(String(item.type || "").toLowerCase());
  }

  function controlRow(item, control, passed, reason) {
    return { id: item.id, title: item.title, control, status: passed ? "pass" : "fail", reason: passed ? "ok" : reason };
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
    return String(title || "").toLowerCase().replace(/[#\d]/g, "").replace(/\b(the|a|an|for|to|in|with|and)\b/g, " ").replace(/\s+/g, " ").trim();
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

  function evidenceForId(records, id) {
    return arrayFrom(records).filter((entry) => (numberFrom(entry.workItemId) || numberFrom(entry.id)) === id);
  }

  function uniqueItems(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function targetBenefit(item) {
    const fields = objectFrom(item.raw.fields);
    return numberFrom(fields["Custom.TargetBenefit"]) || numberFrom(fields["Custom.ExpectedBenefit"]) || Math.max(8000, valueScore(item) * 1200);
  }

  function realizedValue(item) {
    const fields = objectFrom(item.raw.fields);
    return numberFrom(fields["Custom.RealizedBenefit"]) || numberFrom(fields["Custom.ActualBenefit"]) || 0;
  }

  function implementationCostFor(item) {
    const fields = objectFrom(item.raw.fields);
    const explicit = numberFrom(fields["Custom.Cost"]) || numberFrom(fields["Custom.EstimatedCost"]);
    if (explicit) return explicit;
    const effort = numberFrom(fields["Microsoft.VSTS.Scheduling.StoryPoints"]) || numberFrom(fields["Microsoft.VSTS.Scheduling.Effort"]);
    if (effort) return effort * 1500;
    if (/epic/i.test(item.type)) return 72000;
    if (/feature/i.test(item.type)) return 36000;
    if (/requirement|story|pbi/i.test(item.type)) return 18000;
    return 12000;
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
