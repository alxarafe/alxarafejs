import express, { type Request, type Response, type Router } from "express";
import swaggerUi from "swagger-ui-express";

import type { OpenAPIDocument } from "./openAPIDocumentGenerator.js";

export function createOpenAPIRouter(openAPIDocument: OpenAPIDocument): Router {
	const router: Router = express.Router();

	router.get("/swagger.json", (_req: Request, res: Response) => {
		res.setHeader("Content-Type", "application/json");
		res.send(openAPIDocument);
	});

	router.use("/", swaggerUi.serve, swaggerUi.setup(openAPIDocument));
	return router;
}
