import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { describe, expect, it, vi } from "vitest";

import { csrfProtection } from "../csrf.js";

function buildContext(overrides: { method?: string; token?: string; userId?: number; sessionToken?: string } = {}): {
	req: Request;
	res: Response;
	next: ReturnType<typeof vi.fn>;
} {
	const req = {
		method: overrides.method ?? "POST",
		headers: { "x-csrf-token": overrides.token },
		session: overrides.userId ? { userId: overrides.userId, csrfToken: overrides.sessionToken } : {},
	} as unknown as Request;
	const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response;
	const next = vi.fn() as unknown as ReturnType<typeof vi.fn>;
	return { req, res, next };
}

describe("csrfProtection", () => {
	it("permite métodos seguros sin comprobar el token", () => {
		const { req, res, next } = buildContext({ method: "GET", userId: 1 });
		csrfProtection(req, res, next as unknown as NextFunction);
		expect(next).toHaveBeenCalledTimes(1);
		expect(res.status).not.toHaveBeenCalled();
	});

	it("permite mutaciones sin sesión autenticada (login, register, reset)", () => {
		const { req, res, next } = buildContext({ method: "POST" });
		csrfProtection(req, res, next as unknown as NextFunction);
		expect(next).toHaveBeenCalledTimes(1);
	});

	it("permite una mutación autenticada con token correcto", () => {
		const { req, res, next } = buildContext({ userId: 7, sessionToken: "abc", token: "abc" });
		csrfProtection(req, res, next as unknown as NextFunction);
		expect(next).toHaveBeenCalledTimes(1);
	});

	it("rechaza con 403 una mutación autenticada sin token", () => {
		const { req, res, next } = buildContext({ userId: 7, sessionToken: "abc" });
		csrfProtection(req, res, next as unknown as NextFunction);
		expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
		expect(next).not.toHaveBeenCalled();
	});

	it("rechaza con 403 una mutación autenticada con token incorrecto", () => {
		const { req, res, next } = buildContext({ userId: 7, sessionToken: "abc", token: "evil" });
		csrfProtection(req, res, next as unknown as NextFunction);
		expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
		expect(next).not.toHaveBeenCalled();
	});
});
