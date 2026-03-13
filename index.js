"use strict";

/**
 * Prettier plugin for jinks template files (.tpl.*)
 *
 * The jinks template syntax embeds template expressions into a host language
 * (XQuery, HTML, CSS, etc.). This plugin parses the template layer, formats
 * the template expressions, and leaves host language content to be formatted
 * by another parser or left as-is.
 *
 * Template syntax:
 *   [[ expr ]]           - value interpolation
 *   [% for $x in expr %] - loop
 *   [% endfor %]
 *   [% let $x = expr %]  - let binding
 *   [% endlet %]
 *   [% if expr %]        - conditional
 *   [% elif expr %]
 *   [% else %]
 *   [% endif %]
 *   [% include "path" %] - include
 *   [% block name %]     - block
 *   [% endblock %]
 *   [% template name %]  - template definition
 *   [% endtemplate %]
 *   [% import "uri" as "prefix" at "path" %] - import
 *   [% raw %] ... [% endraw %] - raw passthrough
 *   [# comment #]        - comment (stripped by parser)
 *   ---json ... ---      - frontmatter
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------
const T = {
	TEXT: "TEXT",
	VALUE: "VALUE", // [[ expr ]]
	FOR: "FOR", // [% for $x in expr %]
	ENDFOR: "ENDFOR",
	LET: "LET", // [% let $x = expr %]
	ENDLET: "ENDLET",
	IF: "IF", // [% if expr %]
	ELIF: "ELIF",
	ELSE: "ELSE",
	ENDIF: "ENDIF",
	INCLUDE: "INCLUDE",
	BLOCK: "BLOCK",
	ENDBLOCK: "ENDBLOCK",
	TEMPLATE: "TEMPLATE",
	ENDTEMPLATE: "ENDTEMPLATE",
	IMPORT: "IMPORT",
	RAW: "RAW",
	FRONTMATTER: "FRONTMATTER",
	COMMENT: "COMMENT",
};

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

// Each pattern is matched separately for clarity and correct group extraction
const PATTERNS = [
	// frontmatter
	{
		re: /^(?:\s*<[^>]+>)?\s*---(?:json|)\s*\n([\s\S]*?)\n\s*---/m,
		type: "FRONTMATTER",
	},
	// comment
	{ re: /\[#([\s\S]*?)#\]/, type: "COMMENT" },
	// raw block
	{ re: /\[%\s*raw\s*%\]([\s\S]*?)\[%\s*endraw\s*%\]/, type: "RAW" },
	// end tags
	{ re: /\[%\s*(end(?:for|let|if|block|template))\s*%\]/, type: "END" },
	// for
	{ re: /\[%\s*for\s+(\$\w+)\s+in\s+([\s\S]+?)%\]/, type: "FOR" },
	// let
	{ re: /\[%\s*let\s+(\$\w+)\s*=\s*([\s\S]+?)%\]/, type: "LET" },
	// if
	{ re: /\[%\s*if\s+([\s\S]+?)%\]/, type: "IF" },
	// elif
	{ re: /\[%\s*elif\s+([\s\S]+?)%\]/, type: "ELIF" },
	// else
	{ re: /\[%\s*else\s*%\]/, type: "ELSE" },
	// include
	{ re: /\[%\s*include\s+([\s\S]+?)%\]/, type: "INCLUDE" },
	// block
	{ re: /\[%\s*block\s+(\S+?)(?:\s+(.*?))?%\]/, type: "BLOCK" },
	// template! (overwrite)
	{
		re: /\[%\s*template!\s+(\S+?)(?:\s+(.*?))?%\]/,
		type: "TEMPLATE_OVERWRITE",
	},
	// template
	{ re: /\[%\s*template\s+(\S+?)(?:\s+(.*?))?%\]/, type: "TEMPLATE" },
	// import
	{
		re: /\[%\s*import\s+["'](.+?)["']\s+as\s+["']([\w\-_]+)["'](?:\s+at\s+["'](.+?)["'])?\s*%\]/,
		type: "IMPORT",
	},
	// value interpolation
	{ re: /\[\[([\s\S]+?)\]\]/, type: "VALUE" },
];

function tokenize(input) {
	const tokens = [];
	let remaining = input;
	let absolutePos = 0;

	while (remaining.length > 0) {
		let earliest = null;
		let earliestPattern = null;
		let earliestMatch = null;

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
			tokens.push({ type: T.TEXT, value: remaining });
			break;
		}

		// Text before the match
		if (earliest > 0) {
			tokens.push({ type: T.TEXT, value: remaining.slice(0, earliest) });
		}

		const m = earliestMatch;
		const p = earliestPattern;

		switch (p.type) {
			case "FRONTMATTER":
				tokens.push({ type: T.FRONTMATTER, value: m[1] });
				break;
			case "COMMENT":
				tokens.push({ type: T.COMMENT, value: m[1] });
				break;
			case "RAW":
				tokens.push({ type: T.RAW, value: m[1] });
				break;
			case "END": {
				const tag = m[1].toLowerCase();
				const typeMap = {
					endfor: T.ENDFOR,
					endlet: T.ENDLET,
					endif: T.ENDIF,
					endblock: T.ENDBLOCK,
					endtemplate: T.ENDTEMPLATE,
				};
				tokens.push({ type: typeMap[tag] });
				break;
			}
			case "FOR":
				tokens.push({
					type: T.FOR,
					var: m[1].trim(),
					expr: m[2].trim(),
				});
				break;
			case "LET":
				tokens.push({
					type: T.LET,
					var: m[1].trim(),
					expr: m[2].trim(),
				});
				break;
			case "IF":
				tokens.push({ type: T.IF, expr: m[1].trim() });
				break;
			case "ELIF":
				tokens.push({ type: T.ELIF, expr: m[1].trim() });
				break;
			case "ELSE":
				tokens.push({ type: T.ELSE });
				break;
			case "INCLUDE":
				tokens.push({ type: T.INCLUDE, target: m[1].trim() });
				break;
			case "BLOCK":
				tokens.push({
					type: T.BLOCK,
					name: m[1].trim(),
					order: m[2]?.trim() || "",
				});
				break;
			case "TEMPLATE":
				tokens.push({
					type: T.TEMPLATE,
					name: m[1].trim(),
					overwrite: false,
					order: m[2]?.trim() || "",
				});
				break;
			case "TEMPLATE_OVERWRITE":
				tokens.push({
					type: T.TEMPLATE,
					name: m[1].trim(),
					overwrite: true,
					order: m[2]?.trim() || "",
				});
				break;
			case "IMPORT":
				tokens.push({
					type: T.IMPORT,
					uri: m[1].trim(),
					as: m[2].trim(),
					at: m[3]?.trim(),
				});
				break;
			case "VALUE":
				tokens.push({ type: T.VALUE, expr: m[1].trim() });
				break;
		}

		remaining = remaining.slice(earliest + m[0].length);
	}

	return tokens;
}

// ---------------------------------------------------------------------------
// Parser — builds an AST from the token stream
// ---------------------------------------------------------------------------

function parse(tokens) {
	let pos = 0;

	function peek() {
		return tokens[pos];
	}
	function consume() {
		return tokens[pos++];
	}
	function eof() {
		return pos >= tokens.length;
	}

	function parseBody(endTypes) {
		const nodes = [];
		while (!eof()) {
			const t = peek();
			if (endTypes && endTypes.includes(t.type)) break;
			nodes.push(parseNode());
		}
		return nodes;
	}

	function parseNode() {
		const t = peek();

		switch (t.type) {
			case T.FRONTMATTER: {
				consume();
				return { type: "frontmatter", value: t.value };
			}
			case T.COMMENT: {
				consume();
				return { type: "comment", value: t.value };
			}
			case T.TEXT: {
				consume();
				return { type: "text", value: t.value };
			}
			case T.RAW: {
				consume();
				return { type: "raw", value: t.value };
			}
			case T.VALUE: {
				consume();
				return { type: "value", expr: t.expr };
			}
			case T.IMPORT: {
				consume();
				return {
					type: "import",
					uri: t.uri,
					as: t.as,
					at: t.at,
				};
			}
			case T.INCLUDE: {
				consume();
				return { type: "include", target: t.target };
			}
			case T.FOR: {
				consume();
				const body = parseBody([T.ENDFOR]);
				if (!eof()) consume(); // consume endfor
				return { type: "for", var: t.var, expr: t.expr, body };
			}
			case T.LET: {
				consume();
				const body = parseBody([T.ENDLET]);
				if (!eof()) consume(); // consume endlet
				return { type: "let", var: t.var, expr: t.expr, body };
			}
			case T.IF: {
				consume();
				const consequent = parseBody([T.ELIF, T.ELSE, T.ENDIF]);
				const alternates = [];
				while (!eof()) {
					const next = peek();
					if (next.type === T.ELIF) {
						consume();
						const elifBody = parseBody([T.ELIF, T.ELSE, T.ENDIF]);
						alternates.push({
							type: "elif",
							expr: next.expr,
							body: elifBody,
						});
					} else if (next.type === T.ELSE) {
						consume();
						const elseBody = parseBody([T.ENDIF]);
						alternates.push({ type: "else", body: elseBody });
						break;
					} else if (next.type === T.ENDIF) {
						break;
					} else {
						break;
					}
				}
				if (!eof() && peek().type === T.ENDIF) consume();
				return { type: "if", expr: t.expr, consequent, alternates };
			}
			case T.BLOCK: {
				consume();
				const body = parseBody([T.ENDBLOCK]);
				if (!eof()) consume();
				return { type: "block", name: t.name, order: t.order, body };
			}
			case T.TEMPLATE: {
				consume();
				const body = parseBody([T.ENDTEMPLATE]);
				if (!eof()) consume();
				return {
					type: "template",
					name: t.name,
					overwrite: t.overwrite,
					order: t.order,
					body,
				};
			}
			default: {
				// Unknown token — treat as text
				consume();
				return { type: "text", value: JSON.stringify(t) };
			}
		}
	}

	const body = parseBody(null);
	return { type: "root", body };
}

// ---------------------------------------------------------------------------
// Prettier printer
// ---------------------------------------------------------------------------

// Prettier doc builders — loaded lazily so the tokenizer/parser
// can be required and tested without Prettier being installed.
let _builders = null;
function builders() {
	if (!_builders) {
		_builders = require("prettier").doc.builders;
	}
	return _builders;
}

function normalizeExpr(expr) {
	// Collapse internal whitespace in XQuery expressions
	return (expr || "").replace(/\s+/g, " ").trim();
}

function printNode(node, options) {
	const { hardline, indent, join } = builders();

	switch (node.type) {
		case "root":
			return join(
				"",
				node.body.map((n) => printNode(n, options)),
			);

		case "frontmatter": {
			let fm = node.value.trim();
			try {
				fm = JSON.stringify(JSON.parse(fm), null, 2);
			} catch {
				// not valid JSON — leave as-is
			}
			return ["---json", hardline, fm, hardline, "---"];
		}

		case "comment":
			// Re-emit comments — they were stripped by the XQuery parser but we preserve them
			return ["[#", node.value, "#]"];

		case "text":
			return node.value;

		case "raw":
			return ["[% raw %]", node.value, "[% endraw %]"];

		case "value":
			return ["[[ ", normalizeExpr(node.expr), " ]]"];

		case "import": {
			const at = node.at ? ` at "${node.at}"` : "";
			return [`[% import "${node.uri}" as "${node.as}"${at} %]`];
		}

		case "include":
			return [`[% include ${node.target} %]`];

		case "for":
			return [
				`[% for ${node.var} in ${normalizeExpr(node.expr)} %]`,
				indent([
					hardline,
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endfor %]",
			];

		case "let":
			return [
				`[% let ${node.var} = ${normalizeExpr(node.expr)} %]`,
				indent([
					hardline,
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endlet %]",
			];

		case "if": {
			const parts = [
				`[% if ${normalizeExpr(node.expr)} %]`,
				indent([
					hardline,
					join(
						"",
						node.consequent.map((n) => printNode(n, options)),
					),
				]),
			];
			for (const alt of node.alternates) {
				if (alt.type === "elif") {
					parts.push(
						hardline,
						`[% elif ${normalizeExpr(alt.expr)} %]`,
					);
					parts.push(
						indent([
							hardline,
							join(
								"",
								alt.body.map((n) => printNode(n, options)),
							),
						]),
					);
				} else if (alt.type === "else") {
					parts.push(hardline, "[% else %]");
					parts.push(
						indent([
							hardline,
							join(
								"",
								alt.body.map((n) => printNode(n, options)),
							),
						]),
					);
				}
			}
			parts.push(hardline, "[% endif %]");
			return parts;
		}

		case "block": {
			const order = node.order ? ` ${node.order}` : "";
			return [
				`[% block ${node.name}${order} %]`,
				indent([
					hardline,
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endblock %]",
			];
		}

		case "template": {
			const overwrite = node.overwrite ? "!" : "";
			const order = node.order ? ` ${node.order}` : "";
			return [
				`[% template${overwrite} ${node.name}${order} %]`,
				indent([
					hardline,
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endtemplate %]",
			];
		}

		default:
			return "";
	}
}

// ---------------------------------------------------------------------------
// Prettier plugin API
// ---------------------------------------------------------------------------

const plugin = {
	languages: [
		{
			name: "Jinks Template",
			parsers: ["jinks-templating"],
			extensions: [".tpl"],
			vscodeLanguageIds: ["jinks-template"],
		},
	],

	parsers: {
		"jinks-templating": {
			parse(text) {
				const tokens = tokenize(text);
				return parse(tokens);
			},
			astFormat: "jinks-templating",
			locStart() {
				return 0;
			},
			locEnd() {
				return 0;
			},
		},
	},

	printers: {
		"jinks-templating": {
			print(path, options) {
				const node = path.node ?? path.getValue();
				return printNode(node, options);
			},

			embed(path, options) {
				const node = path.node ?? path.getValue();
				if (node.type !== "text") return null; // only embed on text nodes

				// Infer host parser from file extension
				const fp = options.filepath ?? "";
				const hostExt = fp
					.replace(/\.tpl(\.\w+)?$/, "$1")
					.replace(/^\./, "");
				const parserMap = {
					html: "html",
					xql: "xquery", // requires prettier-plugin-xquery
					xqm: "xquery",
					css: "css",
					scss: "scss",
					js: "babel",
				};
				const parser = parserMap[hostExt];
				if (!parser) return null;

				// Prettier embed API: return a function that formats the text content
				return async (textToDoc, print, node, options) => {
					// The challenge: TEXT nodes are fragments, not complete programs.
					// They need to be assembled, formatted as a whole, then re-split.
					// This requires formatting at the ROOT level, not per TEXT node.
					return null; // placeholder
				};
			},
		},
	},
};

module.exports = plugin;
