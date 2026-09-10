import { createHash, randomBytes } from "node:crypto";

export function generateToken(bytes = 32): string {
	return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function generateCsrfToken(): string {
	return randomBytes(24).toString("base64url");
}
