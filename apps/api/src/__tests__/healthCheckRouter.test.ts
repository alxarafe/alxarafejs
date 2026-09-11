import { ModuleManager } from "@alxarafe/core";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";

// A manager without any units: keeps the health check test isolated
// from real modules and their runtime dependencies.
const emptyManager = new ModuleManager({ rootDir: process.cwd(), layout: [], strict: true });

describe("Health Check API endpoints", () => {
	it("GET /health-check should return healthy", async () => {
		const app = await createApp({ moduleManager: emptyManager });
		const response = await request(app).get("/health-check");
		expect(response.status).toEqual(StatusCodes.OK);
		expect(response.body.success).toBe(true);
		expect(response.body.message).toBe("Service is healthy");
		expect(response.body.responseObject).toBeNull();
	});
});
