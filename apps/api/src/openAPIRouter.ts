import express, { type Request, type Response, type Router } from "express";
import swaggerUi from "swagger-ui-express";

import type { OpenAPIDocument } from "./openAPIDocumentGenerator.js";

export function createOpenAPIRouter(openAPIDocument: OpenAPIDocument): Router {
	const router: Router = express.Router();

	router.get("/swagger.json", (_req: Request, res: Response) => {
		res.setHeader("Content-Type", "application/json");
		res.send(openAPIDocument);
	});

	// Confined to a dedicated prefix: `serve`+`setup` answered every request
	// when mounted on "/", shadowing unknown routes with the Swagger UI
	// (200 HTML instead of the 404 envelope). Under "/swagger" Express strips
	// the mount path and the middleware only serves the UI and its own assets.
	router.use("/swagger", swaggerUi.serve, swaggerUi.setup(openAPIDocument));
	return router;
}
