import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
	process.env.DATABASE_URL ?? "postgresql://alxarafe:alxarafe@localhost:5433/alxarafejs?schema=public";

export default defineConfig({
	schema: "packages/database/prisma",
	migrations: {
		path: "packages/database/prisma/migrations",
	},
	datasource: {
		url: databaseUrl,
	},
});
