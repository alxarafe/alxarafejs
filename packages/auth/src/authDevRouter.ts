import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@alxarafe/core";
import type { Request, RequestHandler, Response } from "express";
import express, { type Router } from "express";
import { StatusCodes } from "http-status-codes";

type EmailPurpose = "verify" | "reset";

const EMAILS_DIR = path.join(process.cwd(), "emails");

function decodeQuotedPrintable(input: string): string {
	return input
		.replace(/=\r?\n/g, "") // RFC 2045 soft line breaks
		.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractToken(decodedEmail: string, subject: string): { token?: string; filename?: string } {
	if (!decodedEmail.includes(subject)) {
		return {};
	}
	const links = decodedEmail.match(/https?:\/\/[^\s]+/g);
	if (!links) {
		return {};
	}
	const link = links[links.length - 1];
	const token = link.split(/[?&]token=/)[1]?.split(/[&#]|$/, 1)[0];
	return token ? { token } : {};
}

async function findLatestToken(
	email: string,
	purpose: EmailPurpose,
): Promise<{ token: string; filename: string } | null> {
	const expectedSubject = purpose === "verify" ? "Verify your email address" : "Reset your password";

	let files: string[];
	try {
		files = await readdir(EMAILS_DIR);
	} catch {
		return null;
	}

	const candidates: { token: string; filename: string; date: number }[] = [];
	for (const filename of files) {
		if (!filename.endsWith(".eml")) {
			continue;
		}
		const filePath = path.join(EMAILS_DIR, filename);
		const raw = await readFile(filePath, "utf8").catch(() => "");
		if (!raw) {
			continue;
		}
		const headers = raw.replace(/\r\n/g, "\n").split("\n\n")[0];
		if (
			!headers.toLowerCase().includes(`to:${email.toLowerCase()}`) &&
			!headers.toLowerCase().includes(`to: ${email.toLowerCase()}`)
		) {
			continue;
		}
		const decoded = decodeQuotedPrintable(raw);
		const { token } = extractToken(decoded, expectedSubject);
		if (!token) {
			continue;
		}
		const dateMatch = raw.match(/^Date:\s*(.+)$/m);
		const date = dateMatch ? Date.parse(dateMatch[1]) : 0;
		candidates.push({ token, filename, date });
	}

	if (candidates.length === 0) {
		return null;
	}
	candidates.sort((a, b) => b.date - a.date);
	return { token: candidates[0].token, filename: candidates[0].filename };
}

class AuthDevController {
	public getEmailToken: RequestHandler = async (req: Request, res: Response) => {
		if (!env.isDevelopment) {
			res.status(StatusCodes.NOT_FOUND).send({ success: false, message: "Not found" });
			return;
		}

		const email = (req.query.email as string | undefined)?.toLowerCase() ?? "";
		const purpose = (req.query.purpose as EmailPurpose | undefined) ?? "verify";
		if (!email?.includes("@") || (purpose !== "verify" && purpose !== "reset")) {
			res.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				message: "Valid email and purpose (verify|reset) are required",
				responseObject: null,
				statusCode: StatusCodes.BAD_REQUEST,
			});
			return;
		}

		const match = await findLatestToken(email, purpose);
		if (!match) {
			res.status(StatusCodes.NOT_FOUND).send({
				success: false,
				message: `No ${purpose} email found for ${email} in ${EMAILS_DIR}`,
				responseObject: null,
				statusCode: StatusCodes.NOT_FOUND,
			});
			return;
		}

		res.status(StatusCodes.OK).send({
			success: true,
			message: `${purpose} token found`,
			responseObject: { token: match.token, email, purpose, filename: match.filename },
			statusCode: StatusCodes.OK,
		});
	};
}

const authDevController = new AuthDevController();

export const authDevRouter: Router = express.Router();

authDevRouter.get("/email-tokens", authDevController.getEmailToken);
