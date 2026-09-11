import { env, generateCsrfToken } from "@alxarafe/core";
import type { Request, RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { authService } from "./authService.js";

async function establishSession(req: Request, userId: number): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		req.session.regenerate((err) => {
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
	req.session.userId = userId;
	req.session.csrfToken = generateCsrfToken();
}

class AuthController {
	public register: RequestHandler = async (req: Request, res: Response) => {
		const { name, email, password } = req.body;
		const serviceResponse = await authService.register(name, email, password);

		if (serviceResponse.success && serviceResponse.responseObject) {
			try {
				await establishSession(req, serviceResponse.responseObject.id);
				res.status(serviceResponse.statusCode).send({
					success: true,
					message: serviceResponse.message,
					responseObject: {
						user: serviceResponse.responseObject,
						csrfToken: req.session.csrfToken,
					},
					statusCode: serviceResponse.statusCode,
				});
				return;
			} catch (_error) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
					success: false,
					message: "Failed to start session",
					responseObject: null,
					statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
				});
				return;
			}
		}

		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public login: RequestHandler = async (req: Request, res: Response) => {
		const { email, password } = req.body;
		const serviceResponse = await authService.login(email, password);

		if (serviceResponse.success && serviceResponse.responseObject) {
			try {
				await establishSession(req, serviceResponse.responseObject.id);
				res.status(serviceResponse.statusCode).send({
					success: true,
					message: serviceResponse.message,
					responseObject: {
						user: serviceResponse.responseObject,
						csrfToken: req.session.csrfToken,
					},
					statusCode: serviceResponse.statusCode,
				});
				return;
			} catch (_error) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
					success: false,
					message: "Failed to start session",
					responseObject: null,
					statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
				});
				return;
			}
		}

		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public logout: RequestHandler = (req: Request, res: Response) => {
		req.session.destroy((err) => {
			if (err) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
					success: false,
					message: "Failed to log out",
					responseObject: null,
					statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
				});
				return;
			}
			res.clearCookie(env.SESSION_NAME);
			res.status(StatusCodes.OK).send({
				success: true,
				message: "Logged out successfully",
				responseObject: null,
				statusCode: StatusCodes.OK,
			});
		});
	};

	public me: RequestHandler = (req: Request, res: Response) => {
		res.status(StatusCodes.OK).send({
			success: true,
			message: "Current user",
			responseObject: req.user,
			statusCode: StatusCodes.OK,
		});
	};

	public verifyEmail: RequestHandler = async (req: Request, res: Response) => {
		const serviceResponse = await authService.verifyEmail(req.body.token);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public resendVerification: RequestHandler = async (req: Request, res: Response) => {
		if (!req.user) {
			res.status(StatusCodes.UNAUTHORIZED).send({
				success: false,
				message: "Not authenticated",
				responseObject: null,
				statusCode: StatusCodes.UNAUTHORIZED,
			});
			return;
		}
		const serviceResponse = await authService.resendVerification(req.user.id);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public forgotPassword: RequestHandler = async (req: Request, res: Response) => {
		const serviceResponse = await authService.forgotPassword(req.body.email);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public resetPassword: RequestHandler = async (req: Request, res: Response) => {
		const serviceResponse = await authService.resetPassword(req.body.token, req.body.password);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public getCsrfToken: RequestHandler = (req: Request, res: Response) => {
		if (!req.session.csrfToken) {
			req.session.csrfToken = generateCsrfToken();
		}
		res.status(StatusCodes.OK).send({
			success: true,
			message: "CSRF token",
			responseObject: { csrfToken: req.session.csrfToken },
			statusCode: StatusCodes.OK,
		});
	};
}

export const authController = new AuthController();
