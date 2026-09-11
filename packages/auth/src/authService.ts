import { env, generateToken, hashToken, logger, ServiceResponse } from "@alxarafe/core";
import { sendEmail } from "@alxarafe/email";
import { toPublicUser, type User, UserRepository } from "@alxarafe/users";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";

import { TokenRepository } from "./tokenRepository.js";

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export const appBaseUrl = `${env.isProduction ? "https" : "http"}://${env.HOST}:${env.PORT}`;

function nowPlus(ms: number): Date {
	return new Date(Date.now() + ms);
}

export class AuthService {
	private userRepository: UserRepository;
	private tokenRepository: TokenRepository;

	constructor(
		userRepository: UserRepository = new UserRepository(),
		tokenRepository: TokenRepository = new TokenRepository(),
	) {
		this.userRepository = userRepository;
		this.tokenRepository = tokenRepository;
	}

	async register(name: string, email: string, password: string): Promise<ServiceResponse<User | null>> {
		try {
			const normalizedEmail = email.toLowerCase();
			const existing = await this.userRepository.findByEmailAsync(normalizedEmail);
			if (existing) {
				return ServiceResponse.failure("An account with this email already exists", null, StatusCodes.CONFLICT);
			}

			const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
			const user = await this.userRepository.createAsync({
				name,
				email: normalizedEmail,
				passwordHash,
			});

			await this.sendVerificationEmail(user.email, user.id);

			return ServiceResponse.success<User>("User registered successfully", toPublicUser(user), StatusCodes.CREATED);
		} catch (ex) {
			logger.error(`Error during registration: ${(ex as Error).message}`);
			return ServiceResponse.failure(
				"An error occurred while registering the user",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	async login(email: string, password: string): Promise<ServiceResponse<User | null>> {
		try {
			const normalizedEmail = email.toLowerCase();
			const user = await this.userRepository.findByEmailAsync(normalizedEmail);
			const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

			if (!user || !passwordMatches) {
				return ServiceResponse.failure("Invalid email or password", null, StatusCodes.UNAUTHORIZED);
			}

			return ServiceResponse.success<User>("Login successful", toPublicUser(user));
		} catch (ex) {
			logger.error(`Error during login: ${(ex as Error).message}`);
			return ServiceResponse.failure("An error occurred while logging in", null, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}

	async verifyEmail(token: string): Promise<ServiceResponse<null>> {
		try {
			const tokenRecord = await this.tokenRepository.findEmailVerificationTokenAsync(hashToken(token));
			if (!tokenRecord || tokenRecord.usedAt) {
				return ServiceResponse.failure("Invalid or expired verification token", null, StatusCodes.BAD_REQUEST);
			}
			if (tokenRecord.expiresAt < new Date()) {
				return ServiceResponse.failure("Verification token has expired", null, StatusCodes.BAD_REQUEST);
			}

			await this.userRepository.updateAsync(tokenRecord.userId, { emailVerifiedAt: new Date() });
			await this.tokenRepository.markEmailVerificationTokenUsedAsync(tokenRecord.id);

			return ServiceResponse.success("Email verified successfully", null);
		} catch (ex) {
			logger.error(`Error verifying email: ${(ex as Error).message}`);
			return ServiceResponse.failure(
				"An error occurred while verifying the email",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	async resendVerification(userId: number): Promise<ServiceResponse<null>> {
		try {
			const user = await this.userRepository.findByIdAsync(userId);
			if (!user) {
				return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
			}
			if (user.emailVerifiedAt) {
				return ServiceResponse.failure("Email has already been verified", null, StatusCodes.BAD_REQUEST);
			}

			await this.tokenRepository.deleteEmailVerificationTokensAsync(user.id);
			await this.sendVerificationEmail(user.email, user.id);

			return ServiceResponse.success("Verification email sent", null);
		} catch (ex) {
			logger.error(`Error resending verification email: ${(ex as Error).message}`);
			return ServiceResponse.failure(
				"An error occurred while resending the email",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	async forgotPassword(email: string): Promise<ServiceResponse<null>> {
		try {
			const user = await this.userRepository.findByEmailAsync(email.toLowerCase());
			// Respond identically regardless of whether the user exists to avoid user enumeration.
			if (!user) {
				return ServiceResponse.success("If an account exists for that email, a reset link has been sent", null);
			}

			await this.tokenRepository.deletePasswordResetTokensAsync(user.id);
			const token = generateToken();
			await this.tokenRepository.createPasswordResetTokenAsync(
				user.id,
				hashToken(token),
				nowPlus(PASSWORD_RESET_TTL_MS),
			);

			const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				text: `You requested a password reset. Open the following link to choose a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
			});

			return ServiceResponse.success("If an account exists for that email, a reset link has been sent", null);
		} catch (ex) {
			logger.error(`Error sending password reset email: ${(ex as Error).message}`);
			return ServiceResponse.failure(
				"An error occurred while processing your request",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	async resetPassword(token: string, newPassword: string): Promise<ServiceResponse<null>> {
		try {
			const tokenRecord = await this.tokenRepository.findPasswordResetTokenAsync(hashToken(token));
			if (!tokenRecord || tokenRecord.usedAt) {
				return ServiceResponse.failure("Invalid or expired reset token", null, StatusCodes.BAD_REQUEST);
			}
			if (tokenRecord.expiresAt < new Date()) {
				return ServiceResponse.failure("Reset token has expired", null, StatusCodes.BAD_REQUEST);
			}

			const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
			await this.userRepository.updateAsync(tokenRecord.userId, { passwordHash });
			await this.tokenRepository.markPasswordResetTokenUsedAsync(tokenRecord.id);

			return ServiceResponse.success("Password reset successfully", null);
		} catch (ex) {
			logger.error(`Error resetting password: ${(ex as Error).message}`);
			return ServiceResponse.failure(
				"An error occurred while resetting the password",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	private async sendVerificationEmail(email: string, userId: number): Promise<void> {
		const token = generateToken();
		await this.tokenRepository.createEmailVerificationTokenAsync(
			userId,
			hashToken(token),
			nowPlus(EMAIL_VERIFICATION_TTL_MS),
		);
		const verifyUrl = `${appBaseUrl}/verify-email?token=${token}`;
		await sendEmail({
			to: email,
			subject: "Verify your email address",
			text: `Welcome! Please verify your email address by opening the following link (valid for 24 hours):\n\n${verifyUrl}\n\nIf you did not create an account, you can safely ignore this email.`,
		});
	}
}

export const authService = new AuthService();
