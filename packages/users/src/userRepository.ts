import { type Prisma, prisma, type User } from "@alxarafe/database";

export class UserRepository {
	async findAllAsync(): Promise<User[]> {
		return prisma.user.findMany();
	}

	async findByIdAsync(id: number): Promise<User | null> {
		return prisma.user.findUnique({ where: { id } });
	}

	async findByEmailAsync(email: string): Promise<User | null> {
		return prisma.user.findUnique({ where: { email } });
	}

	async createAsync(data: Prisma.UserCreateInput): Promise<User> {
		return prisma.user.create({ data });
	}

	async updateAsync(id: number, data: Prisma.UserUpdateInput): Promise<User> {
		return prisma.user.update({ where: { id }, data });
	}

	async deleteAsync(id: number): Promise<void> {
		await prisma.user.delete({ where: { id } });
	}
}
