import { env, logger } from "@alxarafe/core";
import { prisma } from "@alxarafe/database";
import { redisClient } from "@alxarafe/session";

import { createApp } from "./app.js";

const app = await createApp();

redisClient.on("error", (error) => logger.error({ error: error.message }, "Redis error"));
redisClient.connect().then(() => {
	logger.info("Redis connected");
});

const server = app.listen(env.PORT, () => {
	const { NODE_ENV, HOST, PORT } = env;
	logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

const onCloseSignal = async () => {
	logger.info("sigint received, shutting down");
	server.close(async () => {
		logger.info("server closed");
		if (redisClient.isReady) {
			await redisClient.quit();
		}
		await prisma.$disconnect();
		process.exit();
	});
	setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
