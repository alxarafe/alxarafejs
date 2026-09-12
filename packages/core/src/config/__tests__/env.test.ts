import { describe, expect, it } from "vitest";

import { resolveEnv } from "../env.js";

const PROD_VARS = {
	NODE_ENV: "production",
	SESSION_SECRET: "0123456789abcdef0123456789abcdef",
	PUBLIC_WEB_URL: "https://app.alxarafe.com",
	TRUST_PROXY: "loopback",
	SMTP_HOST: "smtp.example.com",
	SMTP_TRANSPORT: "smtp",
};

const TWENTY_CHAR_SECRET = "a".repeat(20);

function without(obj: Record<string, unknown>, key: string): Record<string, unknown> {
	const copy = { ...obj };
	delete copy[key];
	return copy;
}

describe("resolveEnv", () => {
	it("acepta configuración correcta en producción", () => {
		const loaded = resolveEnv({ ...PROD_VARS });
		expect(loaded.isProduction).toBe(true);
		expect(loaded.PUBLIC_WEB_URL).toBe("https://app.alxarafe.com");
		expect(loaded.TRUST_PROXY).toBe("loopback");
	});

	it("rechaza producción sin SESSION_SECRET con entropía suficiente", () => {
		expect(() => resolveEnv({ ...without(PROD_VARS, "SESSION_SECRET") })).toThrow();
		expect(() => resolveEnv({ ...PROD_VARS, SESSION_SECRET: TWENTY_CHAR_SECRET })).toThrow();
	});

	it("rechaza producción sin PUBLIC_WEB_URL ni TRUST_PROXY explícitos", () => {
		expect(() => resolveEnv({ ...without(PROD_VARS, "PUBLIC_WEB_URL") })).toThrow();
		expect(() => resolveEnv({ ...without(PROD_VARS, "TRUST_PROXY") })).toThrow();
	});

	it("rechaza producción con SMTP_HOST vacío sin transporte explícito", () => {
		expect(() => resolveEnv({ ...PROD_VARS, SMTP_HOST: "" })).toThrow();
	});

	it("permite transporte a disco explícito en producción (SMTP_TRANSPORT=disk)", () => {
		const loaded = resolveEnv({ ...PROD_VARS, SMTP_HOST: "", SMTP_TRANSPORT: "disk" });
		expect(loaded.SMTP_TRANSPORT).toBe("disk");
	});

	it("un NODE_ENV ausente cae de forma segura a los checks de producción", () => {
		expect(() => resolveEnv(without(PROD_VARS, "NODE_ENV"))).toThrow();
	});

	it("mantiene los defaults de desarrollo", () => {
		const loaded = resolveEnv({ NODE_ENV: "development" });
		expect(loaded.isDevelopment).toBe(true);
		expect(loaded.isProduction).toBe(false);
		expect(loaded.SESSION_SECRET).toBeDefined();
	});
});
