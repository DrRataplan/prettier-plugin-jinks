import type { AstPath, Doc, Options, Printer } from "prettier";
import * as prettier from "prettier";
import parse from "./parser.ts";
import type { Node, RootNode } from "./parser.ts";
import { TokenTypes } from "./Token.ts";
import tokenize from "./tokenize.ts";
import printNode from "./printNode.ts";

/**
 * Prettier plugin for jinks template files (.tpl.*)
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
 *   [# comment #]        - comment
 *   ---json ... ---      - frontmatter
 */

type LangConfig = {
	parser: string;
	wrap: (id: string) => string;
	re: RegExp;
};

// Comment-style placeholders that survive host-language formatting unchanged.
// CSS formatters add spaces inside /* */, so the regex allows for that.
const LANG_MAP: Record<string, LangConfig> = {
	xq: {
		parser: "xquery",
		wrap: (id) => `(:${id}:)`,
		re: /\(:\s*(JINKS_\d+)\s*:\)/g,
	},
	xql: {
		parser: "xquery",
		wrap: (id) => `(:${id}:)`,
		re: /\(:\s*(JINKS_\d+)\s*:\)/g,
	},
	xqm: {
		parser: "xquery",
		wrap: (id) => `(:${id}:)`,
		re: /\(:\s*(JINKS_\d+)\s*:\)/g,
	},
	html: {
		parser: "html",
		wrap: (id) => `<!--${id}-->`,
		re: /<!--(JINKS_\d+)-->/g,
	},
	css: {
		parser: "css",
		wrap: (id) => `/*${id}*/`,
		re: /\/\*\s*(JINKS_\d+)\s*\*\//g,
	},
	scss: {
		parser: "scss",
		wrap: (id) => `/*${id}*/`,
		re: /\/\*\s*(JINKS_\d+)\s*\*\//g,
	},
	js: {
		parser: "js",
		wrap: (id) => `/*${id}*/`,
		re: /\/\*\s*(JINKS_\d+)\s*\*\//g,
	},
};

function hostLang(filepath: string): LangConfig | undefined {
	// "foo.tpl.html" → "html",  "foo.tpl" → ""
	const ext = filepath.replace(/^.*\.tpl\.?/, "");
	return LANG_MAP[ext];
}

const printer: Printer = {
	print(path: AstPath, options) {
		return printNode(path.node, options);
	},

	embed(path: AstPath, options: Options) {
		// Embed only fires at the root — we reconstruct the full document and
		// format it as a whole so the host parser sees complete, valid code.
		if ((path.node as RootNode).type !== "root") return null;
		const lang = hostLang(options.filepath ?? "");
		if (!lang) return null;

		return async (_textToDoc, _print, path, options) => {
			const root = path.node as RootNode;

			// --- Phase 1: serialize AST → host-language source with placeholders ---
			//
			// Template structural tags (FOR, IF, LET, BLOCK, …) are replaced with
			// comment-style placeholders so the host parser sees valid syntax.
			// VALUE nodes ([[ expr ]]) stay in-place as literal text — they're
			// valid inside HTML attributes and CSS custom property values.

			const tags: string[] = [];

			function ph(tag: string): string {
				const id = `JINKS_${tags.length}`;
				tags.push(tag);
				return lang!.wrap(id);
			}

			function ser(node: Node): string {
				switch (node.type) {
					case TokenTypes.TEXT:
						return node.value;
					case TokenTypes.VALUE:
						return `[[ ${node.expr} ]]`;
					case TokenTypes.COMMENT:
						return ph(`[#${node.value}#]`);
					case TokenTypes.RAW:
						return ph(`[% raw %]${node.value}[% endraw %]`);
					case TokenTypes.FRONTMATTER:
						return ph(`---json\n${node.value.trim()}\n---`);
					case TokenTypes.INCLUDE:
						return ph(`[% include ${node.target} %]`);
					case TokenTypes.IMPORT: {
						const at = node.at ? ` at "${node.at}"` : "";
						return ph(
							`[% import "${node.uri}" as "${node.as}"${at} %]`,
						);
					}
					case TokenTypes.FOR:
						return (
							ph(`[% for ${node.var} in ${node.expr} %]`) +
							node.body.map(ser).join("") +
							ph(`[% endfor %]`)
						);
					case TokenTypes.LET:
						return (
							ph(`[% let ${node.var} = ${node.expr} %]`) +
							node.body.map(ser).join("") +
							ph(`[% endlet %]`)
						);
					case TokenTypes.IF: {
						let s =
							ph(`[% if ${node.expr} %]`) +
							node.consequent.map(ser).join("");
						for (const alt of node.alternates) {
							if (alt.type === TokenTypes.ELIF) {
								s +=
									ph(`[% elif ${alt.expr} %]`) +
									alt.body.map(ser).join("");
							} else {
								s +=
									ph(`[% else %]`) +
									alt.body.map(ser).join("");
							}
						}
						return s + ph(`[% endif %]`);
					}
					case TokenTypes.BLOCK: {
						const order = node.order ? ` ${node.order}` : "";
						return (
							ph(`[% block ${node.name}${order} %]`) +
							node.body.map(ser).join("") +
							ph(`[% endblock %]`)
						);
					}
					case TokenTypes.TEMPLATE: {
						const order = node.order ? ` ${node.order}` : "";
						return (
							ph(`[% template ${node.name}${order} %]`) +
							node.body.map(ser).join("") +
							ph(`[% endtemplate %]`)
						);
					}
					case TokenTypes.TEMPLATE_OVERRIDE: {
						const order = node.order ? ` ${node.order}` : "";
						return (
							ph(`[% template! ${node.name}${order} %]`) +
							node.body.map(ser).join("") +
							ph(`[% endtemplate %]`)
						);
					}
					default:
						return "";
				}
			}

			const reconstructed = root.body.map(ser).join("");

			// --- Phase 2: format with host parser ---

			const formatted = await prettier.format(reconstructed, {
				...options,
				parser: lang.parser,
				// Exclude ourselves to avoid infinite recursion
				plugins: ((options as any).plugins ?? []).filter(
					(p: any) => p !== plugin,
				),
			});

			// --- Phase 3: split at placeholders, weave template tags back in ---
			//
			// Some host formatters (e.g. XQuery) add blank lines around comments.
			// Those blank lines bake into TEXT nodes and accumulate on each pass.
			// We collapse them at the boundary of every placeholder insertion so
			// the output is stable: one newline adjacent to each template tag,
			// interior blank lines within host content are left untouched.

			const parts = formatted.split(lang.re);
			// split() with a capturing group alternates: text, id, text, id, …
			const out: string[] = [];
			for (let i = 0; i < parts.length; i++) {
				if (i % 2 === 0) {
					let text = parts[i]!;
					// After a placeholder: collapse leading blank lines to one \n
					if (i > 0) text = text.replace(/^\n([ \t]*\n)+/, "\n");
					// Before a placeholder: collapse trailing blank lines to one \n
					if (i < parts.length - 1)
						text = text.replace(/\n([ \t]*\n)+$/, "\n");
					out.push(text);
				} else {
					// parts[i] is the captured id, e.g. "JINKS_3"
					out.push(tags[parseInt(parts[i]!.slice(6))]!);
				}
			}

			// Return the assembled string as a Doc (strings are valid Docs in prettier).
			return out.join("") as Doc;
		};
	},
};

const plugin: prettier.Plugin = {
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
			parse(text: string) {
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
		"jinks-templating": printer,
	},
};

export default plugin;
