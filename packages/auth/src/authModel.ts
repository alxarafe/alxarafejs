import { commonValidations } from "@alxarafe/core";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const RegisterSchema = z.object({
	body: z.object({
		name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
		email: commonValidations.email,
		password: commonValidations.password,
	}),
});

export const LoginSchema = z.object({
	body: z.object({
		email: commonValidations.email,
		password: z.string().min(1, "Password is required"),
	}),
});

export const VerifyEmailSchema = z.object({
	body: z.object({
		token: z.string().min(1, "Token is required"),
	}),
});

export const ForgotPasswordSchema = z.object({
	body: z.object({
		email: commonValidations.email,
	}),
});

export const ResetPasswordSchema = z.object({
	body: z.object({
		token: z.string().min(1, "Token is required"),
		password: commonValidations.password,
	}),
});
