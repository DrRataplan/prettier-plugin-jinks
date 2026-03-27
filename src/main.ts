import type { AstPath, Options, Printer } from "prettier";
import * as prettier from "prettier";
import parse from "./parser.ts";
import type { Node, RootNode, XQExprNode } from "./parser.ts";
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
		re: /\(:\s*(JINKS_SPECIAL_\d+)\s*:\)/g,
	},
	xql: {
		parser: "xquery",
		wrap: (id) => `(:${id}:)`,
		re: /\(:\s*(JINKS_SPECIAL_\d+)\s*:\)/g,
	},
	xqm: {
		parser: "xquery",
		wrap: (id) => `(:${id}:)`,
		re: /\(:\s*(JINKS_SPECIAL_\d+)\s*:\)/g,
	},
	html: {
		parser: "html",
		wrap: (id) => `<!--${id}-->`,
		re: /<!--(JINKS_SPECIAL_\d+)-->/g,
	},
	css: {
		parser: "css",
		wrap: (id) => `/*${id}*/`,
		re: /\/\*\s*(JINKS_SPECIAL_\d+)\s*\*\//g,
	},
	scss: {
		parser: "scss",
		wrap: (id) => `/*${id}*/`,
		re: /\/\*\s*(JINKS_SPECIAL_\d+)\s*\*\//g,
	},
	js: {
		parser: "js",
		wrap: (id) => `/*${id}*/`,
		re: /\/\*\s*(JINKS_SPECIAL_\d+)\s*\*\//g,
	},
};

function hostLang(filepath: string): LangConfig | undefined {
	// "foo.tpl.html" → "html"
	const tplExt = filepath.replace(/^.*\.tpl\.?/, "");
	if (tplExt !== filepath) {
		return LANG_MAP[tplExt];
	}
	// Plain extension fallback: "foo.html" → "html"
	const ext = filepath.split(".").pop() ?? "";
	return LANG_MAP[ext];
}

const printer: Printer = {
	print(path: AstPath, options, print) {
		return printNode(path, options, print);
	},

	embed(path: AstPath, options: Options) {
		const node = path.node as Node | RootNode;

		//  Root node with a host language.

		// The tricky thing is that only the whole document is valid in the host
		// language. It is common to use a for loop over switch cases. A lone
		// case is invalid in XQuery

		// Split up the file into TEXT (aka host language) and JINKS. Interleave
		// the JINKS parts, do a host format and assign the TEXT parts into the
		// jinks ast again
		if (node.type === "root") {
			const lang = hostLang(options.filepath ?? "");
			if (!lang) {
				// Unknown file type.
				return null;
			}

			return async (_textToDoc, print, path, options) => {
				const root = path.node as RootNode;

				// Phase 1: build placeholder source from AST

				// TEXT nodes are emitted verbatim; all Jinks tags become placeholders.
				// Each TEXT node records `segIdx` (the count of placeholders emitted
				// before it), which maps it to parts[segIdx * 2] after split.

				const textEntries: Array<{
					node: { value: string };
					segIdx: number;
				}> = [];
				let counter = 0;

				function ph(): string {
					return lang!.wrap(`JINKS_SPECIAL_${counter++}`);
				}

				function buildSource(nodes: Node[]): string {
					let out = "";
					for (const n of nodes) {
						if (n.type === TokenTypes.TEXT) {
							textEntries.push({ node: n, segIdx: counter });
							out += n.value;
						} else {
							switch (n.type) {
								case TokenTypes.VALUE:
								case TokenTypes.COMMENT:
								case TokenTypes.RAW:
								case TokenTypes.FRONTMATTER:
								case TokenTypes.INCLUDE:
								case TokenTypes.IMPORT:
									out += ph();
									break;
								case TokenTypes.FOR:
									out += ph();
									out += buildSource(n.body);
									out += ph();
									break;
								case TokenTypes.LET:
									out += ph();
									out += buildSource(n.body);
									out += ph();
									break;
								case TokenTypes.IF:
									out += ph();
									out += buildSource(n.consequent);
									for (const alt of n.alternates) {
										out += ph();
										out += buildSource(alt.body);
									}
									out += ph();
									break;
								case TokenTypes.BLOCK:
								case TokenTypes.TEMPLATE:
								case TokenTypes.TEMPLATE_OVERRIDE:
									out += ph();
									out += buildSource(n.body);
									out += ph();
									break;
							}
						}
					}
					return out;
				}

				const source = buildSource(root.body);

				// Phase 2: format with host parser

				const formatted = await prettier.format(source, {
					...options,
					parser: lang.parser,
					plugins: ((options as any).plugins ?? []).filter(
						(p: any) => p !== plugin,
					),
				});

				// Phase 3: assign formatted text segments back to TEXT nodes

				// split(re) with a capturing group gives [text, id, text, id, ..., text].
				// The TEXT node with segIdx k owns parts[k * 2].
				// Collapse extra blank lines that some host formatters insert around
				// comment placeholders.

				const parts = formatted.split(lang.re);
				for (const { node: textNode, segIdx } of textEntries) {
					let text = parts[segIdx * 2] ?? "";
					if (segIdx > 0) {
						text = text.replace(/^\n([ \t]*\n)+/, "\n");
					}
					textNode.value = text;
				}

				// Phase 4: print AST with updated TEXT values

				// printNode handles Jinks tag formatting; XQEXPR embed handles XQ
				// expression formatting (no separate pre-format phase needed).

				const { join } = prettier.doc.builders;
				return join("", path.map(print, "body"));
			};
		}

		// XQEXPR node
		// Fires when printNode traverses via path.call(print, "expr").
		if (node.type === TokenTypes.XQEXPR) {
			return async (textToDoc, _print, path, options) => {
				const n = path.node as XQExprNode;
				try {
					return await textToDoc(n.value.trim(), {
						...options,
						parser: "xquery",
					});
				} catch (e) {
					// Oops! XQuery error! rethrow.
					throw e;
				}
			};
		}

		return null;
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
				// TODO
				return 0;
			},
			locEnd() {
				// TODO
				return 0;
			},
		},
	},

	printers: {
		"jinks-templating": printer,
	},
};

export default plugin;
