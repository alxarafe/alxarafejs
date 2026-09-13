import express from "express";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../errorHandler.js";

describe("errorHandler", () => {
	it("responds unknown routes with a 404 ServiceResponse envelope", async () => {
		const app = express();
		app.use(errorHandler());

		const response = await request(app).get("/does-not-exist");

		expect(response.status).toEqual(StatusCodes.NOT_FOUND);
		expect(response.body).toEqual({
			success: false,
			message: "Route not found",
			responseObject: null,
			statusCode: StatusCodes.NOT_FOUND,
		});
	});

	it("responds unhandled errors with a 500 ServiceResponse envelope", async () => {
		const app = express();
		app.get("/boom", () => {
			throw new Error("kaboom");
		});
		app.use(errorHandler());

		const response = await request(app).get("/boom");

		expect(response.status).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
		expect(response.body.success).toBe(false);
		expect(response.body.message).toBe("kaboom");
		expect(response.body.responseObject).toBeNull();
		expect(response.body.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
	});

	it("honours a statusCode set by the thrown error", async () => {
		const app = express();
		app.get("/conflict", () => {
			const err = new Error("already busy") as Error & { statusCode: number };
			err.statusCode = StatusCodes.CONFLICT;
			throw err;
		});
		app.use(errorHandler());

		const response = await request(app).get("/conflict");

		expect(response.status).toEqual(StatusCodes.CONFLICT);
		expect(response.body.statusCode).toEqual(StatusCodes.CONFLICT);
	});
});
