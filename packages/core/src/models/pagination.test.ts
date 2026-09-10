import { describe, expect, it } from "vitest";

import { buildPageLink, buildPaginationMeta, parsePaginationQuery } from "./pagination";

describe("parsePaginationQuery", () => {
	it("uses defaults when no options are provided", () => {
		const query = parsePaginationQuery({});
		expect(query.limit).toBe(100);
		expect(query.offset).toBe(0);
		expect(query.includeCount).toBe(false);
		expect(query.filter).toBeNull();
		expect(query.orderBy).toBeNull();
	});

	it("parses $top and $skip", () => {
		const query = parsePaginationQuery({ $top: "10", $skip: "20" });
		expect(query.limit).toBe(10);
		expect(query.offset).toBe(20);
	});

	it("accepts limit/offset aliases", () => {
		const query = parsePaginationQuery({ limit: "25", offset: "5" });
		expect(query.limit).toBe(25);
		expect(query.offset).toBe(5);
	});

	it("clamps limit to the maximum", () => {
		const query = parsePaginationQuery({ $top: "9999" });
		expect(query.limit).toBe(500);
	});

	it("falls back for invalid values", () => {
		const query = parsePaginationQuery({ $top: "abc", $skip: "-5" });
		expect(query.limit).toBe(100);
		expect(query.offset).toBe(0);
	});

	it("detects $count true", () => {
		expect(parsePaginationQuery({ $count: "true" }).includeCount).toBe(true);
		expect(parsePaginationQuery({ $count: "false" }).includeCount).toBe(false);
		expect(parsePaginationQuery({}).includeCount).toBe(false);
	});

	it("keeps filter and orderBy strings", () => {
		const query = parsePaginationQuery({ $filter: "role eq 'ADMIN'", $orderby: "name desc" });
		expect(query.filter).toBe("role eq 'ADMIN'");
		expect(query.orderBy).toBe("name desc");
	});
});

describe("buildPageLink", () => {
	it("builds a link with all options", () => {
		const link = buildPageLink("/users", { limit: 10, offset: 20, includeCount: true, filter: "role eq 'ADMIN'" });
		expect(link).toBe("/users?$count=true&$filter=role%20eq%20'ADMIN'&$top=10&$skip=20");
	});
});

describe("buildPaginationMeta", () => {
	it("computes first page with no next link when all items fit", () => {
		const meta = buildPaginationMeta({
			limit: 10,
			offset: 0,
			returnedCount: 3,
			totalCount: 3,
			includeCount: true,
			basePath: "/users",
		});
		expect(meta.count).toBe(3);
		expect(meta.page).toBe(1);
		expect(meta.totalPages).toBe(1);
		expect(meta.nextLink).toBeNull();
		expect(meta.previousLink).toBeNull();
	});

	it("generates nextLink when there are more items", () => {
		const meta = buildPaginationMeta({
			limit: 10,
			offset: 0,
			returnedCount: 10,
			totalCount: 42,
			includeCount: true,
			basePath: "/users",
		});
		expect(meta.nextLink).toBe("/users?$count=true&$top=10&$skip=10");
		expect(meta.previousLink).toBeNull();
		expect(meta.totalPages).toBe(5);
	});

	it("generates previous and next links for a middle page", () => {
		const meta = buildPaginationMeta({
			limit: 10,
			offset: 20,
			returnedCount: 10,
			totalCount: 42,
			includeCount: true,
			basePath: "/users",
		});
		expect(meta.nextLink).toBe("/users?$count=true&$top=10&$skip=30");
		expect(meta.previousLink).toBe("/users?$count=true&$top=10&$skip=10");
		expect(meta.page).toBe(3);
	});

	it("infers count from offset + returned when count is unknown", () => {
		const meta = buildPaginationMeta({
			limit: 10,
			offset: 20,
			returnedCount: 10,
			includeCount: false,
			basePath: "/users",
		});
		expect(meta.count).toBe(30);
		expect(meta.totalPages).toBeNull();
		expect(meta.nextLink).toBe("/users?$top=10&$skip=30");
	});

	it("does not emit nextLink when returned fewer than limit and count unknown", () => {
		const meta = buildPaginationMeta({
			limit: 10,
			offset: 0,
			returnedCount: 3,
			includeCount: false,
			basePath: "/users",
		});
		expect(meta.nextLink).toBeNull();
	});

	it("preserves filter and orderBy in links", () => {
		const meta = buildPaginationMeta({
			limit: 10,
			offset: 0,
			returnedCount: 10,
			totalCount: 42,
			includeCount: true,
			basePath: "/users",
			filter: "role eq 'ADMIN'",
			orderBy: "name desc",
		});
		expect(meta.nextLink).toBe("/users?$count=true&$filter=role%20eq%20'ADMIN'&$orderby=name%20desc&$top=10&$skip=10");
	});
});
