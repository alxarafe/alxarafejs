import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts", "modules/**/src/**/*.test.ts"],
		coverage: {
			exclude: ["**/node_modules/**", "**/dist/**", "**/generated/**"],
		},
		globals: false,
		restoreMocks: true,
	},
});
