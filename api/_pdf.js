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

  const pctLabel = "Fixed-price quote reviewed and approved by ZCLAP";
  const finalLow = escapeHtml(formatCurrency(data.final_low));
  const finalHigh = escapeHtml(formatCurrency(data.final_high));

  return `
    <section class="section" style="border:1.5px solid #e4622a;margin-top:10px;">
      <div class="section-header" style="background:#fff8f5;padding:8px 14px;">
        <div>
          <div class="section-kicker" style="color:#c9531f;">Fixed-price quote</div>
          <h2 style="color:#17324d;font-size:13pt;">Final Quoted Price</h2>
        </div>
        <div class="section-note">${pctLabel}</div>
      </div>
      <div style="padding:12px;background:#ffffff;text-align:center;">
        <div style="font-size:22pt;font-weight:800;letter-spacing:-0.02em;color:#17324d;">${finalLow} &ndash; ${finalHigh}</div>
      </div>
    </section>`;
}

function renderScopeRows(data) {
  const isMod = String(data.estimator_type).toLowerCase() === "modernization";
  const ootbPills = renderPills(data.ootb_entities);

  let html = `
    <tr>
      <td class="input-cell">Estimator type</td>
      <td class="value-cell">${escapeHtml(data.estimator_type)}</td>
      <td class="input-cell">Custom ent.</td>
      <td class="value-cell">${escapeHtml(data.custom_entities)}</td>
    </tr>
    <tr>
      <td class="input-cell">OOTB entities</td>
      <td class="value-cell" colspan="3"><div class="pill-list">${ootbPills}</div></td>
    </tr>
    <tr>
      <td class="input-cell">Relationships</td>
      <td class="value-cell">${escapeHtml(data.relationships)}</td>
      <td class="input-cell">Hierarchies</td>
      <td class="value-cell">${escapeHtml(data.hierarchies)}</td>
    </tr>
    <tr>
      <td class="input-cell">Batch sources</td>
      <td class="value-cell">${escapeHtml(data.batch_source_systems)}</td>
      <td class="input-cell">RT inbound</td>
      <td class="value-cell">${escapeHtml(data.real_time_inbound)}</td>
    </tr>
    <tr>
      <td class="input-cell">Batch consumers</td>
      <td class="value-cell">${escapeHtml(data.batch_consumers)}</td>
      <td class="input-cell">RT consumers</td>
      <td class="value-cell">${escapeHtml(data.real_time_consumers)}</td>
    </tr>
    <tr>
      <td class="input-cell">Create workflows</td>
      <td class="value-cell">${escapeHtml(data.create_workflows)}</td>
      <td class="input-cell">Volume</td>
      <td class="value-cell">${escapeHtml(data.record_volume)}</td>
    </tr>`;

  if (isMod) {
    const legacyDescMap = {
      "Load by business ID": "Load existing golden records into MDM retaining legacy cross-reference IDs",
      "Merge by old ID": "Load legacy records as source cross-references and run automated match/merge by legacy IDs",
      "New match/merge": "Load raw source records into MDM and execute full initial match & merge rules across all systems",
    };
    const rawLegacy = data.legacy_handling_raw || data.legacy_handling;
    const legacyText = legacyDescMap[rawLegacy] || escapeHtml(data.legacy_handling);

    html += `
    <tr>
      <td class="input-cell">DaaS / enrichment</td>
      <td class="value-cell">${escapeHtml(data.daas_services)}</td>
      <td class="input-cell"><span class="only-modernization">Mod.</span> Parallel testing</td>
      <td class="value-cell">${escapeHtml(data.parallel_testing)}</td>
    </tr>
    <tr>
      <td class="input-cell" colspan="2"><span class="only-modernization">Mod.</span> How to handle legacy golden records:</td>
      <td class="value-cell" colspan="2">${escapeHtml(legacyText)}</td>
    </tr>`;
  } else {
    html += `
    <tr>
      <td class="input-cell">DaaS / enrichment</td>
      <td class="value-cell">${escapeHtml(data.daas_services)}</td>
      <td class="input-cell"></td>
      <td class="value-cell"></td>
    </tr>`;
  }

  return html;
}

function parseJsonObject(val) {
  if (!val) return {};
  if (typeof val === "object" && val !== null) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Data normalisation — mirrors generate_estimate_pdf.py's normalize_data()
// ---------------------------------------------------------------------------

function buildPdfData(record) {
  const rawRevInp = parseJsonObject(record.reviewed_inputs);
  const rawInp = parseJsonObject(record.inputs);
  const inp = Object.keys(rawRevInp).length > 0 ? rawRevInp : rawInp;

  const rawRevOut = parseJsonObject(record.reviewed_outputs);
  const rawOut = parseJsonObject(record.outputs);
  const out = Object.keys(rawRevOut).length > 0 ? rawRevOut : rawOut;

  const risk = out.risk || "medium";
  const complexityLevel = risk.charAt(0).toUpperCase() + risk.slice(1);

  const rawOotb = inp.ootb ?? inp.ootb_entities ?? inp.entities;
  const ootbEntities = Array.isArray(rawOotb)
    ? rawOotb
    : typeof rawOotb === "string"
    ? rawOotb.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const customEnt = Number(inp.customEnt ?? inp.custom_entities ?? inp.customEnts ?? inp.custom ?? 0);
  const rels = Number(inp.rels ?? inp.relationships ?? inp.rel ?? 0);
  const hierarchies = Number(inp.hierarchies ?? inp.hierarchy ?? 0);
  const sources = Number(inp.sources ?? inp.batch_sources ?? inp.batchSources ?? 0);
  const rtSources = Number(inp.rtSources ?? inp.real_time_sources ?? inp.rt_sources ?? 0);
  const consumers = Number(inp.consumers ?? inp.batch_consumers ?? inp.batchConsumers ?? 0);
  const rtConsumers = Number(inp.rtConsumers ?? inp.real_time_consumers ?? inp.rt_consumers ?? 0);
  const createWkfl = Number(inp.createWkfl ?? inp.create_workflows ?? inp.createWorkflows ?? inp.workflows ?? 0);
  const daas = Number(inp.daas ?? inp.daas_services ?? inp.daasServices ?? 0);

  const volume = inp.volume || inp.record_volume || inp.recordCount || "Not specified";
  const parallelVal = inp.parallelWeeks ?? inp.parallel_testing ?? inp.parallelTesting;
  const parallelTesting = Number(parallelVal) > 0 ? `${parallelVal} weeks` : (parallelVal || "Not applicable");
  const legacyHandlingRaw = inp.legacyHandling || inp.legacy_handling || inp.migrationOption || "";
  const legacyHandling = legacyHandlingRaw || "Not applicable";

  const compSlug = String(record.company || "ZCLAP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ZCLAP";
  let seq = record.quote_seq || record.sequence_no;
  if (!seq) {
    const digits = String(record.id || "").replace(/[^0-9]/g, "");
    seq = digits ? digits.slice(-3) : "1";
  }
  const quoteId = `${compSlug}-${seq}`;

  return {
    quote_id: quoteId,
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
    relationships: rels,
    hierarchies: hierarchies,
    batch_source_systems: sources,
    real_time_inbound: rtSources,
    batch_consumers: consumers,
    real_time_consumers: rtConsumers,
    create_workflows: createWkfl,
    record_volume: volume,
    daas_services: daas,
    parallel_testing: parallelTesting,
    legacy_handling_raw: legacyHandlingRaw,
    legacy_handling: legacyHandling,

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
    QUOTE_ID: data.quote_id,
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
  html = html.replaceAll("{{SCOPE_ROWS_HTML}}", renderScopeRows(data));
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
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generateEstimatePDF, renderHtml, buildPdfData };
