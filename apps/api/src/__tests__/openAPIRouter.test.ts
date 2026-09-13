import { errorHandler } from "@alxarafe/core";
import express from "express";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { OpenAPIDocument } from "../openAPIDocumentGenerator.js";
import { createOpenAPIRouter } from "../openAPIRouter.js";

const document: OpenAPIDocument = {
	openapi: "3.0.0",
	info: { title: "test", version: "1.0.0" },
	paths: {},
};

const buildApp = () => {
	const app = express();
	app.use(createOpenAPIRouter(document));
	app.use(errorHandler());
	return app;
};

describe("OpenAPI router", () => {
	it("serves the Swagger UI only under /swagger (301 → /swagger/)", async () => {
		const app = buildApp();
		const canonical = await request(app).get("/swagger").redirects(1);
		expect(canonical.status).toEqual(StatusCodes.OK);
		expect(canonical.headers["content-type"]).toContain("text/html");

		const trailing = await request(app).get("/swagger/");
		expect(trailing.status).toEqual(StatusCodes.OK);
		expect(trailing.headers["content-type"]).toContain("text/html");
	});

	it("serves the UI assets under the /swagger prefix", async () => {
		const response = await request(buildApp()).get("/swagger/swagger-ui.css");
		expect(response.status).toEqual(StatusCodes.OK);
		expect(response.headers["content-type"]).toContain("text/css");
	});

	it("serves the raw spec at /swagger.json", async () => {
		const response = await request(buildApp()).get("/swagger.json");
		expect(response.status).toEqual(StatusCodes.OK);
		expect(response.headers["content-type"]).toContain("application/json");
		expect(response.body.openapi).toBe("3.0.0");
	});

	it("no longer shadows unknown routes: /missing answers the 404 envelope", async () => {
		const response = await request(buildApp()).get("/missing");
		expect(response.status).toEqual(StatusCodes.NOT_FOUND);
		expect(response.body).toEqual({
			success: false,
			message: "Route not found",
			responseObject: null,
			statusCode: StatusCodes.NOT_FOUND,
		});
	});
});
