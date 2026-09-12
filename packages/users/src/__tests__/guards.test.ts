import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "../userModel.js";

const { findById } = vi.hoisted(() => ({ findById: vi.fn() }));

vi.mock("@alxarafe/session", () => ({}));
vi.mock("../userService.js", () => ({
	userService: { findById },
}));

import { requireAuth, requireRole, requireSameUserOrAdmin } from "../guards.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const admin: User = {
	id: 1,
	name: "Admin",
	email: "admin@alxarafe.com",
	role: "ADMIN",
	emailVerifiedAt: now,
	createdAt: now,
	updatedAt: now,
};
const regularUser: User = {
	id: 2,
	name: "Regular",
	email: "user@alxarafe.com",
	role: "USER",
	emailVerifiedAt: null,
	createdAt: now,
	updatedAt: now,
};

function makeMocks(user?: User, session: { userId?: number } = {}) {
	const req = { user, session, params: {} } as unknown as Request;
	const res = {
		status: vi.fn().mockReturnThis(),
		send: vi.fn(),
	} as unknown as Response;
	const next = vi.fn();
	return { req, res, next };
}

describe("requireAuth", () => {
	beforeEach(() => {
		findById.mockReset();
	});

	it("rechaza con 401 si no hay sesión", async () => {
		const { req, res, next } = makeMocks(undefined);
		await requireAuth(req, res, next);

		expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
		expect(next).not.toHaveBeenCalled();
	});

	it("rechaza con 401 si la sesión ya no es válida", async () => {
		findById.mockResolvedValue({
			success: false,
			message: "User not found",
			responseObject: null,
			statusCode: StatusCodes.NOT_FOUND,
		});
		const { req, res, next } = makeMocks(undefined, { userId: 2 });

		await requireAuth(req, res, next);

		expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
		expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Session is no longer valid" }));
		expect(next).not.toHaveBeenCalled();
	});

	it("deja pasar y puebla req.user si la sesión es válida", async () => {
		findById.mockResolvedValue({
			success: true,
			message: "User found",
			responseObject: regularUser,
			statusCode: StatusCodes.OK,
		});
		const { req, res, next } = makeMocks(undefined, { userId: 2 });

		await requireAuth(req, res, next);

		expect(req.user).toEqual(regularUser);
		expect(next).toHaveBeenCalledOnce();
	});
});

describe("requireRole", () => {
	it("rechaza con 401 si no hay usuario autenticado", () => {
		const { req, res, next } = makeMocks(undefined);
		requireRole("ADMIN")(req, res, next);

		expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
		expect(next).not.toHaveBeenCalled();
	});

	it("rechaza con 403 si el rol no está permitido", () => {
		const { req, res, next } = makeMocks(regularUser);
		requireRole("ADMIN")(req, res, next);

		expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
		expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Insufficient permissions" }));
		expect(next).not.toHaveBeenCalled();
	});

	it("deja pasar si el rol está permitido", () => {
		const { req, res, next } = makeMocks(admin);
		requireRole("ADMIN")(req, res, next);

		expect(next).toHaveBeenCalledOnce();
	});
});

describe("requireSameUserOrAdmin", () => {
	it("rechaza con 401 si no hay usuario autenticado", () => {
		const { req, res, next } = makeMocks(undefined);
		requireSameUserOrAdmin(req, res, next);

		expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
		expect(next).not.toHaveBeenCalled();
	});

	it("deja pasar a un administrador sobre cualquier usuario", () => {
		const { req, res, next } = makeMocks(admin, { userId: 1 });
		req.params = { id: "7" };

		requireSameUserOrAdmin(req, res, next);

		expect(next).toHaveBeenCalledOnce();
	});

	it("deja pasar al propio usuario sobre sí mismo", () => {
		const { req, res, next } = makeMocks(regularUser, { userId: 2 });
		req.params = { id: "2" };

		requireSameUserOrAdmin(req, res, next);

		expect(next).toHaveBeenCalledOnce();
	});

	it("rechaza con 403 a un usuario no administrador sobre otro", () => {
		const { req, res, next } = makeMocks(regularUser, { userId: 2 });
		req.params = { id: "3" };

		requireSameUserOrAdmin(req, res, next);

		expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
		expect(next).not.toHaveBeenCalled();
	});
});
