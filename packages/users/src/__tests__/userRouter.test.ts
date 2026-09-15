import express from "express";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateUserMock } = vi.hoisted(() => ({ updateUserMock: vi.fn() }));

vi.mock("../guards.js", () => ({
	requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
	requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	requireSameUserOrAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../userController.js", () => ({
	userController: {
		getUsers: (_req: unknown, _res: unknown) => undefined,
		getUser: (_req: unknown, _res: unknown) => undefined,
		updateUser: (...args: unknown[]) => updateUserMock(...args),
	},
}));

import { userRouter } from "../userRouter.js";

const app = express();
app.use(express.json());
app.use("/users", userRouter);

function replyOk(response: import("express").Response): void {
	response.status(StatusCodes.OK).send({
		success: true,
		message: "User updated",
		responseObject: { id: 1, name: "Ada" },
		statusCode: StatusCodes.OK,
	});
}

describe("PATCH /users/:id", () => {
	beforeEach(() => {
		updateUserMock.mockReset();
	});

	it("reaches the controller with the validated body", async () => {
		updateUserMock.mockImplementation((_req: unknown, res: import("express").Response) => replyOk(res));

		const res = await request(app).patch("/users/1").send({ name: "Grace" });

		expect(res.status).toBe(StatusCodes.OK);
		expect(updateUserMock).toHaveBeenCalledTimes(1);
		const [req] = updateUserMock.mock.calls[0] as [unknown[]];
		expect((req as { body: { name: string } }).body.name).toBe("Grace");
	});

	it("rejects an invalid email with 400 before the controller", async () => {
		const res = await request(app).patch("/users/1").send({ email: "not-an-email" });

		expect(res.status).toBe(StatusCodes.BAD_REQUEST);
		expect(updateUserMock).not.toHaveBeenCalled();
	});

	it("rejects an empty body with 400 (nothing to update)", async () => {
		const res = await request(app).patch("/users/1").send({});

		expect(res.status).toBe(StatusCodes.BAD_REQUEST);
		expect(updateUserMock).not.toHaveBeenCalled();
	});

	it("rejects a non-numeric id with 400", async () => {
		const res = await request(app).patch("/users/abc").send({ name: "Grace" });

		expect(res.status).toBe(StatusCodes.BAD_REQUEST);
		expect(updateUserMock).not.toHaveBeenCalled();
	});
});
