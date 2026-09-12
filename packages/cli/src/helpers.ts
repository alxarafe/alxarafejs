import { execSync, spawnSync } from "node:child_process";
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

/** Run raw argv without a shell: args may come from user input (no injection). */
export function runArgs(args: string[], cwd: string = getRoot(), label: string = args.join(" ")): void {
	const res = spawnSync(args[0], args.slice(1), { cwd, stdio: "inherit" });
	if (res.error) fail(`El comando falló (${label}): ${res.error.message}`);
	if (res.status !== 0) fail(`El comando falló: ${label}`);
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

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const MODULE_NAME_RE = /^[a-z][a-z0-9_-]*$/;

/** True if `name` is safe as a path segment under modules/ and in config files. */
export function isValidModuleName(name: string): boolean {
	return MODULE_NAME_RE.test(name);
}

/** Fail unless the name is safe; returns it unchanged for chaining. */
export function assertValidModuleName(name: string): string {
	if (!isValidModuleName(name)) {
		fail(`Nombre de módulo inválido: '${name}' (usa [a-z][a-z0-9_-]*).`);
	}
	return name;
}

/** Git origins allowed for `module add --from` (protocol allowlist). */
export function isGitUrl(value: string): boolean {
	return /^(?:https?|git|ssh):\/\//i.test(value) || /^git@[^:]+:.+\.git$/i.test(value);
}
