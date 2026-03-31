import type { TokenType } from "./Token.ts";
import { TokenTypes } from "./Token.ts";
import type { Token } from "./tokenize.ts";

export type XQExprNode = {
	type: TokenType.XQEXPR;
	value: string;
	start: number;
	end: number;
};

export type Node = (
	| BlockNode
	| ElseNode
	| ElifNode
	| ForNode
	| IfNode
	| ImportNode
	| IncludeNode
	| LetNode
	| SimpleNode
	| TemplateNode
	| ValueNode
	| XQExprNode
) & { start: number; end: number };

type SimpleNode = {
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

type ElifNode = {
	type: TokenType.ELIF;
	expr: XQExprNode;
	body: Node[];
};

type ElseNode = {
	type: TokenType.ELSE;
	body: Node[];
};

type ImportNode = {
	type: TokenType.IMPORT;
	at: string | null;
	uri: string;
	as: string;
};

export type RootNode = {
	type: "root";
	body: Node[];
	start: number;
	end: number;
};

type ValueNode = {
	type: TokenType.VALUE;
	expr: XQExprNode;
};

type IncludeNode = {
	type: TokenType.INCLUDE;
	target: string;
};

type ForNode = {
	type: TokenType.FOR;
	var: string;
	expr: XQExprNode;
	body: Node[];
};

type LetNode = {
	type: TokenType.LET;
	var: string;
	expr: XQExprNode;
	body: Node[];
};

type IfNode = {
	type: TokenType.IF;
	expr: XQExprNode;
	consequent: Node[];
	alternates: Alternate[];
};

type Alternate = ElifNode | ElseNode;

type BlockNode = {
	type: TokenType.BLOCK;
	name: string;
	order: string | null;
	body: Node[];
};
type TemplateNode = {
	type: TokenType.TEMPLATE | TokenType.TEMPLATE_OVERRIDE;
	name: string;
	order: string | null;
	body: Node[];
};
export default function parse(tokens: Token[]): RootNode {
	let pos = 0;

	function peek(): Token {
		return tokens[pos]!;
	}
	function consume() {
		return tokens[pos++];
	}
	function eof() {
		return pos >= tokens.length;
	}

	function parseBody(endTypes: TokenType.TokenType[] | null) {
		const nodes: Node[] = [];
		while (!eof()) {
			const t = peek();
			if (endTypes && endTypes.includes(t.type)) break;
			nodes.push(parseNode());
		}
		return nodes;
	}

	function parseNode(): Node {
		const t = peek();

		switch (t.type) {
			case TokenTypes.FRONTMATTER: {
				consume();
				return {
					type: TokenTypes.FRONTMATTER,
					value: t.value,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.COMMENT: {
				consume();
				return {
					type: TokenTypes.COMMENT,
					value: t.value,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.TEXT: {
				consume();
				return {
					type: TokenTypes.TEXT,
					value: t.value,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.RAW: {
				consume();
				return {
					type: TokenTypes.RAW,
					value: t.value,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.VALUE: {
				consume();
				return {
					type: TokenTypes.VALUE,
					expr: t.expr,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.IMPORT: {
				consume();
				return {
					type: TokenTypes.IMPORT,
					uri: t.uri,
					as: t.as,
					at: t.at,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.INCLUDE: {
				consume();
				return {
					type: TokenTypes.INCLUDE,
					target: t.target,
					start: t.start,
					end: t.end,
				};
			}
			case TokenTypes.FOR: {
				consume();
				const body = parseBody([TokenTypes.ENDFOR]);
				if (eof())
					throw new SyntaxError("[% for %] without [% endfor %]");
				const endFor = consume()!;
				return {
					type: TokenTypes.FOR,
					var: t.var,
					expr: t.expr,
					body,
					start: t.start,
					end: endFor.end,
				};
			}
			case TokenTypes.LET: {
				consume();
				const body = parseBody([TokenTypes.ENDLET]);
				if (eof())
					throw new SyntaxError("[% let %] without [% endlet %]");
				const endLet = consume()!;
				return {
					type: TokenTypes.LET,
					var: t.var,
					expr: t.expr,
					body,
					start: t.start,
					end: endLet.end,
				};
			}
			case TokenTypes.IF: {
				consume();
				const consequent = parseBody([
					TokenTypes.ELIF,
					TokenTypes.ELSE,
					TokenTypes.ENDIF,
				]);
				const alternates: Alternate[] = [];
				while (!eof()) {
					const next = peek();
					if (next.type === TokenTypes.ELIF) {
						consume();
						const elifBody = parseBody([
							TokenTypes.ELIF,
							TokenTypes.ELSE,
							TokenTypes.ENDIF,
						]);
						alternates.push({
							type: TokenTypes.ELIF,
							expr: next.expr,
							body: elifBody,
							start: next.start,
							end:
								elifBody.length > 0
									? elifBody[elifBody.length - 1]!.end
									: next.end,
						});
					} else if (next.type === TokenTypes.ELSE) {
						consume();
						const elseBody = parseBody([TokenTypes.ENDIF]);
						alternates.push({
							type: TokenTypes.ELSE,
							body: elseBody,
							start: next.start,
							end:
								elseBody.length > 0
									? elseBody[elseBody.length - 1]!.end
									: next.end,
						});
						break;
					} else if (next.type === TokenTypes.ENDIF) {
						break;
					} else {
						break;
					}
				}
				if (eof() || peek().type !== TokenTypes.ENDIF)
					throw new SyntaxError("[% if %] without [% endif %]");
				const endIf = consume()!;
				return {
					type: TokenTypes.IF,
					expr: t.expr,
					consequent,
					alternates,
					start: t.start,
					end: endIf.end,
				};
			}
			case TokenTypes.BLOCK: {
				consume();
				const body = parseBody([TokenTypes.ENDBLOCK]);
				if (eof())
					throw new SyntaxError("[% block %] without [% endblock %]");
				const endBlock = consume()!;
				return {
					type: TokenTypes.BLOCK,
					name: t.name,
					order: t.order,
					body,
					start: t.start,
					end: endBlock.end,
				};
			}
			case TokenTypes.TEMPLATE_OVERRIDE:
			case TokenTypes.TEMPLATE: {
				consume();
				const body = parseBody([TokenTypes.ENDTEMPLATE]);
				if (eof())
					throw new SyntaxError(
						"[% template %] without [% endtemplate %]",
					);
				const endTemplate = consume()!;
				return {
					type: t.type,
					name: t.name,
					order: t.order,
					body,
					start: t.start,
					end: endTemplate.end,
				};
			}
			case TokenTypes.ENDFOR:
				throw new SyntaxError("[% endfor %] without [% for %]");
			case TokenTypes.ENDLET:
				throw new SyntaxError("[% endlet %] without [% let %]");
			case TokenTypes.ENDIF:
				throw new SyntaxError("[% endif %] without [% if %]");
			case TokenTypes.ENDBLOCK:
				throw new SyntaxError("[% endblock %] without [% block %]");
			case TokenTypes.ENDTEMPLATE:
				throw new SyntaxError(
					"[% endtemplate %] without [% template %]",
				);
			case TokenTypes.ELIF:
				throw new SyntaxError("[% elif %] without [% if %]");
			case TokenTypes.ELSE:
				throw new SyntaxError("[% else %] without [% if %]");
			default: {
				// Unknown token — treat as text
				consume();
				return {
					type: TokenTypes.TEXT,
					value: JSON.stringify(t),
					start: t.start,
					end: t.end,
				};
			}
		}
	}

	const body = parseBody(null);
	const start = body.length > 0 ? body[0]!.start : 0;
	const end = body.length > 0 ? body[body.length - 1]!.end : 0;
	return { type: "root", body, start, end };
}
