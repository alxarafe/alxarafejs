import { z } from "zod";

export const commonValidations = {
	id: z
		.string()
		.refine((data) => !Number.isNaN(Number(data)), "ID must be a numeric value")
		.transform(Number)
		.refine((num) => num > 0, "ID must be a positive number"),
	email: z.string().trim().email(),
	password: z.string().min(8, "Password must be at least 8 characters").max(128),
};
