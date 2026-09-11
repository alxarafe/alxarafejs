export type { ModuleKind, ModuleManifest, ModuleUnit } from "./manifest.js";
export { ModuleManifestSchema, readManifest } from "./manifest.js";
export type { ActivationConfig, ModuleErrorCode, ModuleManagerOptions } from "./moduleManager.js";
export { createModuleManager, findWorkspaceRoot, ModuleManager, ModuleManagerError } from "./moduleManager.js";
