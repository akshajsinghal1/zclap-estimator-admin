const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

let loaded = false;

function loadLocalEnvFallback() {
  if (loaded) return;
  loaded = true;

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      if (process.env[key]) return;

      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch (err) {
    // Ignore local env fallback errors.
  }
}

function getSupabaseAdminClient() {
  let url = process.env.SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    loadLocalEnvFallback();
    url = process.env.SUPABASE_URL;
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { getSupabaseAdminClient };
