import { createApiResponse, ServiceResponse } from "@alxarafe/core";
import { prisma } from "@alxarafe/database";
import { redisClient } from "@alxarafe/session";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export const healthCheckRegistry = new OpenAPIRegistry();

/** Probes report whether the API can actually serve traffic, not just boot. */
export type HealthCheckProbe = () => boolean | Promise<boolean>;

export interface HealthCheckOptions {
	isRedisReady?: HealthCheckProbe;
	isDatabaseReady?: HealthCheckProbe;
}

const DB_PROBE_TIMEOUT_MS = 2000;

async function probeDatabase(): Promise<boolean> {
	const timeout = new Promise<never>((_, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`database probe timed out after ${DB_PROBE_TIMEOUT_MS}ms`)),
			DB_PROBE_TIMEOUT_MS,
		);
		timer.unref();
	});
	try {
		await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
		return true;
	} catch {
		return false;
	}
}

const checkStatusSchema = z.enum(["ok", "unavailable"]);
const checksSchema = z.object({
	redis: checkStatusSchema,
	database: checkStatusSchema,
});

healthCheckRegistry.registerPath({
	method: "get",
	path: "/health-check",
	tags: ["Health Check"],
	responses: {
		...createApiResponse(checksSchema, "Service is healthy"),
		...createApiResponse(checksSchema, "A dependency is unavailable", StatusCodes.SERVICE_UNAVAILABLE),
	},
});

export function createHealthCheckRouter(options: HealthCheckOptions = {}): Router {
	const isRedisReady = options.isRedisReady ?? (() => redisClient.isReady);
	const isDatabaseReady = options.isDatabaseReady ?? probeDatabase;

	const router: Router = express.Router();
	router.get("/", async (_req: Request, res: Response) => {
		const [redis, database] = await Promise.all([isRedisReady(), isDatabaseReady()]);
		const responseObject = {
			checks: {
				redis: redis ? "ok" : "unavailable",
				database: database ? "ok" : "unavailable",
			},
		};

		if (redis && database) {
			const serviceResponse = ServiceResponse.success("Service is healthy", responseObject);
			res.status(serviceResponse.statusCode).json(serviceResponse);
			return;
		}

		const serviceResponse = ServiceResponse.failure(
			"Service is not ready",
			responseObject,
			StatusCodes.SERVICE_UNAVAILABLE,
		);
		res.status(serviceResponse.statusCode).json(serviceResponse);
	});
	return router;
}

export const healthCheckRouter = createHealthCheckRouter();
