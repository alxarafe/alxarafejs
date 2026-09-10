import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;

export interface PaginationMeta {
	count: number;
	limit: number;
	offset: number;
	page: number;
	totalPages: number | null;
	nextLink: string | null;
	previousLink: string | null;
}

export interface PaginatedList<T> {
	data: T[];
	pagination: PaginationMeta;
}

export interface PaginationQuery {
	limit: number;
	offset: number;
	includeCount: boolean;
	filter: string | null;
	orderBy: string | null;
}

export const PaginationSchema = z.object({
	count: z.number(),
	limit: z.number(),
	offset: z.number(),
	page: z.number(),
	totalPages: z.number().nullable(),
	nextLink: z.string().nullable(),
	previousLink: z.string().nullable(),
});

export const PaginatedListSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.object({
		data: z.array(dataSchema),
		pagination: PaginationSchema,
	});

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
		return Math.min(Math.max(Math.trunc(Number(value)), min), max);
	}
	return fallback;
}

function isTruthy(value: unknown): boolean {
	return value === true || value === "true" || value === "1";
}

function firstString(value: unknown): string | null {
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value) && typeof value[0] === "string") {
		return value[0];
	}
	return null;
}

export function parsePaginationQuery(
	query: Record<string, unknown>,
	options: { defaultLimit?: number; maxLimit?: number } = {},
): PaginationQuery {
	const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_SIZE;
	const maxLimit = options.maxLimit ?? MAX_PAGE_SIZE;

	const limit = clampInt(query.$top ?? query.limit, defaultLimit, 1, maxLimit);
	const offset = clampInt(query.$skip ?? query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
	const includeCount = isTruthy(query.$count) || isTruthy(query.$inlinecount);

	return {
		limit,
		offset,
		includeCount,
		filter: firstString(query.$filter),
		orderBy: firstString(query.$orderby),
	};
}

export interface BuildPageLinkOptions {
	limit: number;
	offset: number;
	includeCount: boolean;
	filter?: string | null;
	orderBy?: string | null;
}

export function buildPageLink(basePath: string, options: BuildPageLinkOptions): string {
	const parts: string[] = [];
	if (options.includeCount) {
		parts.push("$count=true");
	}
	if (options.filter) {
		parts.push(`$filter=${encodeURIComponent(options.filter)}`);
	}
	if (options.orderBy) {
		parts.push(`$orderby=${encodeURIComponent(options.orderBy)}`);
	}
	parts.push(`$top=${options.limit}`);
	parts.push(`$skip=${options.offset}`);
	const queryString = parts.join("&");
	return queryString ? `${basePath}?${queryString}` : basePath;
}

export interface BuildPaginationMetaOptions {
	limit: number;
	offset: number;
	returnedCount: number;
	totalCount?: number;
	includeCount: boolean;
	basePath: string;
	filter?: string | null;
	orderBy?: string | null;
}

export function buildPaginationMeta(options: BuildPaginationMetaOptions): PaginationMeta {
	const { limit, offset, returnedCount, totalCount, includeCount, basePath, filter, orderBy } = options;

	const knownTotal = includeCount && totalCount !== undefined;
	const count = knownTotal ? (totalCount as number) : offset + returnedCount;
	const hasNext = knownTotal ? offset + returnedCount < count : returnedCount === limit && limit > 0;
	const hasPrevious = offset > 0;

	return {
		count,
		limit,
		offset,
		page: limit > 0 ? Math.floor(offset / limit) + 1 : 1,
		totalPages: knownTotal && count > 0 ? Math.ceil(count / limit) : null,
		nextLink: hasNext
			? buildPageLink(basePath, { limit, offset: offset + limit, includeCount, filter, orderBy })
			: null,
		previousLink: hasPrevious
			? buildPageLink(basePath, { limit, offset: Math.max(offset - limit, 0), includeCount, filter, orderBy })
			: null,
	};
}
