import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema for module.json (applies to both packages/ and modules/)
// ---------------------------------------------------------------------------

const ServerSchema = z.object({
	mountPath: z.string().startsWith("/"),
	entry: z.string().optional(),
	routerExport: z.string().default("router"),
	registryExport: z.string().optional(),
});

const PrismaSchema = z.object({
	fragment: z.string(),
	models: z.array(z.string()),
});

export const ModuleManifestSchema = z
	.object({
		name: z.string().min(1),
		version: z.string(),
		description: z.string().optional(),
		enabledDefault: z.boolean().default(true),
		dependsOn: z.array(z.string()).default([]),
		prisma: PrismaSchema.optional(),
		server: ServerSchema.optional(),
	})
	.strict();

export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

// ---------------------------------------------------------------------------
// Parsed unit (manifest + resolved state)
// ---------------------------------------------------------------------------

export type ModuleKind = "package" | "module";

export interface ModuleUnit extends ModuleManifest {
	/** Absolute path to the directory containing module.json */
	directory: string;
	/** Absolute path to the manifest file */
	manifestPath: string;
	/** Inferred from the directory that holds the manifest */
	kind: ModuleKind;
	/** Resolved after activation precedence (manifest → config → env) */
	enabled: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read and validate a module.json from disk.
 * Returns the parsed manifest or throws a ZodError.
 */
export function readManifest(dir: string): ModuleManifest {
	const path = join(dir, "module.json");
	const raw = readFileSync(path, "utf8");
	return ModuleManifestSchema.parse(JSON.parse(raw));
}
