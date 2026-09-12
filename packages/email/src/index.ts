import fs from "node:fs";
import path from "node:path";
import { env, logger } from "@alxarafe/core";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

export type SendMailOptions = {
	to: string;
	subject: string;
	text: string;
	html?: string;
};

const DEV_MAIL_DIR = path.join(process.cwd(), "emails");

function createDevTransport(): Transporter {
	// Writes the raw EML message to ./emails so it can be inspected without an SMTP server.
	return nodemailer.createTransport({
		name: "dev-file-transport",
		version: "1.0.0",
		send(mail, callback) {
			const message = mail.message;
			if (!message) {
				callback(new Error("No message available"));
				return;
			}

			const chunks: Buffer[] = [];
			message
				.createReadStream()
				.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
				.on("end", () => {
					try {
						fs.mkdirSync(DEV_MAIL_DIR, { recursive: true });
						const messageId = message.messageId();
						const filename = `${messageId}.eml`;
						fs.writeFileSync(path.join(DEV_MAIL_DIR, filename), Buffer.concat(chunks));
						callback(null, { messageId, envelope: message.getEnvelope(), path: path.join(DEV_MAIL_DIR, filename) });
					} catch (error) {
						callback(error as Error);
					}
				})
				.on("error", (error) => callback(error as Error));
		},
	});
}

function createSmtpTransport(): Transporter {
	return nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_PORT === 465,
		auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
	});
}

let cachedTransport: Transporter | undefined;

function getTransport(): Transporter {
	if (!cachedTransport) {
		cachedTransport = env.SMTP_TRANSPORT === "disk" || !env.SMTP_HOST ? createDevTransport() : createSmtpTransport();
	}
	return cachedTransport;
}

export async function sendEmail(options: SendMailOptions): Promise<void> {
	const mailOptions = {
		from: env.EMAIL_FROM,
		to: options.to,
		subject: options.subject,
		text: options.text,
		html: options.html,
	};

	const info = await getTransport().sendMail(mailOptions);

	if (env.SMTP_TRANSPORT === "smtp" && env.SMTP_HOST) {
		logger.info({ messageId: info.messageId }, `Email sent to ${options.to}`);
	} else {
		logger.info(
			`[${env.SMTP_TRANSPORT === "disk" ? "DISK" : "DEV"} MAIL] ${options.subject} -> ${options.to} (written to ${info.path ?? "dev transport"})`,
		);
	}
}

export function getDevMailDir(): string {
	return DEV_MAIL_DIR;
}
