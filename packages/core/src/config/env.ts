import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("production"),

	HOST: z.string().min(1).default("localhost"),

	PORT: z.coerce.number().int().positive().default(8080),

	CORS_ORIGIN: z.string().url().default("http://localhost:8080"),

	COMMON_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),

	COMMON_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),

	DATABASE_URL: z
		.string()
		.url()
		.refine((url) => url.startsWith("postgres"), "DATABASE_URL must be a PostgreSQL connection string")
		.default("postgresql://alxarafe:alxarafe@localhost:5433/alxarafejs?schema=public"),

	REDIS_URL: z.string().url().default("redis://localhost:6379"),

	SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters").default("dev-secret-change-me!"),
	SESSION_NAME: z.string().min(1).default("sid"),
	SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

	SMTP_HOST: z.string().default(""),
	SMTP_PORT: z.coerce.number().int().positive().default(587),
	SMTP_USER: z.string().default(""),
	SMTP_PASS: z.string().default(""),
	EMAIL_FROM: z.string().email().default("no-reply@alxarafe.com"),

	EMAILS_DIR: z.string().default(""),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("❌ Invalid environment variables:", parsedEnv.error.format());
	throw new Error("Invalid environment variables");
}

export const env = {
	...parsedEnv.data,
	isDevelopment: parsedEnv.data.NODE_ENV === "development",
	isProduction: parsedEnv.data.NODE_ENV === "production",
	isTest: parsedEnv.data.NODE_ENV === "test",
};
