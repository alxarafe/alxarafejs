import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

// Double-submit CSRF protection for session-based auth. The client must
// include the value returned at login/register (or by GET /auth/csrf) in the
// `X-CSRF-Token` header for state-changing requests on an authenticated session.
export const csrfProtection: RequestHandler = (req, res, next) => {
	const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];
	if (!unsafeMethods.includes(req.method)) {
		next();
		return;
	}

	if (!req.session.userId) {
		next();
		return;
	}

	const token = req.headers["x-csrf-token"];
	if (!token || token !== req.session.csrfToken) {
		res.status(StatusCodes.FORBIDDEN).send({
			success: false,
			message: "Invalid CSRF token",
			responseObject: null,
			statusCode: StatusCodes.FORBIDDEN,
		});
		return;
	}

	next();
};
