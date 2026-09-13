import { ModuleManager } from "@alxarafe/core";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createHealthCheckRouter } from "../healthCheckRouter.js";

// A manager without any units: keeps the health check test isolated
// from real modules and their runtime dependencies.
const emptyManager = new ModuleManager({ rootDir: process.cwd(), layout: [], strict: true });

const readyRouter = createHealthCheckRouter({ isRedisReady: () => true, isDatabaseReady: () => true });
const redisDownRouter = createHealthCheckRouter({ isRedisReady: () => false, isDatabaseReady: () => true });
const databaseDownRouter = createHealthCheckRouter({ isRedisReady: () => true, isDatabaseReady: () => false });

describe("Health Check API endpoints", () => {
	it("GET /health-check should report ready when dependencies respond", async () => {
		const app = await createApp({ moduleManager: emptyManager, healthRouter: readyRouter });
		const response = await request(app).get("/health-check");
		expect(response.status).toEqual(StatusCodes.OK);
		expect(response.body.success).toBe(true);
		expect(response.body.message).toBe("Service is healthy");
		expect(response.body.responseObject.checks).toEqual({ redis: "ok", database: "ok" });
	});

	it("should answer 503 with the affected check when Redis is unavailable", async () => {
		const app = await createApp({ moduleManager: emptyManager, healthRouter: redisDownRouter });
		const response = await request(app).get("/health-check");
		expect(response.status).toEqual(StatusCodes.SERVICE_UNAVAILABLE);
		expect(response.body.success).toBe(false);
		expect(response.body.message).toBe("Service is not ready");
		expect(response.body.responseObject.checks).toEqual({ redis: "unavailable", database: "ok" });
	});

	it("should answer 503 when the database is unavailable", async () => {
		const app = await createApp({ moduleManager: emptyManager, healthRouter: databaseDownRouter });
		const response = await request(app).get("/health-check");
		expect(response.status).toEqual(StatusCodes.SERVICE_UNAVAILABLE);
		expect(response.body.responseObject.checks).toEqual({ redis: "ok", database: "unavailable" });
	});
});
