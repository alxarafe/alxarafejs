import type { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env.js";
import { ServiceResponse } from "../models/serviceResponse.js";

const unexpectedRequest: RequestHandler = (_req, res) => {
	const serviceResponse = ServiceResponse.failure("Route not found", null, StatusCodes.NOT_FOUND);
	res.status(serviceResponse.statusCode).json(serviceResponse);
};

const addErrorToRequestLog: ErrorRequestHandler = (err, _req, res, next) => {
	res.locals.err = err;
	next(err);
};

const getErrorStatusCode = (err: unknown): number => {
	const errStatusCode = (err as { statusCode?: unknown } | null)?.statusCode;
	if (typeof errStatusCode === "number" && errStatusCode >= 400 && errStatusCode <= 599) {
		return errStatusCode;
	}
	return StatusCodes.INTERNAL_SERVER_ERROR;
};

const getErrorMessage = (err: unknown): string => {
	if (err instanceof Error && err.message) return err.message;
	return String(err);
};

const unhandledError: ErrorRequestHandler = (err, _req, res, next) => {
	if (res.headersSent) {
		next(err);
		return;
	}

	const statusCode = getErrorStatusCode(err);
	// Never leak internals to the client in production; the details are
	// already in pino under the request id (`res.locals.err`).
	const message = env.isProduction ? "Internal Server Error" : getErrorMessage(err);
	const serviceResponse = ServiceResponse.failure(message, null, statusCode);
	res.status(serviceResponse.statusCode).json(serviceResponse);
};

export function errorHandler(): [RequestHandler, ErrorRequestHandler, ErrorRequestHandler] {
	return [unexpectedRequest, addErrorToRequestLog, unhandledError];
}
