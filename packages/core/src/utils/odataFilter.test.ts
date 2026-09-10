import { describe, expect, it } from "vitest";

import { type FilterGroup, parseFilter } from "./odataFilter";

describe("parseFilter", () => {
	it("parses a simple equality condition", () => {
		expect(parseFilter("role eq 'ADMIN'")).toEqual({
			type: "condition",
			field: "role",
			operator: "eq",
			value: "ADMIN",
		});
	});

	it("parses comparison operators", () => {
		expect(parseFilter("id gt 5")).toEqual({ type: "condition", field: "id", operator: "gt", value: 5 });
		expect(parseFilter("id gte 5")).toEqual({ type: "condition", field: "id", operator: "ge", value: 5 });
		expect(parseFilter("id lt 5")).toEqual({ type: "condition", field: "id", operator: "lt", value: 5 });
		expect(parseFilter("id lte 5")).toEqual({ type: "condition", field: "id", operator: "le", value: 5 });
	});

	it("handles null, booleans and numbers", () => {
		expect(parseFilter("emailVerifiedAt ne null")).toEqual({
			type: "condition",
			field: "emailVerifiedAt",
			operator: "ne",
			value: null,
		});
		expect(parseFilter("isAdmin eq true")).toEqual({
			type: "condition",
			field: "isAdmin",
			operator: "eq",
			value: true,
		});
		expect(parseFilter("score eq 10.5")).toEqual({ type: "condition", field: "score", operator: "eq", value: 10.5 });
	});

	it("parses and/or with precedence", () => {
		const node = parseFilter("role eq 'ADMIN' and name contains 'a' or email eq 'x@y.z'");
		expect(node).toMatchObject({ type: "group", logic: "or" });
		expect((node as FilterGroup).children).toHaveLength(2);
	});

	it("supports parentheses and function calls", () => {
		const node = parseFilter("(role eq 'USER' and startswith(name, 'A')) or endswith(email, '.com')");
		expect(node).toMatchObject({ type: "group", logic: "or" });
		expect((node as FilterGroup).children).toHaveLength(2);
		expect((node as FilterGroup).children[0]).toMatchObject({ type: "group" });
	});

	it("preserves field case", () => {
		expect(parseFilter("createdAt gt '2024-01-01'")).toMatchObject({ field: "createdAt" });
	});

	it("throws on invalid expressions", () => {
		expect(() => parseFilter("")).toThrow();
		expect(() => parseFilter("name")).toThrow();
		expect(() => parseFilter("name eq")).toThrow();
		expect(() => parseFilter("name eq 'a' trailing")).toThrow();
		expect(() => parseFilter("(name eq 'a'")).toThrow();
	});
});
