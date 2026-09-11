import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ActivationConfig } from "@alxarafe/core";

export function modulesConfigPath(root: string): string {
	return join(root, "config", "modules.json");
}

export function readModulesConfig(root: string): ActivationConfig {
	const path = modulesConfigPath(root);
	if (!existsSync(path)) return { enabled: [], disabled: [] };
	try {
		const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ActivationConfig>;
		return {
			enabled: Array.isArray(raw.enabled) ? (raw.enabled as string[]) : [],
			disabled: Array.isArray(raw.disabled) ? (raw.disabled as string[]) : [],
		};
	} catch {
		return { enabled: [], disabled: [] };
	}
}

export function writeModulesConfig(root: string, cfg: ActivationConfig): void {
	const path = modulesConfigPath(root);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(cfg, null, "\t")}\n`);
}
