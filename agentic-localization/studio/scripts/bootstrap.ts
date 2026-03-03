/**
 * Bootstrap the project after `sanity init --template`.
 *
 * Steps:
 *  1. Consolidate env files — ensure root .env has all values
 *  2. Resolve organization ID (not scaffolded by init)
 *  3. Deploy blueprint (CORS, dataset, robot token, functions)
 *  4. Deploy schema to the Content Lake
 *  5. Run typegen (schema extract + type generation)
 *  6. Seed locale documents via migration
 *  7. Import sample data (ndjson)
 *
 * Usage:
 *   pnpm bootstrap          (from studio/)
 *   pnpm bootstrap          (from root — delegates here via --filter)
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCliClient } from "sanity/cli";

const dir = import.meta.dirname!;
const studioEnv = resolve(dir, "../.env");
const rootEnv = resolve(dir, "../../.env");

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

// ── 1. Consolidate env ───────────────────────────────────────────────────────
// `sanity init --template` writes studio/.env. Ensure root .env stays in sync
// so every workspace (dashboard, frontend, blueprint) reads the same values.

heading("Consolidate env");

if (existsSync(studioEnv) && existsSync(rootEnv)) {
  copyFileSync(studioEnv, rootEnv);
  console.log("Copied studio/.env → .env");
} else if (existsSync(studioEnv)) {
  copyFileSync(studioEnv, rootEnv);
  console.log("Created .env from studio/.env");
} else {
  console.log("No studio/.env found — using existing root .env");
}

// ── 2. Resolve org ID ────────────────────────────────────────────────────────

heading("Resolve organization ID");

const client = getCliClient({ apiVersion: "2025-01-01" });
const { projectId, dataset } = client.config();

const project = await client.request<{ organizationId?: string }>({
  uri: `/projects/${projectId}`,
});

if (project.organizationId) {
  let patched = 0;

  for (const envFile of [studioEnv, rootEnv]) {
    try {
      const content = readFileSync(envFile, "utf8");
      const updated = content.replace(
        /^#\s*SANITY_STUDIO_ORGANIZATION_ID=.*$/m,
        `SANITY_STUDIO_ORGANIZATION_ID=${project.organizationId}`,
      );
      if (updated !== content) {
        writeFileSync(envFile, updated);
        patched++;
      }
    } catch {
      // File may not exist yet
    }
  }

  console.log(
    `Resolved organization ID: ${project.organizationId} (patched ${patched} env file${patched === 1 ? "" : "s"})`,
  );
} else {
  console.log("No organization found for project — skipping");
}

// ── 3. Deploy blueprint ──────────────────────────────────────────────────────
// Build functions, init the stack (first run only), then deploy the blueprint
// (CORS origins, dataset config, robot token, serverless functions).
// Must run from the monorepo root where sanity.blueprint.ts lives.

heading("Deploy blueprint");

const root = resolve(dir, "../..");
const blueprintConfig = resolve(root, ".sanity/blueprint.config.json");

run("pnpm", ["--filter", "@starter/functions", "run", "build"], { cwd: root });

if (!existsSync(blueprintConfig)) {
  run(
    "pnpm",
    ["exec", "sanity", "blueprints", "init", "--stack-name", "production", "--project-id", projectId!],
    { cwd: root },
  );
}

run("pnpm", ["exec", "sanity", "blueprints", "deploy"], { cwd: root });

// ── 4. Deploy schema ─────────────────────────────────────────────────────────

heading("Deploy schema");
sanity("schema", "deploy");

// ── 5. Typegen ───────────────────────────────────────────────────────────────

heading("Typegen");
sanity("schema", "extract");
sanity("typegen", "generate");

// ── 6. Seed locales ──────────────────────────────────────────────────────────

heading("Seed locales");
sanity("migration", "run", "seed-locales", "--no-dry-run", "--no-confirm");

// ── 7. Import sample data ────────────────────────────────────────────────────

heading("Import sample data");
sanity("dataset", "import", "sample-data.ndjson", dataset!, "--replace");

console.log("\n✓ Bootstrap complete\n");
