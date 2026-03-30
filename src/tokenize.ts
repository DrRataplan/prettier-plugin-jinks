import { XQuery31Full } from "xq-parser";
import type { TokenType } from "./Token.ts";
import { TokenTypes } from "./Token.ts";

function xqExpr(value: string, start: number, end: number): XQExprValue {
	try {
		XQuery31Full(value);
	} catch (e) {
		throw new SyntaxError(
			`Invalid XQuery expression ${JSON.stringify(value)}: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
	return { type: TokenTypes.XQEXPR, value, start, end };
}

// Each pattern is matched separately for clarity and correct group extraction
type Pattern = {
	re: RegExp;
	type: TokenType.TokenType;
};
// These patters are the same as used in jinks-templating/content/templates.xqm.
const PATTERNS: Pattern[] = [
	// frontmatter.
	// Note the regex is different from the one in jinks-templating because we are interested in the part _before_ the --json
	{
		re: /\s*---(?:json|)\s*\n*([\s\S]*?)\n*\s*---/m,
		type: TokenTypes.FRONTMATTER,
	},
	// comment
	{ re: /\[#([\s\S]*?)#\]/, type: TokenTypes.COMMENT },
	// raw block
	{ re: /\[%\s*raw\s*%\]([\s\S]*?)\[%\s*endraw\s*%\]/, type: TokenTypes.RAW },
	// end tags
	{
		re: /\[%\s*(endfor)\s*%\]/,
		type: TokenTypes.ENDFOR,
	},
	{
		re: /\[%\s*(endlet)\s*%\]/,
		type: TokenTypes.ENDLET,
	},
	{
		re: /\[%\s*(endif)\s*%\]/,
		type: TokenTypes.ENDIF,
	},
	{
		re: /\[%\s*(endblock)\s*%\]/,
		type: TokenTypes.ENDBLOCK,
	},
	{
		re: /\[%\s*(endtemplate)\s*%\]/,
		type: TokenTypes.ENDTEMPLATE,
	},
	// for
	{ re: /\[%\s*for\s+(\$\w+)\s+in\s+([\s\S]+?)%\]/, type: TokenTypes.FOR },
	// let
	{ re: /\[%\s*let\s+(\$\w+)\s*=\s*([\s\S]+?)%\]/, type: TokenTypes.LET },
	// if
	{ re: /\[%\s*if\s+([\s\S]+?)%\]/, type: TokenTypes.IF },
	// elif
	{ re: /\[%\s*elif\s+([\s\S]+?)%\]/, type: TokenTypes.ELIF },
	// else
	{ re: /\[%\s*else\s*%\]/, type: TokenTypes.ELSE },
	// include
	{ re: /\[%\s*include\s+([\s\S]+?)%\]/, type: TokenTypes.INCLUDE },
	// block
	{ re: /\[%\s*block\s+(\S+?)(?:\s+(.*?))?%\]/, type: TokenTypes.BLOCK },
	// template! (overwrite)
	{
		re: /\[%\s*template!\s+(\S+?)(?:\s+(.*?))?%\]/,
		type: TokenTypes.TEMPLATE_OVERRIDE,
	},
	// template
	{
		re: /\[%\s*template\s+(\S+?)(?:\s+(.*?))?%\]/,
		type: TokenTypes.TEMPLATE,
	},
	// import
	{
		re: /\[%\s*import\s+["'](.+?)["']\s+as\s+["']([\w\-_]+)["'](?:\s+at\s+["'](.+?)["'])?\s*%\]/,
		type: TokenTypes.IMPORT,
	},
	// value interpolation
	{ re: /\[\[([\s\S]+?)\]\]/, type: TokenTypes.VALUE },
];

type SimpleToken = {
	type:
		| TokenType.COMMENT
		| TokenType.ENDBLOCK
		| TokenType.ENDTEMPLATE
		| TokenType.ENDFOR
		| TokenType.ENDIF
		| TokenType.ENDLET
		| TokenType.FRONTMATTER
		| TokenType.RAW
		| TokenType.TEXT;
	value: string;
};
type IncludeToken = { type: TokenType.INCLUDE; target: string };
type ElseToken = { type: TokenType.ELSE };
type XQExprValue = { type: TokenType.XQEXPR; value: string; start: number; end: number };
type IfToken = { type: TokenType.IF | TokenType.ELIF; expr: XQExprValue };
type LetToken = { type: TokenType.LET; var: string; expr: XQExprValue };
type ForToken = { type: TokenType.FOR; var: string; expr: XQExprValue };
type ImportToken = {
	type: TokenType.IMPORT;
	uri: string;
	as: string;
	at: string | null;
};
type TemplateToken = {
	type: TokenType.TEMPLATE | TokenType.TEMPLATE_OVERRIDE | TokenType.BLOCK;
	name: string;
	order: string;
};
type ValueToken = { type: TokenType.VALUE; expr: XQExprValue };
export type Token = (
	| SimpleToken
	| ImportToken
	| TemplateToken
	| ValueToken
	| ElseToken
	| LetToken
	| IncludeToken
	| IfToken
	| ForToken
) & { start: number; end: number };

export default function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let remaining = input;
	let offset = 0;

	while (remaining.length > 0) {
		let earliest: number | null = null;
		let earliestPattern: Pattern | null = null;
		let earliestMatch: RegExpExecArray | null = null;

		for (const p of PATTERNS) {
			const re = new RegExp(p.re.source, "im");
			const m = re.exec(remaining);
			if (m && (earliest === null || m.index < earliest)) {
				earliest = m.index;
				earliestPattern = p;
				earliestMatch = m;
			}
		}

		if (earliest === null) {
			// No more template tokens — rest is plain text
			tokens.push({ type: TokenTypes.TEXT, value: remaining, start: offset, end: offset + remaining.length });
			break;
		}

		// Text before the match
		if (earliest > 0) {
			tokens.push({
				type: TokenTypes.TEXT,
				value: remaining.slice(0, earliest),
				start: offset,
				end: offset + earliest,
			});
		}

		const m = earliestMatch!;
		const p = earliestPattern!;
		const tokStart = offset + earliest;
		const tokEnd = tokStart + m[0].length;

		switch (p.type) {
			case TokenTypes.ENDFOR:
			case TokenTypes.ENDLET:
			case TokenTypes.ENDIF:
			case TokenTypes.RAW:
			case TokenTypes.FRONTMATTER:
			case TokenTypes.ENDBLOCK:
			case TokenTypes.ENDTEMPLATE:
			case TokenTypes.ENDLET:
			case TokenTypes.COMMENT:
				tokens.push({ type: p.type, value: m[1]! });
				break;
			case TokenTypes.TEMPLATE:
			case TokenTypes.TEMPLATE_OVERRIDE:
				tokens.push({
					type: p.type,
					name: m[1]!.trim(),
					order: m[2]!?.trim() || "",
				});
				break;
			case TokenTypes.FOR:
				tokens.push({
					type: TokenTypes.FOR,
					var: m[1]!.trim(),
					expr: xqExpr(m[2]!.trim()),
				});
				break;
			case TokenTypes.LET:
				tokens.push({
					type: TokenTypes.LET,
					var: m[1]!.trim(),
					expr: xqExpr(m[2]!.trim()),
				});
				break;
			case TokenTypes.INCLUDE:
				tokens.push({ type: TokenTypes.INCLUDE, target: m[1]!.trim() });
				break;

			case TokenTypes.BLOCK:
				tokens.push({
					type: TokenTypes.BLOCK,
					name: m[1]!.trim(),
					order: m[2]!?.trim() || "",
				});
				break;

			case TokenTypes.IMPORT:
				tokens.push({
					type: TokenTypes.IMPORT,
					uri: m[1]!.trim(),
					as: m[2]!.trim(),
					at: m[3]?.trim() || "",
				});
				break;
			case "IF":
				tokens.push({
					type: TokenTypes.IF,
					expr: xqExpr(m[1]!.trim()),
				});
				break;
			case "ELIF":
				tokens.push({
					type: TokenTypes.ELIF,
					expr: xqExpr(m[1]!.trim()),
				});
				break;
			case TokenTypes.ELSE:
				tokens.push({ type: TokenTypes.ELSE });
				break;
			case TokenTypes.VALUE:
				tokens.push({
					type: TokenTypes.VALUE,
					expr: xqExpr(m[1]!.trim()),
				});
				break;
		}

		offset += earliest + m[0].length;
		remaining = remaining.slice(earliest + m[0].length);
	}

	return tokens;
}
