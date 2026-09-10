import { env } from "@alxarafe/core";
import { RedisStore } from "connect-redis";
import type { RequestHandler } from "express";
import session from "express-session";
import { createClient } from "redis";

export const redisClient = createClient({ url: env.REDIS_URL });

export const redisStore = new RedisStore({ client: redisClient });

export const sessionMiddleware: RequestHandler = session({
	store: redisStore,
	name: env.SESSION_NAME,
	secret: env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	rolling: true,
	cookie: {
		httpOnly: true,
		secure: env.isProduction,
		sameSite: "lax",
		maxAge: env.SESSION_TTL_SECONDS * 1000,
	},
});
