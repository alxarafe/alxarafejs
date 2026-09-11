import { authDevRouter, authRegistry, authRouter } from "@alxarafe/auth";
import {
	createModuleManager,
	env,
	errorHandler,
	logger,
	type ModuleManager,
	ModuleManagerError,
	rateLimiter,
	requestLogger,
} from "@alxarafe/core";
import { sessionMiddleware } from "@alxarafe/session";
import { userRegistry, userRouter } from "@alxarafe/users";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import cors from "cors";
import express, { type Express, type Router } from "express";
import helmet from "helmet";

import { healthCheckRegistry, healthCheckRouter } from "./healthCheckRouter.js";
import { generateOpenAPIDocument } from "./openAPIDocumentGenerator.js";
import { createOpenAPIRouter } from "./openAPIRouter.js";

export interface CreateAppOptions {
	/** Injectable manager (tests use a stub); defaults to the real workspace. */
	moduleManager?: ModuleManager;
}

export async function createApp(options: CreateAppOptions = {}): Promise<Express> {
	const app: Express = express();
	const moduleManager = options.moduleManager ?? createModuleManager();

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

	// Infra routes (packages, always mounted)
	app.use("/health-check", healthCheckRouter);
	if (env.isDevelopment) {
		app.use("/auth/dev", authDevRouter);
	}
	app.use("/auth", authRouter);
	app.use("/users", userRouter);

	// Feature modules: loaded dynamically, only those enabled by the manager
	const registries: OpenAPIRegistry[] = [healthCheckRegistry, authRegistry, userRegistry];
	for (const mod of moduleManager.getEnabledFeatureModules()) {
		const serverBlock = mod.server;
		if (!serverBlock) continue;

		logger.info({ module: mod.name, mountPath: serverBlock.mountPath }, "Mounting module");
		const entry = (await import(`@alxarafe/${mod.name}`)) as Record<string, unknown>;
		const router = entry[serverBlock.routerExport ?? "router"];
		if (router == null) {
			throw new ModuleManagerError(
				"MODULE_ENTRY_INVALID",
				`El módulo "${mod.name}" no exporta "${serverBlock.routerExport ?? "router"}". Revisa su module.json o su index.ts.`,
				{ module: mod.name },
			);
		}
		app.use(serverBlock.mountPath, router as Router);

		if (serverBlock.registryExport) {
			const registry = entry[serverBlock.registryExport];
			if (registry) registries.push(registry as OpenAPIRegistry);
		}
	}

	// OpenAPI (document assembled after modules are loaded)
	app.use(createOpenAPIRouter(generateOpenAPIDocument(registries)));

	// Error handlers
	app.use(errorHandler());

	return app;
}
