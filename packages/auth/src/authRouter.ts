import { createApiResponse, validateRequest } from "@alxarafe/core";
import { requireAuth, UserSchema } from "@alxarafe/users";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { authController } from "./authController.js";
import {
	ForgotPasswordSchema,
	LoginSchema,
	RegisterSchema,
	ResetPasswordSchema,
	VerifyEmailSchema,
} from "./authModel.js";

export const authRegistry = new OpenAPIRegistry();
export const authRouter: Router = express.Router();

const AuthSessionSchema = z.object({
	user: UserSchema,
	csrfToken: z.string(),
});

authRegistry.register("User", UserSchema);
authRegistry.registerPath({
	method: "post",
	path: "/auth/register",
	tags: ["Auth"],
	request: { body: { content: { "application/json": { schema: RegisterSchema.shape.body } } } },
	responses: createApiResponse(AuthSessionSchema, "Registration successful", 201),
});

authRegistry.registerPath({
	method: "post",
	path: "/auth/login",
	tags: ["Auth"],
	request: { body: { content: { "application/json": { schema: LoginSchema.shape.body } } } },
	responses: createApiResponse(AuthSessionSchema, "Login successful"),
});

authRegistry.registerPath({
	method: "post",
	path: "/auth/logout",
	tags: ["Auth"],
	responses: createApiResponse(z.null(), "Logout successful"),
});

authRegistry.registerPath({
	method: "get",
	path: "/auth/me",
	tags: ["Auth"],
	responses: createApiResponse(UserSchema, "Current user"),
});

authRegistry.registerPath({
	method: "get",
	path: "/auth/csrf",
	tags: ["Auth"],
	responses: createApiResponse(z.object({ csrfToken: z.string() }), "CSRF token"),
});

authRegistry.registerPath({
	method: "post",
	path: "/auth/verify-email",
	tags: ["Auth"],
	request: { body: { content: { "application/json": { schema: VerifyEmailSchema.shape.body } } } },
	responses: createApiResponse(z.null(), "Email verified"),
});

authRegistry.registerPath({
	method: "post",
	path: "/auth/resend-verification",
	tags: ["Auth"],
	responses: createApiResponse(z.null(), "Verification email sent"),
});

authRegistry.registerPath({
	method: "post",
	path: "/auth/forgot-password",
	tags: ["Auth"],
	request: { body: { content: { "application/json": { schema: ForgotPasswordSchema.shape.body } } } },
	responses: createApiResponse(z.null(), "Reset link sent"),
});

authRegistry.registerPath({
	method: "post",
	path: "/auth/reset-password",
	tags: ["Auth"],
	request: { body: { content: { "application/json": { schema: ResetPasswordSchema.shape.body } } } },
	responses: createApiResponse(z.null(), "Password reset"),
});

// CSRF is enforced app-wide in apps/api (security:csrfProtection), not here.

authRouter.post("/register", validateRequest(RegisterSchema), authController.register);
authRouter.post("/login", validateRequest(LoginSchema), authController.login);
authRouter.get("/csrf", authController.getCsrfToken);
authRouter.post("/verify-email", validateRequest(VerifyEmailSchema), authController.verifyEmail);
authRouter.post("/forgot-password", validateRequest(ForgotPasswordSchema), authController.forgotPassword);
authRouter.post("/reset-password", validateRequest(ResetPasswordSchema), authController.resetPassword);

authRouter.post("/logout", requireAuth, authController.logout);
authRouter.post("/resend-verification", requireAuth, authController.resendVerification);
authRouter.get("/me", requireAuth, authController.me);
