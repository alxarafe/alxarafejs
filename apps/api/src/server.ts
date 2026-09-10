import { authDevRouter, authRouter } from "@alxarafe/auth";
import { env, errorHandler, logger, rateLimiter, requestLogger } from "@alxarafe/core";
import { sessionMiddleware } from "@alxarafe/session";
import { userRouter } from "@alxarafe/users";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { healthCheckRouter } from "./healthCheckRouter";
import { openAPIRouter } from "./openAPIRouter";

const app: Express = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Session (Redis-backed)
app.use(sessionMiddleware);

// Routes
app.use("/health-check", healthCheckRouter);
// Dev-only helpers (email token retrieval for API testing). Never mounted in production.
if (env.isDevelopment) {
	app.use("/auth/dev", authDevRouter);
}
app.use("/auth", authRouter);
app.use("/users", userRouter);

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
