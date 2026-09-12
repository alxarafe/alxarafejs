import { describe, expect, it } from "vitest";

import { assertValidModuleName, isGitUrl, isValidModuleName } from "../helpers.js";

describe("isValidModuleName", () => {
	it("acepta nombres de módulo válidos", () => {
		for (const name of ["contacts", "my-module2", "a", "a_b"]) {
			expect(isValidModuleName(name)).toBe(true);
		}
	});

	it("rechaza nombres que escapan de modules/ o inyectan shell", () => {
		for (const name of [
			"",
			"Contacts",
			"-x",
			"..",
			".",
			"/etc/passwd",
			"a/b",
			"a\\b",
			"a.b",
			"a b",
			"á",
			"a;rm -rf /",
			"x$(whoami)",
		]) {
			expect(isValidModuleName(name)).toBe(false);
		}
	});

	it("assertValidModuleName lanza sobre nombres inválidos", () => {
		expect(() => assertValidModuleName("..")).toThrow();
	});
});

describe("isGitUrl", () => {
	it("acepta orígenes permitidos", () => {
		for (const url of [
			"https://github.com/alxarafe/alxarafejs-contacts.git",
			"git://host/repo.git",
			"ssh://git@host/repo",
			"git@github.com:alxarafe/alxarafejs-contacts.git",
		]) {
			expect(isGitUrl(url)).toBe(true);
		}
	});

	it("rechaza rutas con protocolo fuera del allowlist", () => {
		for (const url of ["file:///etc/passwd", "ftp://host/x", "localhost/x", "ruta/local"]) {
			expect(isGitUrl(url)).toBe(false);
		}
	});
});
