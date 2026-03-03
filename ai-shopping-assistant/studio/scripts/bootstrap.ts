/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Consolidate env files — ensure app/.env.local has all values
 *  2. Prompt for Anthropic API key (if not already set)
 *  3. Compute MCP URL from project ID + dataset
 *  4. Add CORS origin for localhost:3000
 *  5. Deploy blueprint (CORS, dataset, robot token, functions)
 *  6. Deploy schema to the Content Lake
 *  7. Import sample data (tar.gz)
 *  8. Deploy Studio (required for Agent Context MCP endpoint)
 *  9. Set Anthropic API key on the deployed function
 * 10. Restore dependencies (blueprint deploy can disrupt node_modules)
 *
 * Usage:
 *   pnpm bootstrap          (from studio/)
 *   pnpm bootstrap          (from root — delegates here via --filter)
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCliClient } from "sanity/cli";

const dir = __dirname;
const root = resolve(dir, "../..");
const studioEnv = resolve(dir, "../.env");
const appEnvLocal = resolve(root, "app/.env.local");
const appEnvExample = resolve(root, "app/.env.example");
const studioEnvExample = resolve(dir, "../.env.example");

// ── Step runner ─────────────────────────────────────────────────────────────

interface StepResult {
  name: string;
  status: "success" | "skipped" | "failed";
  error?: string;
  manualCommand?: string;
}

const results: StepResult[] = [];

function success(name: string) {
  results.push({ name, status: "success" });
}

function skipped(name: string, reason: string) {
  console.log(`  ⤳ Skipped: ${reason}`);
  results.push({ name, status: "skipped", error: reason });
}

function failed(name: string, error: unknown, manualCommand?: string) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`  ✗ Failed: ${message}`);
  results.push({ name, status: "failed", error: message, manualCommand });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[], options?: { cwd?: string }) {
  execFileSync(cmd, args, { stdio: "inherit", ...options });
}

function sanity(...args: string[]) {
  run("pnpm", ["exec", "sanity", ...args]);
}

function heading(label: string) {
  console.log(`\n── ${label} ${"─".repeat(60 - label.length)}`);
}

function parseEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) vars[match[1].trim()] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

function patchEnvVar(filePath: string, key: string, value: string) {
  let content = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const pattern = new RegExp(`^#?\\s*(${key})=.*$`, "m");
  if (pattern.test(content)) {
    content = content.replace(pattern, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  writeFileSync(filePath, content);
}

function prompt(question: string): string {
  process.stderr.write(question);
  try {
    return execFileSync("bash", ["-c", 'read -r val && echo "$val"'], {
      stdio: ["inherit", "pipe", "inherit"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

/** True if the value looks like a real key (not empty or a placeholder). */
function isRealValue(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower !== "" && !lower.startsWith("your-") && lower !== "your-anthropic-key";
}

// ── 1. Consolidate env ───────────────────────────────────────────────────────
// `sanity init --template` writes studio/.env. Propagate project ID and dataset
// to app/.env.local so every workspace reads the same values.

heading("Consolidate env");

const ENV_MAP: Record<string, string> = {
  SANITY_STUDIO_PROJECT_ID: "NEXT_PUBLIC_SANITY_PROJECT_ID",
  SANITY_STUDIO_DATASET: "NEXT_PUBLIC_SANITY_DATASET",
};

try {
  // Seed app/.env.local from app/.env.example if it doesn't exist
  if (!existsSync(appEnvLocal)) {
    if (existsSync(appEnvExample)) {
      copyFileSync(appEnvExample, appEnvLocal);
      console.log("Created app/.env.local from app/.env.example");
    } else {
      writeFileSync(appEnvLocal, "");
      console.log("Created empty app/.env.local");
    }
  }

  // Seed studio/.env from studio/.env.example if it doesn't exist
  if (!existsSync(studioEnv) && existsSync(studioEnvExample)) {
    copyFileSync(studioEnvExample, studioEnv);
    console.log("Created studio/.env from studio/.env.example");
  }

  if (!existsSync(studioEnv) && !existsSync(appEnvLocal)) {
    throw new Error("No studio/.env or app/.env.local found. Run `sanity init --template` first.");
  }

  if (existsSync(studioEnv)) {
    const studioVars = parseEnvFile(studioEnv);

    // Map studio env vars to app env vars (e.g. SANITY_STUDIO_PROJECT_ID → NEXT_PUBLIC_SANITY_PROJECT_ID)
    for (const [studioKey, appKey] of Object.entries(ENV_MAP)) {
      const value = studioVars[studioKey];
      if (value) {
        patchEnvVar(appEnvLocal, appKey, value);
      }
    }

    // Copy ANTHROPIC_API_KEY from studio to app if it has a real value
    if (isRealValue(studioVars.ANTHROPIC_API_KEY)) {
      patchEnvVar(appEnvLocal, "ANTHROPIC_API_KEY", studioVars.ANTHROPIC_API_KEY);
    }

    console.log("Merged studio/.env values into app/.env.local");
  } else {
    console.log("No studio/.env found — using existing app/.env.local");
  }

  success("Consolidate env");
} catch (err) {
  // Env consolidation is critical — abort if it fails
  console.error("\n✗ Cannot continue without env files.");
  throw err;
}

// ── 2. Prompt for Anthropic API key ─────────────────────────────────────────

heading("Anthropic API key");

let anthropicKey: string | undefined;

try {
  // Check if already set in either env file
  const appVars = existsSync(appEnvLocal) ? parseEnvFile(appEnvLocal) : {};
  const studioVars = existsSync(studioEnv) ? parseEnvFile(studioEnv) : {};

  anthropicKey = isRealValue(appVars.ANTHROPIC_API_KEY)
    ? appVars.ANTHROPIC_API_KEY
    : isRealValue(studioVars.ANTHROPIC_API_KEY)
      ? studioVars.ANTHROPIC_API_KEY
      : undefined;

  if (anthropicKey) {
    console.log("Anthropic API key already configured");
  } else {
    anthropicKey = prompt("Enter your Anthropic API key (https://console.anthropic.com): ");

    if (anthropicKey) {
      patchEnvVar(appEnvLocal, "ANTHROPIC_API_KEY", anthropicKey);
      patchEnvVar(studioEnv, "ANTHROPIC_API_KEY", anthropicKey);
      console.log("Saved Anthropic API key to app/.env.local and studio/.env");
    } else {
      console.log("No key entered — skipping");
    }
  }

  success("Anthropic API key");
} catch (err) {
  failed(
    "Anthropic API key",
    err,
    "Add ANTHROPIC_API_KEY=your-key to both app/.env.local and studio/.env",
  );
}

// ── 3. Compute MCP URL ──────────────────────────────────────────────────────

heading("Compute MCP URL");

const client = getCliClient({ apiVersion: "2025-01-01" });
const { projectId, dataset } = client.config();

try {
  const appVars = parseEnvFile(appEnvLocal);

  if (isRealValue(appVars.SANITY_CONTEXT_MCP_URL)) {
    console.log("MCP URL already configured");
  } else {
    const mcpUrl = `https://api.sanity.io/vX/agent-context/${projectId}/${dataset}/default`;
    patchEnvVar(appEnvLocal, "SANITY_CONTEXT_MCP_URL", mcpUrl);
    console.log(`Set SANITY_CONTEXT_MCP_URL=${mcpUrl}`);
  }

  success("Compute MCP URL");
} catch (err) {
  failed(
    "Compute MCP URL",
    err,
    `Add SANITY_CONTEXT_MCP_URL=https://api.sanity.io/vX/agent-context/${projectId}/${dataset}/default to app/.env.local`,
  );
}

// ── 4. Add CORS origin ──────────────────────────────────────────────────────

heading("Add CORS origin");

try {
  sanity("cors", "add", "http://localhost:3000", "--credentials");
  success("Add CORS origin");
} catch (err) {
  failed("Add CORS origin", err, "cd studio && npx sanity cors add http://localhost:3000");
}

// ── 5. Deploy blueprint ──────────────────────────────────────────────────────
// Init the stack (first run only), then deploy the blueprint
// (CORS origins, dataset config, robot token, serverless functions).
// Must run from the monorepo root where sanity.blueprint.ts lives.

heading("Deploy blueprint");

try {
  const blueprintConfig = resolve(root, ".sanity/blueprint.config.json");
  if (!existsSync(blueprintConfig)) {
    try {
      execFileSync(
        "pnpm",
        ["exec", "sanity", "blueprints", "init", "--stack-name", "production", "--project-id", projectId!],
        { cwd: root, stdio: "pipe" },
      );
    } catch {
      // Stack already exists — link local config to it
      console.log("Stack already exists — linking local config");
      run(
        "pnpm",
        [
          "exec",
          "sanity",
          "blueprints",
          "config",
          "--edit",
          "--project-id",
          projectId!,
          "--stack",
          "production",
        ],
        { cwd: root },
      );
    }
  }

  run("pnpm", ["exec", "sanity", "blueprints", "deploy"], { cwd: root });

  success("Deploy blueprint");
} catch (err) {
  failed("Deploy blueprint", err, "pnpm init:blueprints && pnpm deploy:blueprints");
}

// ── 6. Deploy schema ─────────────────────────────────────────────────────────

heading("Deploy schema");

try {
  sanity("schema", "deploy");
  success("Deploy schema");
} catch (err) {
  failed("Deploy schema", err, "cd studio && npx sanity schema deploy");
}

// ── 7. Import sample data ────────────────────────────────────────────────────

heading("Import sample data");

try {
  sanity("dataset", "import", "seed/data.tar.gz", dataset!, "--replace");
  success("Import sample data");
} catch (err) {
  failed("Import sample data", err, "pnpm import-sample-data");
}

// ── 8. Deploy Studio ────────────────────────────────────────────────────────
// Required for the Agent Context MCP endpoint to work.

heading("Deploy Studio");

try {
  sanity("deploy");
  success("Deploy Studio");
} catch (err) {
  failed("Deploy Studio", err, "pnpm deploy:studio");
}

// ── 9. Set function env var ──────────────────────────────────────────────────

heading("Set function env var");

try {
  if (!anthropicKey) {
    skipped(
      "Set function env var",
      "No Anthropic API key available — set it later with: npx sanity functions env add agent-conversation ANTHROPIC_API_KEY your-key",
    );
  } else {
    run(
      "pnpm",
      [
        "exec",
        "sanity",
        "functions",
        "env",
        "add",
        "agent-conversation",
        "ANTHROPIC_API_KEY",
        anthropicKey,
      ],
      { cwd: root },
    );
    success("Set function env var");
  }
} catch (err) {
  failed(
    "Set function env var",
    err,
    "npx sanity functions env add agent-conversation ANTHROPIC_API_KEY your-key",
  );
}

// ── 10. Restore dependencies ─────────────────────────────────────────────────
// Blueprint deploy's internal dependency resolution can disrupt workspace
// node_modules. Re-run pnpm install to restore them.

heading("Restore dependencies");

try {
  run("pnpm", ["install", "--force"], { cwd: root });
  success("Restore dependencies");
} catch (err) {
  failed("Restore dependencies", err, "pnpm install --force");
}

// ── Summary ──────────────────────────────────────────────────────────────────

const failures = results.filter((r) => r.status === "failed");
const skips = results.filter((r) => r.status === "skipped");

console.log("\n" + "─".repeat(64));

if (failures.length === 0 && skips.length === 0) {
  console.log("\n✓ Bootstrap complete\n");
} else {
  if (failures.length > 0) {
    console.log("\n⚠ Some steps failed. To complete setup manually:\n");
    for (const result of failures) {
      console.log(`  ${result.name}:`);
      if (result.manualCommand) {
        console.log(`    $ ${result.manualCommand}`);
      }
      console.log(`    Error: ${result.error}\n`);
    }
  }

  if (skips.length > 0) {
    console.log("Skipped steps:");
    for (const result of skips) {
      console.log(`  ${result.name}: ${result.error}`);
    }
    console.log();
  }

  const successes = results.filter((r) => r.status === "success").length;
  console.log(`Done: ${successes} succeeded, ${failures.length} failed, ${skips.length} skipped\n`);
}
