import { env, logger } from "@alxarafe/core";
import { prisma } from "@alxarafe/database";
import { redisClient } from "@alxarafe/session";

import { createApp } from "./app.js";

const REDIS_CONNECT_TIMEOUT_MS = 5000;
const SHUTDOWN_FORCE_TIMEOUT_MS = 10000;
const SHUTDOWN_CONNECTIONS_GRACE_MS = 5000;

const app = await createApp();

// Swallow and log every Redis error: an 'error' emission without listeners
// would crash the process on reconnect failures.
redisClient.on("error", (error) => logger.error({ error: error.message }, "Redis error"));

async function connectRedis(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Redis connection timed out after ${REDIS_CONNECT_TIMEOUT_MS}ms`)),
			REDIS_CONNECT_TIMEOUT_MS,
		);
		redisClient.once("ready", () => {
			clearTimeout(timer);
			resolve();
		});
		redisClient.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		redisClient.connect();
	});
}

async function waitForRedis() {
	try {
		await connectRedis();
		logger.info("Redis connected");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (env.isProduction) {
			logger.error({ error: message }, "Redis unavailable in production; exiting");
			process.exit(1);
		}
		logger.error({ error: message }, "Redis unavailable in development; the server will not store sessions");
	}
}

await waitForRedis();

const server = app.listen(env.PORT, () => {
	const { NODE_ENV, HOST, PORT } = env;
	logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

const gracefulServerClose = (): Promise<void> =>
	new Promise<void>((resolve) => {
		server.close(() => resolve());
		// Release the keep-alive sockets that would otherwise keep `close()`
		// waiting: idle connections right away, the rest after a short grace.
		server.closeIdleConnections();
		setTimeout(() => server.closeAllConnections(), SHUTDOWN_CONNECTIONS_GRACE_MS).unref();
	});

const onCloseSignal = async () => {
	logger.info("shutting down");
	const forceExitTimer = setTimeout(() => {
		logger.error("Graceful shutdown timed out; forcing exit");
		process.exit(1);
	}, SHUTDOWN_FORCE_TIMEOUT_MS);
	forceExitTimer.unref(); // It must not keep the process alive on its own.

	try {
		await gracefulServerClose();
		clearTimeout(forceExitTimer);
		logger.info("server closed");
		if (redisClient.isReady) {
			await redisClient.quit();
		}
		await prisma.$disconnect();
		process.exit(0);
	} catch (error) {
		logger.error({ error }, "Error during shutdown");
		process.exit(1);
	}
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
