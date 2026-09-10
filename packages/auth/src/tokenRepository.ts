import { type EmailVerificationToken, type PasswordResetToken, prisma } from "@alxarafe/database";

type TokenRecordWithUser = EmailVerificationToken & { user: { id: number; email: string } };

export class TokenRepository {
	async createEmailVerificationTokenAsync(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
		await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
	}

	async findEmailVerificationTokenAsync(tokenHash: string): Promise<TokenRecordWithUser | null> {
		return prisma.emailVerificationToken.findUnique({
			where: { tokenHash },
			include: { user: true },
		});
	}

	async markEmailVerificationTokenUsedAsync(id: number): Promise<void> {
		await prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } });
	}

	async deleteEmailVerificationTokensAsync(userId: number): Promise<void> {
		await prisma.emailVerificationToken.deleteMany({ where: { userId } });
	}

	async createPasswordResetTokenAsync(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
		await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
	}

	async findPasswordResetTokenAsync(
		tokenHash: string,
	): Promise<(PasswordResetToken & { user: { id: number } }) | null> {
		return prisma.passwordResetToken.findUnique({
			where: { tokenHash },
			include: { user: true },
		});
	}

	async markPasswordResetTokenUsedAsync(id: number): Promise<void> {
		await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
	}

	async deletePasswordResetTokensAsync(userId: number): Promise<void> {
		await prisma.passwordResetToken.deleteMany({ where: { userId } });
	}
}
