export type FilterOperator = "eq" | "ne" | "gt" | "ge" | "lt" | "le" | "contains" | "startswith" | "endswith";

export type FilterValue = string | number | boolean | null;

export interface FilterCondition {
	type: "condition";
	field: string;
	operator: FilterOperator;
	value: FilterValue;
}

export interface FilterGroup {
	type: "group";
	logic: "and" | "or";
	children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

type Token =
	| { type: "ident"; value: string }
	| { type: "string"; value: string }
	| { type: "number"; value: number }
	| { type: "lparen" }
	| { type: "rparen" }
	| { type: "comma" };

const COMPARISON_OPERATORS = new Set(["eq", "ne", "gt", "ge", "gte", "lt", "le", "lte"]);
const FUNCTION_OPERATORS = new Set(["contains", "startswith", "endswith"]);

export function isFilterOperator(value: string): value is FilterOperator {
	return COMPARISON_OPERATORS.has(value) || FUNCTION_OPERATORS.has(value);
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const length = input.length;

	while (i < length) {
		const char = input[i];
		if (/\s/.test(char)) {
			i += 1;
			continue;
		}
		if (char === "(") {
			tokens.push({ type: "lparen" });
			i += 1;
			continue;
		}
		if (char === ")") {
			tokens.push({ type: "rparen" });
			i += 1;
			continue;
		}
		if (char === ",") {
			tokens.push({ type: "comma" });
			i += 1;
			continue;
		}
		if (char === "'" || char === '"') {
			const quote = char;
			let j = i + 1;
			let value = "";
			while (j < length && input[j] !== quote) {
				if (input[j] === "\\" && j + 1 < length) {
					value += input[j + 1];
					j += 2;
					continue;
				}
				value += input[j];
				j += 1;
			}
			if (j >= length) {
				throw new Error("Invalid $filter: unterminated string literal");
			}
			tokens.push({ type: "string", value });
			i = j + 1;
			continue;
		}
		const word = /^[A-Za-z0-9._-]+/.exec(input.slice(i))?.[0];
		if (!word) {
			throw new Error(`Invalid $filter: unexpected character "${char}"`);
		}
		i += word.length;
		if (/^-?\d+(\.\d+)?$/.test(word)) {
			tokens.push({ type: "number", value: Number(word) });
		} else {
			tokens.push({ type: "ident", value: word });
		}
	}

	return tokens;
}

function tokenToValue(token: Token): FilterValue {
	if (token.type === "string") {
		return token.value;
	}
	if (token.type === "number") {
		return token.value;
	}
	if (token.type === "ident") {
		const lower = token.value.toLowerCase();
		if (lower === "true") {
			return true;
		}
		if (lower === "false") {
			return false;
		}
		if (lower === "null") {
			return null;
		}
	}
	throw new Error(`Invalid $filter: expected a value but found "${token.type === "ident" ? token.value : token.type}"`);
}

export function parseFilter(input: string): FilterNode {
	const tokens = tokenize(input);
	let pos = 0;

	function peek(): Token | undefined {
		return tokens[pos];
	}

	function next(): Token | undefined {
		return tokens[pos++];
	}

	function expectClosingParen(): void {
		const token = next();
		if (token?.type !== "rparen") {
			throw new Error("Invalid $filter: expected closing parenthesis");
		}
	}

	function parseOr(): FilterNode {
		const left = parseAnd();
		const token = peek();
		if (token?.type === "ident" && token.value.toLowerCase() === "or") {
			pos += 1;
			const right = parseOr();
			return { type: "group", logic: "or", children: [left, right] };
		}
		return left;
	}

	function parseAnd(): FilterNode {
		const left = parseAtom();
		const token = peek();
		if (token?.type === "ident" && token.value.toLowerCase() === "and") {
			pos += 1;
			const right = parseAnd();
			return { type: "group", logic: "and", children: [left, right] };
		}
		return left;
	}

	function parseAtom(): FilterNode {
		const token = next();
		if (!token) {
			throw new Error("Invalid $filter: unexpected end of expression");
		}
		if (token.type === "lparen") {
			const node = parseOr();
			expectClosingParen();
			return node;
		}
		if (token.type !== "ident") {
			throw new Error(`Invalid $filter: unexpected token near "${token.type}"`);
		}

		const lower = token.value.toLowerCase();
		if (FUNCTION_OPERATORS.has(lower)) {
			const open = next();
			if (open?.type !== "lparen") {
				throw new Error(`Invalid $filter: expected "(" after ${lower}`);
			}
			const field = next();
			if (field?.type !== "ident" && field?.type !== "string") {
				throw new Error(`Invalid $filter: expected field name in ${lower}()`);
			}
			const comma = next();
			if (comma?.type !== "comma") {
				throw new Error('Invalid $filter: expected "," in function call');
			}
			const value = next();
			if (!value) {
				throw new Error("Invalid $filter: expected value in function call");
			}
			expectClosingParen();
			return { type: "condition", field: field.value, operator: lower as FilterOperator, value: tokenToValue(value) };
		}

		const field = token.value;
		const operator = peek();
		if (operator?.type !== "ident" || !isFilterOperator(operator.value.toLowerCase())) {
			throw new Error(`Invalid $filter: missing or invalid operator for field "${field}"`);
		}
		pos += 1;
		const value = next();
		if (!value) {
			throw new Error(`Invalid $filter: missing value for field "${field}"`);
		}
		const normalizedOperator = operator.value.toLowerCase();
		if (normalizedOperator === "gte") {
			return { type: "condition", field, operator: "ge", value: tokenToValue(value) };
		}
		if (normalizedOperator === "lte") {
			return { type: "condition", field, operator: "le", value: tokenToValue(value) };
		}
		return { type: "condition", field, operator: normalizedOperator as FilterOperator, value: tokenToValue(value) };
	}

	const result = parseOr();
	if (pos < tokens.length) {
		const trailing = tokens[pos];
		throw new Error(
			`Invalid $filter: unexpected trailing tokens near "${trailing.type === "ident" ? trailing.value : trailing.type}"`,
		);
	}
	if (result.type === "group" && result.children.length === 1) {
		return result.children[0];
	}
	return result;
}
