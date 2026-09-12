import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const baseSchema = z.object({
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
	SMTP_TRANSPORT: z.enum(["smtp", "disk"]).default("smtp"),
	EMAIL_FROM: z.string().email().default("no-reply@alxarafe.com"),

	PUBLIC_WEB_URL: z.string().trim().url().default("http://localhost:8080"),
	TRUST_PROXY: z.string().default("false"),

	EMAILS_DIR: z.string().default(""),
});

// Production fails safe: the safe defaults above are dev conveniences and are
// not accepted without an explicit value in production.
const productionSchema = baseSchema
	.extend({
		NODE_ENV: z.literal("production"),
		SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters in production"),
		SMTP_HOST: z.string(),
		SMTP_TRANSPORT: z.enum(["smtp", "disk"]),
		PUBLIC_WEB_URL: z.string().trim().url(),
		TRUST_PROXY: z.string().min(1, "TRUST_PROXY must be set explicitly in production"),
	})
	.superRefine((data, ctx) => {
		if (data.SMTP_TRANSPORT === "smtp" && data.SMTP_HOST === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "SMTP_HOST is required in production unless SMTP_TRANSPORT=disk is set explicitly",
				path: ["SMTP_HOST"],
			});
		}
	});

export type Env = z.infer<typeof baseSchema> & {
	isDevelopment: boolean;
	isProduction: boolean;
	isTest: boolean;
};

export function resolveEnv(raw: Record<string, unknown> = process.env): Env {
	// A missing NODE_ENV fails safe as production: production is the only safe default.
	const isProduction = (raw.NODE_ENV ?? "production") === "production";
	const schema = isProduction ? productionSchema : baseSchema;

	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		console.error("❌ Invalid environment variables:", parsed.error.format());
		throw new Error("Invalid environment variables");
	}

	return {
		...parsed.data,
		isDevelopment: parsed.data.NODE_ENV === "development",
		isProduction: parsed.data.NODE_ENV === "production",
		isTest: parsed.data.NODE_ENV === "test",
	};
}

export const env = resolveEnv();
