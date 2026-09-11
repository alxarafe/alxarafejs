import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { findWorkspaceRoot } from "@alxarafe/core";

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

export function ok(message: string): void {
	console.log(`[ok] ${message}`);
}

export function warn(message: string): void {
	console.error(`[warn] ${message}`);
}

export function fail(message: string): never {
	throw new Error(message);
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

/** Resolve the workspace root from the current working directory. */
export function getRoot(): string {
	return findWorkspaceRoot(process.cwd());
}

/** Run a shell command in the workspace root, streaming output to the caller. */
export function run(cmd: string, cwd: string = getRoot()): void {
	try {
		execSync(cmd, { cwd, stdio: "inherit" });
	} catch {
		fail(`El comando falló: ${cmd}`);
	}
}

/** Read the `name` field of a package.json, falling back to undefined. */
export function readJsonName(jsonPath: string): string | undefined {
	try {
		const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as { name?: unknown };
		return typeof raw.name === "string" ? raw.name : undefined;
	} catch {
		return undefined;
	}
}
