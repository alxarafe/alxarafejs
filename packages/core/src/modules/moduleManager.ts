import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";

import type { ModuleKind, ModuleUnit } from "./manifest.js";
import { readManifest } from "./manifest.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ModuleErrorCode =
	| "WORKSPACE_ROOT_NOT_FOUND"
	| "MODULE_MANIFEST_INVALID"
	| "MODULE_NAME_DUPLICATE"
	| "MODULE_DEPENDENCY_NOT_FOUND"
	| "MODULE_DEPENDENCY_CYCLE"
	| "MODULE_DEPENDENCY_DISABLED"
	| "MODULE_ENTRY_INVALID";

export class ModuleManagerError extends Error {
	constructor(
		readonly code: ModuleErrorCode,
		message: string,
		readonly context: Record<string, unknown> = {},
	) {
		super(message);
		this.name = "ModuleManagerError";
	}
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Which directories under rootDir to scan and what kind they represent. */
interface LayoutEntry {
	dir: string;
	kind: ModuleKind;
}

const DEFAULT_LAYOUT: LayoutEntry[] = [
	{ dir: "packages", kind: "package" },
	{ dir: "modules", kind: "module" },
];

export interface ModuleManagerOptions {
	/** Workspace root (auto-detected if omitted). */
	rootDir?: string;
	/** Override the directory layout to scan. */
	layout?: LayoutEntry[];
	/** Path to the activation override file. Default: <rootDir>/config/modules.json */
	configPath?: string;
	/**
	 * When true (default), the constructor throws on the first validation
	 * error.  When false, invalid units are silently excluded from the
	 * enabled set and reported via `invalid`.
	 */
	strict?: boolean;
}

// ---------------------------------------------------------------------------
// Activation config file & env overrides
// ---------------------------------------------------------------------------

interface ActivationConfig {
	enabled?: string[];
	disabled?: string[];
}

function parseActivationConfig(configPath: string): ActivationConfig {
	if (!existsSync(configPath)) return {};
	try {
		const raw = readFileSync(configPath, "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
		const result: ActivationConfig = {};
		if (Array.isArray((parsed as Record<string, unknown>).enabled))
			result.enabled = (parsed as Record<string, unknown>).enabled as string[];
		if (Array.isArray((parsed as Record<string, unknown>).disabled))
			result.disabled = (parsed as Record<string, unknown>).disabled as string[];
		return result;
	} catch {
		return {};
	}
}

function parseCommaList(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(/[,\s]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function resolveActivation(
	name: string,
	manifestDefault: boolean,
	config: ActivationConfig,
	envEnabled: string[],
	envDisabled: string[],
): boolean {
	let enabled = manifestDefault;

	// Config file overrides
	if (config.enabled?.includes(name)) enabled = true;
	if (config.disabled?.includes(name)) enabled = false;

	// Env overrides (highest precedence)
	if (envEnabled.includes(name)) enabled = true;
	if (envDisabled.includes(name)) enabled = false;

	return enabled;
}

// ---------------------------------------------------------------------------
// Workspace root detection
// ---------------------------------------------------------------------------

function findWorkspaceRoot(startDir: string): string {
	let dir = startDir;
	const maxDepth = 30;
	for (let i = 0; i < maxDepth; i++) {
		if (existsSync(join(dir, "pnpm-workspace.yaml")) || existsSync(join(dir, ".git"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new ModuleManagerError(
		"WORKSPACE_ROOT_NOT_FOUND",
		`No se pudo encontrar la raíz del workspace desde: ${startDir}`,
	);
}

// ---------------------------------------------------------------------------
// Cycle detection (DFS)
// ---------------------------------------------------------------------------

function detectCycles(units: ModuleUnit[]): string[] {
	const nameSet = new Set(units.map((u) => u.name));
	const unitByName = new Map(units.map((u) => [u.name, u]));
	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<string, number>();
	const errors: string[] = [];

	for (const name of nameSet) color.set(name, WHITE);

	function dfs(name: string): void {
		color.set(name, GRAY);
		const unit = unitByName.get(name);
		if (!unit) return;
		for (const dep of unit.dependsOn) {
			if (!nameSet.has(dep)) continue;
			const c = color.get(dep) ?? WHITE;
			if (c === GRAY) {
				errors.push(`Ciclo de dependencias: ${name} → ${dep} (en camino de vuelta)`);
				return;
			}
			if (c === WHITE) dfs(dep);
		}
		color.set(name, BLACK);
	}

	for (const name of nameSet) {
		if ((color.get(name) ?? WHITE) === WHITE) dfs(name);
	}

	return errors;
}

// ---------------------------------------------------------------------------
// ModuleManager
// ---------------------------------------------------------------------------

export class ModuleManager {
	readonly all: readonly ModuleUnit[];
	readonly invalid: readonly ModuleUnit[];

	private readonly unitByName: Map<string, ModuleUnit>;
	private readonly enabledSet: Set<string>;

	constructor(options: ModuleManagerOptions = {}) {
		const strict = options.strict ?? true;
		const rootDir = options.rootDir
			? resolve(options.rootDir)
			: findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));
		const layout = options.layout ?? DEFAULT_LAYOUT;
		const configPath = options.configPath ?? join(rootDir, "config", "modules.json");

		// --- Discover & parse ---
		const raw: ModuleUnit[] = [];

		for (const entry of layout) {
			const dirPath = join(rootDir, entry.dir);
			if (!existsSync(dirPath)) continue;
			for (const child of readdirSync(dirPath, { withFileTypes: true })) {
				if (!child.isDirectory() || child.name.startsWith(".")) continue;
				const unitDir = join(dirPath, child.name);
				const manifestPath = join(unitDir, "module.json");
				if (!existsSync(manifestPath)) continue;
				try {
					const manifest = readManifest(unitDir);
					raw.push({
						...manifest,
						directory: unitDir,
						manifestPath,
						kind: entry.kind,
						enabled: manifest.enabledDefault,
					});
				} catch (err) {
					if (err instanceof ZodError) {
						const mErr = new ModuleManagerError("MODULE_MANIFEST_INVALID", `Manifiesto inválido en ${manifestPath}`, {
							path: manifestPath,
							zodErrors: err.format(),
						});
						if (strict) throw mErr;
						raw.push({
							name: `invalid:${child.name}`,
							version: "0.0.0",
							enabledDefault: false,
							dependsOn: [],
							directory: unitDir,
							manifestPath,
							kind: entry.kind,
							enabled: false,
						});
					} else {
						throw err;
					}
				}
			}
		}

		// --- Duplicate names ---
		const seenNames = new Map<string, ModuleUnit>();
		const duplicates: string[] = [];
		for (const u of raw) {
			if (seenNames.has(u.name)) duplicates.push(u.name);
			else seenNames.set(u.name, u);
		}
		if (duplicates.length > 0) {
			const err = new ModuleManagerError(
				"MODULE_NAME_DUPLICATE",
				`Nombres duplicados: ${[...new Set(duplicates)].join(", ")}`,
				{ names: duplicates },
			);
			if (strict) throw err;
		}
		const deduped = [...seenNames.values()];

		// --- Dependency existence ---
		const nameSet = new Set(deduped.map((u) => u.name));
		const missingDeps: Array<{ name: string; missing: string }> = [];
		for (const u of deduped) {
			for (const dep of u.dependsOn) {
				if (!nameSet.has(dep)) missingDeps.push({ name: u.name, missing: dep });
			}
		}
		if (missingDeps.length > 0) {
			const err = new ModuleManagerError(
				"MODULE_DEPENDENCY_NOT_FOUND",
				`Dependencias inexistentes: ${missingDeps.map((m) => `${m.name} → ${m.missing}`).join(", ")}`,
				{ missingDeps },
			);
			if (strict) throw err;
		}

		// --- Cycles ---
		const cycleErrors = detectCycles(deduped);
		if (cycleErrors.length > 0) {
			const err = new ModuleManagerError("MODULE_DEPENDENCY_CYCLE", `Ciclos detectados: ${cycleErrors.join("; ")}`, {
				cycles: cycleErrors,
			});
			if (strict) throw err;
		}

		// --- Activation precedence ---
		const config = parseActivationConfig(configPath);
		const envEnabled = parseCommaList(process.env.ALXARAFE_MODULES_ENABLED);
		const envDisabled = parseCommaList(process.env.ALXARAFE_MODULES_DISABLED);

		for (const u of deduped) {
			// Packages are always enabled (infrastructure)
			if (u.kind === "package") {
				u.enabled = true;
			} else {
				u.enabled = resolveActivation(u.name, u.enabledDefault, config, envEnabled, envDisabled);
			}
		}

		// --- Validate enabled units have enabled deps ---
		const enabledUnits = deduped.filter((u) => u.enabled && u.kind === "module");
		const disabledDeps: Array<{ name: string; missing: string }> = [];
		for (const u of enabledUnits) {
			for (const dep of u.dependsOn) {
				const depUnit = deduped.find((d) => d.name === dep);
				if (depUnit && !depUnit.enabled) disabledDeps.push({ name: u.name, missing: dep });
			}
		}
		if (disabledDeps.length > 0) {
			const err = new ModuleManagerError(
				"MODULE_DEPENDENCY_DISABLED",
				`Módulos activos con dependencias desactivadas: ${disabledDeps.map((m) => `${m.name} → ${m.missing}`).join(", ")}`,
				{ disabledDeps },
			);
			if (strict) throw err;
		}

		// --- Store results (frozen) ---
		for (const u of deduped) Object.freeze(u);
		this.all = Object.freeze(deduped);
		this.invalid = Object.freeze(
			deduped.filter((u) => !nameSet.has(u.name) || u.dependsOn.some((d) => !nameSet.has(d))),
		);
		this.unitByName = new Map(deduped.map((u) => [u.name, u]));
		this.enabledSet = new Set(deduped.filter((u) => u.enabled).map((u) => u.name));
	}

	get enabled(): readonly ModuleUnit[] {
		return this.all.filter((u) => u.enabled);
	}

	get packages(): readonly ModuleUnit[] {
		return this.all.filter((u) => u.kind === "package");
	}

	get modules(): readonly ModuleUnit[] {
		return this.all.filter((u) => u.kind === "module");
	}

	isEnabled(name: string): boolean {
		return this.enabledSet.has(name);
	}

	getUnit(name: string): ModuleUnit | undefined {
		return this.unitByName.get(name);
	}

	/** Modules (not packages) that are enabled AND have a server block. */
	getEnabledFeatureModules(): readonly ModuleUnit[] {
		return this.all.filter((u) => u.kind === "module" && u.enabled && u.server);
	}
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

export function createModuleManager(options: ModuleManagerOptions = {}): ModuleManager {
	return new ModuleManager(options);
}
