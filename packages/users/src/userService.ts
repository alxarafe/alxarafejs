import { logger, ServiceResponse } from "@alxarafe/core";
import type { User as PrismaUser } from "@alxarafe/database";
import { StatusCodes } from "http-status-codes";

import type { User } from "./userModel";
import { UserRepository } from "./userRepository";

export function toPublicUser(user: PrismaUser): User {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		emailVerifiedAt: user.emailVerifiedAt,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}

export class UserService {
	private userRepository: UserRepository;

	constructor(repository: UserRepository = new UserRepository()) {
		this.userRepository = repository;
	}

	// Retrieves all users from the database
	async findAll(): Promise<ServiceResponse<User[] | null>> {
		try {
			const users = await this.userRepository.findAllAsync();
			if (!users || users.length === 0) {
				return ServiceResponse.failure("No Users found", null, StatusCodes.NOT_FOUND);
			}
			return ServiceResponse.success<User[]>("Users found", users.map(toPublicUser));
		} catch (ex) {
			const errorMessage = `Error finding all users: ${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure(
				"An error occurred while retrieving users.",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	// Retrieves a single user by their ID
	async findById(id: number): Promise<ServiceResponse<User | null>> {
		try {
			const user = await this.userRepository.findByIdAsync(id);
			if (!user) {
				return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
			}
			return ServiceResponse.success<User>("User found", toPublicUser(user));
		} catch (ex) {
			const errorMessage = `Error finding user with id ${id}:, ${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure("An error occurred while finding user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}
}

export const userService = new UserService();
