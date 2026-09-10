import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../server";

describe("Health Check API endpoints", () => {
	it("GET /health-check should return healthy", async () => {
		const response = await request(app).get("/health-check");
		expect(response.status).toEqual(StatusCodes.OK);
		expect(response.body.success).toBe(true);
		expect(response.body.message).toBe("Service is healthy");
		expect(response.body.responseObject).toBeNull();
	});
});
