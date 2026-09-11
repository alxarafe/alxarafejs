import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, relative } from "node:path";
import type { ModuleManifest } from "@alxarafe/core";
import { createModuleManager, readManifest } from "@alxarafe/core";

import { readModulesConfig, writeModulesConfig } from "./config.js";
import { fail, getRoot, ok, readJsonName, run, warn } from "./helpers.js";

const MODULES_DIR = "modules";
const MODELS_DIR = join("packages", "database", "prisma", "models");

export interface AddModuleOptions {
	from: string;
	enable: boolean;
}

export interface RemoveModuleOptions {
	dropSchema: boolean;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function isGitUrl(value: string): boolean {
	return /^(?:https?|git|ssh):\/\//i.test(value) || /^git@[^:]+:.+\.git$/i.test(value);
}

// ---------------------------------------------------------------------------
// Materialization (add)
// ---------------------------------------------------------------------------

// Los módulos se materializan SIEMPRE como directorios locales no trackeados
// (modules/ está en .gitignore del núcleo). Nunca se registran como submodules:
// un `git submodule add` escribiría .gitmodules y anclaría el gitlink, dejando
// rastro en el repositorio del núcleo.
function materialize(root: string, name: string, from: string): void {
	const target = join(root, MODULES_DIR, name);
	if (existsSync(target)) fail(`La ruta '${target}' ya existe.`);
	mkdirSync(join(root, MODULES_DIR), { recursive: true });

	if (existsSync(from)) {
		cpSync(from, target, { recursive: true });
		return;
	}
	if (isGitUrl(from)) {
		run(`git clone ${from} modules/${name}`);
		return;
	}
	fail(`'${from}' no es ni una ruta local ni una URL git.`);
}

function cleanupMaterialized(root: string, name: string): void {
	rmSync(join(root, MODULES_DIR, name), { recursive: true, force: true });
}

function ensurePrismaFragment(root: string, name: string, fragment: string): void {
	const modelsDir = join(root, MODELS_DIR);
	const link = join(modelsDir, `${name}.prisma`);
	rmSync(link, { force: true }); // drop any previous (possibly dangling) link first
	mkdirSync(modelsDir, { recursive: true });
	const rel = relative(modelsDir, join(root, MODULES_DIR, name, "prisma", fragment));
	symlinkSync(rel, link);
	ok(`Prisma fragment enlazado: ${join(MODELS_DIR, `${name}.prisma`)}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function listModules(): void {
	const root = getRoot();
	const manager = createModuleManager({ rootDir: root });
	console.log(`Raíz del workspace: ${root}`);
	for (const u of manager.all) {
		const server = u.server ? ` mount=${u.server.mountPath} entry=${u.server.entry ?? "src/index.ts"}` : "";
		console.log(
			`  ${u.kind.padEnd(7)} ${u.name.padEnd(14)} v${u.version.padEnd(7)} ${u.enabled ? "activo   " : "inactivo "} deps=[${u.dependsOn.join(", ")}]${server}`,
		);
	}
	console.log(
		`Total: ${manager.all.length} unidades (${manager.packages.length} packages, ${manager.modules.length} módulos), ${manager.enabled.length} activas.`,
	);
}

export function validateModules(name?: string): void {
	const root = getRoot();
	const manager = createModuleManager({ rootDir: root });
	if (name) {
		const unit = manager.getUnit(name);
		if (!unit) fail(`'${name}' no se encuentra en el workspace.`);
		ok(`'${unit.name}' (${unit.kind}) válido. deps=[${unit.dependsOn.join(", ")}]`);
		return;
	}
	ok(
		`Grafo válido: ${manager.all.length} unidades (${manager.packages.length} packages, ${manager.modules.length} módulos), ${manager.enabled.length} activas.`,
	);
}

export function enableModule(name: string): void {
	if (!name) fail("Falta el nombre del módulo.");
	const root = getRoot();
	const initial = createModuleManager({ rootDir: root });
	const unit = initial.getUnit(name);
	if (!unit) fail(`'${name}' no se encuentra en el workspace.`);
	if (unit.kind === "package") fail("Los packages (infraestructura) siempre están activos.");
	if (unit.enabled) {
		ok(`'${name}' ya está activo.`);
		return;
	}

	const cfg = readModulesConfig(root);
	const original = JSON.stringify(cfg);
	cfg.enabled = [...new Set([...(cfg.enabled ?? []), name])];
	cfg.disabled = (cfg.disabled ?? []).filter((n) => n !== name);
	writeModulesConfig(root, cfg);
	try {
		createModuleManager({ rootDir: root });
	} catch (err) {
		writeModulesConfig(root, JSON.parse(original) as ReturnType<typeof readModulesConfig>);
		fail(`No se puede activar '${name}': ${err instanceof Error ? err.message : String(err)}`);
	}
	ok(`'${name}' activado.`);
}

export function disableModule(name: string): void {
	if (!name) fail("Falta el nombre del módulo.");
	const root = getRoot();
	const initial = createModuleManager({ rootDir: root });
	const unit = initial.getUnit(name);
	if (!unit) fail(`'${name}' no se encuentra en el workspace.`);
	if (unit.kind === "package") fail("Los packages (infraestructura) siempre están activos.");
	if (!unit.enabled) {
		ok(`'${name}' ya está inactivo.`);
		return;
	}

	const cfg = readModulesConfig(root);
	const original = JSON.stringify(cfg);
	cfg.disabled = [...new Set([...(cfg.disabled ?? []), name])];
	cfg.enabled = (cfg.enabled ?? []).filter((n) => n !== name);
	writeModulesConfig(root, cfg);
	try {
		createModuleManager({ rootDir: root });
	} catch (err) {
		writeModulesConfig(root, JSON.parse(original) as ReturnType<typeof readModulesConfig>);
		fail(`No se puede desactivar '${name}': ${err instanceof Error ? err.message : String(err)}`);
	}
	ok(`'${name}' desactivado.`);
}

export function addModule(name: string, opts: AddModuleOptions): void {
	if (!name) fail("Falta el nombre del módulo.");
	if (!opts.from) fail("Falta '--from <url|ruta>'.");
	const root = getRoot();
	const existing = createModuleManager({ rootDir: root }).getUnit(name);
	if (existing) fail(`Ya existe '${name}' en el workspace.`);

	materialize(root, name, opts.from);

	let manifest: ModuleManifest;
	try {
		manifest = readManifest(join(root, MODULES_DIR, name));
	} catch (err) {
		cleanupMaterialized(root, name);
		fail(`Manifiesto inválido tras materializar '${name}': ${err instanceof Error ? err.message : String(err)}`);
	}
	if (manifest.name !== name) {
		cleanupMaterialized(root, name);
		fail(`El manifest declara name='${manifest.name}' pero el módulo se llama '${name}'.`);
	}

	if (manifest.prisma) {
		ensurePrismaFragment(root, name, manifest.prisma.fragment);
	}

	if (opts.enable) {
		const cfg = readModulesConfig(root);
		cfg.enabled = [...new Set([...(cfg.enabled ?? []), name])];
		cfg.disabled = (cfg.disabled ?? []).filter((n) => n !== name);
		writeModulesConfig(root, cfg);
		ok(`'${name}' añadido a config/modules.json (activado).`);
	} else {
		ok(`'${name}' instalado pero sin activar (config no modificada).`);
	}

	run("pnpm install", root);

	const pkgName = readJsonName(join(root, MODULES_DIR, name, "package.json"));
	if (pkgName) {
		try {
			run(`pnpm --filter ${pkgName} run build`, root);
		} catch {
			warn(`No se pudo construir '${pkgName}'. Revisa su script 'build'.`);
		}
	} else {
		warn("No hay package.json en el módulo; se omite el build (no se podrá cargar en runtime).");
	}

	if (manifest.prisma) {
		run("pnpm db:generate", root);
	}

	try {
		createModuleManager({ rootDir: root });
	} catch (err) {
		warn(`El grafo aún no es válido tras instalar: ${err instanceof Error ? err.message : String(err)}`);
	}
	ok(`Módulo '${name}' instalado.`);
}

export function removeModule(name: string, opts: RemoveModuleOptions): void {
	if (!name) fail("Falta el nombre del módulo.");
	const root = getRoot();

	// Best-effort validation: if the graph is currently invalid (e.g. a
	// broken manifest) we still allow removing the offending directory.
	const manager = createModuleManager({ rootDir: root });
	const unit = manager.getUnit(name);
	if (unit?.kind === "package") fail(`'${name}' es un package (infraestructura); no se puede desinstalar.`);
	if (unit) {
		const dependents = manager.all.filter((u) => u.dependsOn.includes(name)).map((u) => u.name);
		if (dependents.length > 0) fail(`No se puede desinstalar '${name}': lo necesitan ${dependents.join(", ")}.`);
	}

	const target = join(root, MODULES_DIR, name);
	if (!existsSync(target)) fail(`No existe '${target}'.`);

	rmSync(target, { recursive: true, force: true });

	const link = join(root, MODELS_DIR, `${name}.prisma`);
	rmSync(link, { force: true }); // force: also removes a dangling symlink

	const cfg = readModulesConfig(root);
	const before = JSON.stringify(cfg);
	cfg.enabled = (cfg.enabled ?? []).filter((n) => n !== name);
	cfg.disabled = (cfg.disabled ?? []).filter((n) => n !== name);
	if (JSON.stringify(cfg) !== before) writeModulesConfig(root, cfg);

	try {
		run("pnpm db:generate", root);
	} catch {
		warn("No se pudo regenerar el cliente Prisma.");
	}

	if (opts.dropSchema) {
		try {
			run(`pnpm db:migrate -- --name drop_${name.toLowerCase()}_schema`, root);
		} catch {
			warn("No se pudo crear la migración de borrado. ¿Está levantada la base de datos?");
		}
	}

	try {
		run("pnpm install", root);
	} catch {
		warn("No se pudo relinkear el workspace (pnpm install).");
	}
	ok(`Módulo '${name}' desinstalado.`);
}
