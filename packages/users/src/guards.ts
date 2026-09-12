import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

import "@alxarafe/session";

import type { UserRole } from "./userModel.js";
import { userService } from "./userService.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
	const userId = req.session.userId;
	if (!userId) {
		res.status(StatusCodes.UNAUTHORIZED).send({
			success: false,
			message: "Not authenticated",
			responseObject: null,
			statusCode: StatusCodes.UNAUTHORIZED,
		});
		return;
	}

	try {
		const serviceResponse = await userService.findById(userId);
		if (!serviceResponse.success || !serviceResponse.responseObject) {
			res.status(StatusCodes.UNAUTHORIZED).send({
				success: false,
				message: "Session is no longer valid",
				responseObject: null,
				statusCode: StatusCodes.UNAUTHORIZED,
			});
			return;
		}
		req.user = serviceResponse.responseObject;
		next();
	} catch {
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
			success: false,
			message: "An error occurred while authenticating",
			responseObject: null,
			statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
		});
	}
};

export function requireRole(...roles: UserRole[]): RequestHandler {
	return (req, res, next) => {
		if (!req.user) {
			res.status(StatusCodes.UNAUTHORIZED).send({
				success: false,
				message: "Not authenticated",
				responseObject: null,
				statusCode: StatusCodes.UNAUTHORIZED,
			});
			return;
		}
		if (!roles.includes(req.user.role)) {
			res.status(StatusCodes.FORBIDDEN).send({
				success: false,
				message: "Insufficient permissions",
				responseObject: null,
				statusCode: StatusCodes.FORBIDDEN,
			});
			return;
		}
		next();
	};
}

export const requireSameUserOrAdmin: RequestHandler = (req, res, next) => {
	if (!req.user) {
		res.status(StatusCodes.UNAUTHORIZED).send({
			success: false,
			message: "Not authenticated",
			responseObject: null,
			statusCode: StatusCodes.UNAUTHORIZED,
		});
		return;
	}
	const { id: userId, role } = req.user;
	const targetId = Number.parseInt(String(req.params.id), 10);
	if (role === "ADMIN" || userId === targetId) {
		next();
		return;
	}
	res.status(StatusCodes.FORBIDDEN).send({
		success: false,
		message: "Insufficient permissions",
		responseObject: null,
		statusCode: StatusCodes.FORBIDDEN,
	});
};
