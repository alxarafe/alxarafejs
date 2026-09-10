import type { FilterNode, FilterValue, PaginatedList, PaginationQuery } from "@alxarafe/core";
import { buildPaginationMeta, logger, parseFilter, ServiceResponse } from "@alxarafe/core";
import type { Prisma, User as PrismaUser } from "@alxarafe/database";
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

const FILTERABLE_FIELDS = ["id", "email", "name", "role", "emailVerifiedAt", "createdAt", "updatedAt"] as const;
type FilterableField = (typeof FILTERABLE_FIELDS)[number];

function coerceFilterValue(field: FilterableField, value: FilterValue): unknown {
	if (value === null) {
		return null;
	}
	if (field === "id") {
		return Number(value);
	}
	if (field === "createdAt" || field === "updatedAt" || field === "emailVerifiedAt") {
		return new Date(String(value));
	}
	return value;
}

function conditionToWhere(condition: { field: string; operator: string; value: FilterValue }): Prisma.UserWhereInput {
	const field = condition.field as FilterableField;
	const value = coerceFilterValue(field, condition.value);

	switch (condition.operator) {
		case "eq":
			if (value === null) {
				return { [field]: null };
			}
			return { [field]: value };
		case "ne":
			if (value === null) {
				return { [field]: { not: null } };
			}
			return { [field]: { not: value } };
		case "gt":
			return { [field]: { gt: value } };
		case "ge":
			return { [field]: { gte: value } };
		case "lt":
			return { [field]: { lt: value } };
		case "le":
			return { [field]: { lte: value } };
		case "contains":
			return { [field]: { contains: value } };
		case "startswith":
			return { [field]: { startsWith: value } };
		case "endswith":
			return { [field]: { endsWith: value } };
		default:
			return {};
	}
}

function filterToWhere(node: FilterNode): Prisma.UserWhereInput {
	if (node.type === "group") {
		const children = node.children.map(filterToWhere);
		if (children.length === 1) {
			return children[0];
		}
		return node.logic === "and" ? { AND: children } : { OR: children };
	}

	const { field, operator, value } = node;
	if (!FILTERABLE_FIELDS.includes(field as FilterableField)) {
		throw new Error(`Invalid $filter: field "${field}" is not filterable`);
	}
	return conditionToWhere({ field, operator, value });
}

function orderByToPrisma(orderBy: string): Prisma.UserOrderByWithRelationInput[] {
	return orderBy.split(",").map((part) => {
		const [field, direction] = part.trim().split(/\s+/);
		if (!field || !FILTERABLE_FIELDS.includes(field as FilterableField)) {
			throw new Error(`Invalid $orderby: field "${field ?? ""}" is not sortable`);
		}
		const dir = direction?.toLowerCase() === "desc" ? "desc" : "asc";
		return { [field]: dir } as Prisma.UserOrderByWithRelationInput;
	});
}

export class UserService {
	private userRepository: UserRepository;

	constructor(repository: UserRepository = new UserRepository()) {
		this.userRepository = repository;
	}

	// Retrieves a paginated list of users, applying OData-style query options.
	async findAll(query: PaginationQuery, basePath: string): Promise<ServiceResponse<PaginatedList<User> | null>> {
		try {
			const where: Prisma.UserWhereInput = query.filter ? filterToWhere(parseFilter(query.filter)) : {};
			const orderBy: Prisma.UserOrderByWithRelationInput[] = query.orderBy
				? orderByToPrisma(query.orderBy)
				: [{ id: "asc" }];

			const [prismaUsers, totalCount] = await Promise.all([
				this.userRepository.findAllAsync({ where, orderBy, skip: query.offset, take: query.limit }),
				query.includeCount ? this.userRepository.countAsync(where) : Promise.resolve(undefined),
			]);

			const pagination = buildPaginationMeta({
				limit: query.limit,
				offset: query.offset,
				returnedCount: prismaUsers.length,
				totalCount,
				includeCount: query.includeCount,
				basePath,
				filter: query.filter,
				orderBy: query.orderBy,
			});

			return ServiceResponse.success<PaginatedList<User>>("Users found", {
				data: prismaUsers.map(toPublicUser),
				pagination,
			});
		} catch (ex) {
			const message = (ex as Error).message;
			if (message.startsWith("Invalid $filter") || message.startsWith("Invalid $orderby")) {
				return ServiceResponse.failure(message, null, StatusCodes.BAD_REQUEST);
			}
			logger.error(`Error finding all users: ${message}`);
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
			const errorMessage = `Error finding user with id ${id}: ${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure("An error occurred while finding user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}
}

export const userService = new UserService();
