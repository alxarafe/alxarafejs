import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packages = ["core", "database", "email", "session", "users", "auth"];

export default defineConfig({
	resolve: {
		alias: Object.fromEntries(
			packages.map((name) => [
				`@alxarafe/${name}`,
				fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
			]),
		),
	},
	test: {
		include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts", "modules/**/src/**/*.test.ts"],
		coverage: {
			exclude: ["**/node_modules/**", "**/dist/**", "**/generated/**"],
		},
		globals: false,
		restoreMocks: true,
	},
});
