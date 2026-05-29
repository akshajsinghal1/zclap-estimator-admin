/**
 * _pdf.js — Server-side PDF generator for ZCLAP estimate documents.
 *
 * Uses Puppeteer + @sparticuz/chromium to render the estimate-template.html
 * with the client's real data and return a PDF buffer.
 */

const fs = require("fs");
const path = require("path");

const TEMPLATE_PATH = path.join(__dirname, "../templates/estimate-template.html");
const LOGO_PATH = path.join(__dirname, "../logo/zclap-logo.svg");

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value) {
  const num = parseFloat(String(value).replace(/[$,]/g, ""));
  if (isNaN(num)) return String(value);
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatCostRange(data) {
  if (data.cost_range) return String(data.cost_range);
  if (data.cost_min != null && data.cost_max != null) {
    return `${formatCurrency(data.cost_min)} – ${formatCurrency(data.cost_max)}`;
  }
  return "TBD";
}

function formatTimeline(value) {
  if (value == null || value === "") return "TBD";
  if (typeof value === "number") return `${value} weeks`;
  return String(value);
}

function renderPills(values) {
  if (!Array.isArray(values) || values.length === 0)
    return '<span class="pill">None selected</span>';
  return values.map((v) => `<span class="pill">${escapeHtml(v)}</span>`).join("\n");
}

function renderFixedPriceSection(data) {
  if (data.final_low == null || data.final_high == null) return "";

  const pctLabel =
    data.contingency_pct != null
      ? `Includes ${escapeHtml(data.contingency_pct)}% fixed-price contingency applied to T&amp;M estimate`
      : "Fixed-price quote reviewed and approved by ZCLAP";

  const tmRange = escapeHtml(data.cost_range || "TBD");
  const finalLow = escapeHtml(formatCurrency(data.final_low));
  const finalHigh = escapeHtml(formatCurrency(data.final_high));

  return `
    <section class="section" style="border-color:rgba(245,130,32,0.35);margin-top:18px;">
      <div class="section-header" style="background:linear-gradient(90deg,rgba(245,130,32,0.12),rgba(245,130,32,0.04));">
        <div>
          <div class="section-kicker">Fixed-price quote</div>
          <h2>Final quoted price</h2>
        </div>
        <div class="section-note">${pctLabel}</div>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:center;">
        <div>
          <div class="metric-label">T&amp;M estimate range</div>
          <div style="font-size:20px;font-weight:800;letter-spacing:-0.03em;color:var(--text);">${tmRange}</div>
        </div>
        <div style="background:rgba(245,130,32,0.1);border:1px solid rgba(245,130,32,0.32);border-radius:12px;padding:16px;">
          <div class="metric-label" style="color:var(--accent-2);">Fixed-price quote</div>
          <div style="font-size:24px;font-weight:800;letter-spacing:-0.03em;color:var(--accent-2);">${finalLow} &ndash; ${finalHigh}</div>
        </div>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Data normalisation — mirrors generate_estimate_pdf.py's normalize_data()
// ---------------------------------------------------------------------------

function buildPdfData(record) {
  const inp = record.reviewed_inputs || record.inputs || {};
  const out = record.reviewed_outputs || record.outputs || {};

  const risk = out.risk || "medium";
  const complexityLevel = risk.charAt(0).toUpperCase() + risk.slice(1);

  const ootbEntities = Array.isArray(inp.ootb) ? inp.ootb : [];
  const customEnt = Number(inp.customEnt || 0);
  const sources = Number(inp.sources || 0);
  const rtSources = Number(inp.rtSources || 0);
  const consumers = Number(inp.consumers || 0);
  const rtConsumers = Number(inp.rtConsumers || 0);
  const createWkfl = Number(inp.createWkfl || 0);
  const daas = Number(inp.daas || 0);

  return {
    estimator_type: record.estimator_type || "Implementation",
    estimate_date: record.approved_at
      ? record.approved_at.split("T")[0]
      : new Date().toISOString().split("T")[0],

    client_first_name: record.first_name || "",
    client_last_name: record.last_name || "",
    client_company: record.company || "",
    client_role: record.role || "",

    cost_min: out.low,
    cost_max: out.high,
    timeline_weeks: out.totalWks,

    complexity_level: complexityLevel,
    complexity_description: out.riskDesc || out.riskTitle || "Indicative complexity based on the selected scope.",

    ootb_entities: ootbEntities,
    custom_entities: customEnt,
    relationships: Number(inp.rels || 0),
    hierarchies: Number(inp.hierarchies || 0),
    batch_source_systems: sources,
    real_time_inbound: rtSources,
    batch_consumers: consumers,
    real_time_consumers: rtConsumers,
    create_workflows: createWkfl,
    record_volume: inp.volume || "Not specified",
    daas_services: daas,
    parallel_testing:
      inp.parallelWeeks > 0 ? `${inp.parallelWeeks} weeks` : "Not applicable",
    legacy_handling: inp.legacyHandling || "Not applicable",

    // Rolled-up totals
    total_entities: ootbEntities.length + customEnt,
    total_integrations: sources + rtSources + consumers + rtConsumers,
    total_workflows: createWkfl,
    total_addons: daas,

    // Fixed-price uplift
    contingency_pct: record.contingency_pct ?? null,
    final_low: record.final_low ?? null,
    final_high: record.final_high ?? null,

    contact_email: "info@zclap.com",
  };
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

function renderHtml(record) {
  const data = buildPdfData(record);
  data.cost_range = formatCostRange(data);
  data.timeline_weeks = formatTimeline(data.timeline_weeks);
  data.estimate_title = `MDM ${data.estimator_type} Estimate`;

  let html = fs.readFileSync(TEMPLATE_PATH, "utf8");

  // Inline logo as base64 data URL so there are no external file dependencies
  const logoSvg = fs.readFileSync(LOGO_PATH, "utf8");
  const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;
  html = html.replace('src="logo/zclap-logo.svg"', `src="${logoDataUrl}"`);

  // Plain-text field substitutions (HTML-escaped)
  const textFields = {
    ESTIMATOR_TYPE: data.estimator_type,
    ESTIMATE_TITLE: data.estimate_title,
    CLIENT_FIRST_NAME: data.client_first_name,
    CLIENT_LAST_NAME: data.client_last_name,
    CLIENT_COMPANY: data.client_company,
    CLIENT_ROLE: data.client_role,
    ESTIMATE_DATE: data.estimate_date,
    COST_RANGE: data.cost_range,
    TIMELINE_WEEKS: data.timeline_weeks,
    COMPLEXITY_LEVEL: data.complexity_level,
    COMPLEXITY_DESCRIPTION: data.complexity_description,
    CUSTOM_ENTITIES: String(data.custom_entities),
    RELATIONSHIPS: String(data.relationships),
    HIERARCHIES: String(data.hierarchies),
    BATCH_SOURCE_SYSTEMS: String(data.batch_source_systems),
    REAL_TIME_INBOUND: String(data.real_time_inbound),
    BATCH_CONSUMERS: String(data.batch_consumers),
    REAL_TIME_CONSUMERS: String(data.real_time_consumers),
    CREATE_WORKFLOWS: String(data.create_workflows),
    RECORD_VOLUME: String(data.record_volume),
    DAAS_SERVICES: String(data.daas_services),
    PARALLEL_TESTING: String(data.parallel_testing),
    LEGACY_HANDLING: String(data.legacy_handling),
    TOTAL_ENTITIES: String(data.total_entities),
    TOTAL_INTEGRATIONS: String(data.total_integrations),
    TOTAL_WORKFLOWS: String(data.total_workflows),
    TOTAL_ADDONS: String(data.total_addons),
    CONTACT_EMAIL: data.contact_email,
  };

  for (const [key, value] of Object.entries(textFields)) {
    html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
  }

  // HTML-content substitutions (not escaped)
  html = html.replaceAll("{{OOTB_ENTITY_PILLS}}", renderPills(data.ootb_entities));
  html = html.replaceAll("{{FIXED_PRICE_SECTION}}", renderFixedPriceSection(data));

  return html;
}

// ---------------------------------------------------------------------------
// PDF generation via Puppeteer + @sparticuz/chromium
// ---------------------------------------------------------------------------

async function generateEstimatePDF(record) {
  const { default: chromium } = await import("@sparticuz/chromium");
  const { default: puppeteer } = await import("puppeteer-core");

  const html = renderHtml(record);

  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "12mm", bottom: "11mm", left: "12mm" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generateEstimatePDF, renderHtml, buildPdfData };
