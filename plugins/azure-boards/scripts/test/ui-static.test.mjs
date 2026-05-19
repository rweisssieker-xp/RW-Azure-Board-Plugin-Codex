import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const pluginRoot = path.resolve(process.cwd(), "..");
const uiRoot = path.join(pluginRoot, "ui");

test("static review UI files are present with expected no-write hooks", () => {
  const indexPath = path.join(uiRoot, "index.html");
  const stylesPath = path.join(uiRoot, "styles.css");
  const appPath = path.join(uiRoot, "app.js");

  assert.equal(existsSync(indexPath), true, "ui/index.html should exist");
  assert.equal(existsSync(stylesPath), true, "ui/styles.css should exist");
  assert.equal(existsSync(appPath), true, "ui/app.js should exist");

  const index = readFileSync(indexPath, "utf8");
  const app = readFileSync(appPath, "utf8");

  for (const hook of ["reportSelector", "runReportButton", "jsonInput", "reportOutput", "markdownPreview"]) {
    assert.match(index, new RegExp(hook), `${hook} should be present in index.html`);
  }

  for (const report of ["Delivery Risk Radar", "Requirement Decision Cockpit", "Portfolio Rationalization", "Evidence Ledger", "AI Steering Committee Pack", "Bulk Close Preview"]) {
    assert.match(app, new RegExp(report), `${report} should be available in app.js`);
  }

  assert.doesNotMatch(app, /\bfetch\s*\(/, "static UI must not call fetch");
  assert.doesNotMatch(app, /\bXMLHttpRequest\b/, "static UI must not use XMLHttpRequest");
  assert.doesNotMatch(app, /\bsendBeacon\b/, "static UI must not send beacons");
  assert.match(index, /No Azure writes|Read only/, "index should clearly state no-write mode");
});
