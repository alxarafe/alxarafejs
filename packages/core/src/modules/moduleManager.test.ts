import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ModuleManager, ModuleManagerError } from "./moduleManager.js";

function writeModule(dir: string, data: Record<string, unknown>): void {
	writeFileSync(join(dir, "module.json"), JSON.stringify(data, null, "\t"), "utf8");
}

function scaffold(base: string, tree: Record<string, unknown>): void {
	for (const [rel, data] of Object.entries(tree)) {
		const abs = join(base, rel);
		mkdirSync(abs, { recursive: true });
		writeModule(abs, data as Record<string, unknown>);
	}
}

describe("ModuleManager", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "modmgr-"));
		mkdirSync(join(tmp, "packages"), { recursive: true });
		mkdirSync(join(tmp, "modules"), { recursive: true });
		mkdirSync(join(tmp, "config"), { recursive: true });
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	// -----------------------------------------------------------------------
	// Discovery
	// -----------------------------------------------------------------------

	describe("discovery", () => {
		it("discovers packages and modules", () => {
			scaffold(tmp, {
				"packages/core": { name: "core", version: "1.0.0", dependsOn: [] },
				"packages/database": { name: "database", version: "1.0.0", dependsOn: ["core"] },
				"modules/billing": {
					name: "billing",
					version: "1.0.0",
					dependsOn: ["core"],
					server: { mountPath: "/billing" },
				},
			});
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.all).toHaveLength(3);
			expect(m.packages.map((u) => u.name)).toEqual(["core", "database"]);
			expect(m.modules.map((u) => u.name)).toEqual(["billing"]);
		});

		it("ignores directories without module.json", () => {
			mkdirSync(join(tmp, "packages", "empty"), { recursive: true });
			scaffold(tmp, { "packages/core": { name: "core", version: "1.0.0" } });
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.all).toHaveLength(1);
		});

		it("skips missing layout dirs without error", () => {
			scaffold(tmp, { "packages/core": { name: "core", version: "1.0.0" } });
			const m = new ModuleManager({
				rootDir: tmp,
				layout: [
					{ dir: "packages", kind: "package" },
					{ dir: "nonexistent", kind: "module" },
				],
			});
			expect(m.all).toHaveLength(1);
		});
	});

	// -----------------------------------------------------------------------
	// Validation: dependency existence
	// -----------------------------------------------------------------------

	describe("dependency existence", () => {
		it("rejects a module whose dependsOn points to a missing name", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", dependsOn: ["ghost"] },
			});
			expect(() => new ModuleManager({ rootDir: tmp, strict: true })).toThrow(ModuleManagerError);
			try {
				new ModuleManager({ rootDir: tmp, strict: true });
			} catch (err) {
				expect((err as ModuleManagerError).code).toBe("MODULE_DEPENDENCY_NOT_FOUND");
			}
		});

		it("passes strict mode when all deps exist", () => {
			scaffold(tmp, {
				"packages/core": { name: "core", version: "1.0.0", dependsOn: [] },
				"modules/alpha": { name: "alpha", version: "1.0.0", dependsOn: ["core"] },
			});
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.all).toHaveLength(2);
		});
	});

	// -----------------------------------------------------------------------
	// Validation: cycle detection
	// -----------------------------------------------------------------------

	describe("cycle detection", () => {
		it("rejects mutual dependency (A → B → A)", () => {
			scaffold(tmp, {
				"modules/a": { name: "a", version: "1.0.0", dependsOn: ["b"] },
				"modules/b": { name: "b", version: "1.0.0", dependsOn: ["a"] },
			});
			expect(() => new ModuleManager({ rootDir: tmp, strict: true })).toThrow(ModuleManagerError);
			try {
				new ModuleManager({ rootDir: tmp, strict: true });
			} catch (err) {
				expect((err as ModuleManagerError).code).toBe("MODULE_DEPENDENCY_CYCLE");
			}
		});

		it("rejects longer cycles (A → B → C → A)", () => {
			scaffold(tmp, {
				"modules/a": { name: "a", version: "1.0.0", dependsOn: ["b"] },
				"modules/b": { name: "b", version: "1.0.0", dependsOn: ["c"] },
				"modules/c": { name: "c", version: "1.0.0", dependsOn: ["a"] },
			});
			expect(() => new ModuleManager({ rootDir: tmp, strict: true })).toThrow(ModuleManagerError);
		});
	});

	// -----------------------------------------------------------------------
	// Validation: enabled modules must have enabled deps
	// -----------------------------------------------------------------------

	describe("dependency activation", () => {
		it("allows a disabled module to have a disabled dep", () => {
			scaffold(tmp, {
				"modules/a": { name: "a", version: "1.0.0", enabledDefault: false, dependsOn: ["b"] },
				"modules/b": { name: "b", version: "1.0.0", enabledDefault: false, dependsOn: [] },
			});
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.isEnabled("a")).toBe(false);
			expect(m.isEnabled("b")).toBe(false);
		});

		it("rejects an enabled module whose dep is disabled", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", enabledDefault: true, dependsOn: ["beta"] },
				"modules/beta": { name: "beta", version: "1.0.0", enabledDefault: false, dependsOn: [] },
			});
			expect(() => new ModuleManager({ rootDir: tmp, strict: true })).toThrow(ModuleManagerError);
			try {
				new ModuleManager({ rootDir: tmp, strict: true });
			} catch (err) {
				expect((err as ModuleManagerError).code).toBe("MODULE_DEPENDENCY_DISABLED");
			}
		});
	});

	// -----------------------------------------------------------------------
	// Activation overrides: config file
	// -----------------------------------------------------------------------

	describe("config file override", () => {
		it("disables a module that is enabledDefault true", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", dependsOn: [] },
			});
			writeFileSync(join(tmp, "config", "modules.json"), JSON.stringify({ disabled: ["alpha"] }), "utf8");
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.isEnabled("alpha")).toBe(false);
		});

		it("enables a module that is enabledDefault false", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", enabledDefault: false, dependsOn: [] },
			});
			writeFileSync(join(tmp, "config", "modules.json"), JSON.stringify({ enabled: ["alpha"] }), "utf8");
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.isEnabled("alpha")).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Activation overrides: env
	// -----------------------------------------------------------------------

	describe("env override", () => {
		it("env disabled wins over manifest default", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", dependsOn: [] },
			});
			process.env.ALXARAFE_MODULES_DISABLED = "alpha";
			try {
				const m = new ModuleManager({ rootDir: tmp, strict: true });
				expect(m.isEnabled("alpha")).toBe(false);
			} finally {
				delete process.env.ALXARAFE_MODULES_DISABLED;
			}
		});

		it("env enabled wins over manifest default false", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", enabledDefault: false, dependsOn: [] },
			});
			process.env.ALXARAFE_MODULES_ENABLED = "alpha";
			try {
				const m = new ModuleManager({ rootDir: tmp, strict: true });
				expect(m.isEnabled("alpha")).toBe(true);
			} finally {
				delete process.env.ALXARAFE_MODULES_ENABLED;
			}
		});

		it("env wins over config file", () => {
			scaffold(tmp, {
				"modules/alpha": { name: "alpha", version: "1.0.0", dependsOn: [] },
			});
			writeFileSync(join(tmp, "config", "modules.json"), JSON.stringify({ enabled: ["alpha"] }), "utf8");
			process.env.ALXARAFE_MODULES_DISABLED = "alpha";
			try {
				const m = new ModuleManager({ rootDir: tmp, strict: true });
				expect(m.isEnabled("alpha")).toBe(false);
			} finally {
				delete process.env.ALXARAFE_MODULES_DISABLED;
			}
		});
	});

	// -----------------------------------------------------------------------
	// Feature modules selector
	// -----------------------------------------------------------------------

	describe("getEnabledFeatureModules", () => {
		it("returns only enabled modules with a server block", () => {
			scaffold(tmp, {
				"packages/core": { name: "core", version: "1.0.0" },
				"modules/api": {
					name: "api",
					version: "1.0.0",
					enabledDefault: true,
					dependsOn: [],
					server: { mountPath: "/api" },
				},
				"modules/hidden": {
					name: "hidden",
					version: "1.0.0",
					enabledDefault: false,
					dependsOn: [],
					server: { mountPath: "/hidden" },
				},
				"modules/noserver": { name: "noserver", version: "1.0.0", dependsOn: [] },
			});
			const m = new ModuleManager({ rootDir: tmp, strict: true });
			expect(m.getEnabledFeatureModules().map((u) => u.name)).toEqual(["api"]);
		});
	});

	// -----------------------------------------------------------------------
	// Duplicate names
	// -----------------------------------------------------------------------

	describe("duplicate names", () => {
		it("rejects duplicate names across packages and modules", () => {
			scaffold(tmp, {
				"packages/shared": { name: "shared", version: "1.0.0" },
				"modules/shared": { name: "shared", version: "1.0.0" },
			});
			expect(() => new ModuleManager({ rootDir: tmp, strict: true })).toThrow(ModuleManagerError);
			try {
				new ModuleManager({ rootDir: tmp, strict: true });
			} catch (err) {
				expect((err as ModuleManagerError).code).toBe("MODULE_NAME_DUPLICATE");
			}
		});
	});
});
