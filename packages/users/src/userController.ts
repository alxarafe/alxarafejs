import { parsePaginationQuery } from "@alxarafe/core";
import type { Request, RequestHandler, Response } from "express";

import { userService } from "./userService.js";

class UserController {
	public getUsers: RequestHandler = async (req: Request, res: Response) => {
		const query = parsePaginationQuery(req.query as Record<string, unknown>);
		const basePath = `${req.baseUrl}${req.path}`;
		const serviceResponse = await userService.findAll(query, basePath);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public getUser: RequestHandler = async (req: Request, res: Response) => {
		const id = Number.parseInt(req.params.id as string, 10);
		const serviceResponse = await userService.findById(id);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public updateUser: RequestHandler = async (req: Request, res: Response) => {
		const id = Number.parseInt(req.params.id as string, 10);
		const serviceResponse = await userService.updateUser(id, req.body);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};
}

export const userController = new UserController();
