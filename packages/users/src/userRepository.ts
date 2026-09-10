import { type Prisma, prisma, type User } from "@alxarafe/database";

export interface UserListParams {
	where?: Prisma.UserWhereInput;
	orderBy?: Prisma.UserOrderByWithRelationInput[];
	skip?: number;
	take?: number;
}

export class UserRepository {
	async findAllAsync(params?: UserListParams): Promise<User[]> {
		if (!params) {
			return prisma.user.findMany();
		}
		const { where, orderBy, skip, take } = params;
		return prisma.user.findMany({ skip, take, where, orderBy });
	}

	async countAsync(where?: Prisma.UserWhereInput): Promise<number> {
		return prisma.user.count({ where });
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
