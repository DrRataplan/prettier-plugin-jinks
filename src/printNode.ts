import { type AstPath, type Options, doc, type Doc } from "prettier";
import type { Node, RootNode } from "./parser.ts";
import { TokenTypes } from "./Token.ts";

const { hardline, indent, join } = doc.builders;

type PrintFn = (path: AstPath) => Doc;

export default function printNode(
	path: AstPath,
	options: Options,
	print: PrintFn,
): Doc {
	const node = path.node as Node | RootNode;

	switch (node.type) {
		case "root":
			return [join("", path.map(print, "body")), hardline];

		case TokenTypes.XQEXPR:
			// embed() handles XQuery formatting; this is the synchronous fallback
			return node.value;

		case TokenTypes.FRONTMATTER: {
			let fm = node.value.trim();
			try {
				fm = JSON.stringify(
					JSON.parse(fm),
					null,
					options.useTabs ? "\t" : options.tabWidth,
				);
			} catch {
				// not valid JSON — leave as-is
			}
			return [
				hardline,
				"---json",
				hardline,
				fm,
				hardline,
				"---",
				hardline,
			];
		}

		case TokenTypes.COMMENT:
			return ["[#", node.value, "#]"];

		case TokenTypes.TEXT:
			if (node.value.trim() === "") return "";
			return node.value.replaceAll(/\n[\t ]*(\n|$)/gm, "\n\n").trimEnd();

		case TokenTypes.RAW:
			return ["[% raw %]", node.value, "[% endraw %]"];

		case TokenTypes.VALUE:
			// embed() handles XQuery formatting; this is the synchronous fallback
			return ["[[ ", path.call(print, "expr"), " ]]"];

		case TokenTypes.IMPORT: {
			const at = node.at ? ` at "${node.at}"` : "";
			return [
				`[% import "${node.uri}" as "${node.as}"${at} %]`,
				hardline,
			];
		}

		case TokenTypes.INCLUDE:
			return [`[% include ${node.target} %]`];

		case TokenTypes.FOR:
			// embed() handles XQuery formatting; this is the synchronous fallback
			return [
				hardline,
				"[% for ",
				node.var,
				" in ",
				path.call(print, "expr"),
				" %]",
				indent([join("", path.map(print, "body"))]),
				hardline,
				"[% endfor %]",
			];

		case TokenTypes.LET:
			// embed() handles XQuery formatting; this is the synchronous fallback
			return [
				hardline,
				"[% let ",
				node.var,
				" = ",
				path.call(print, "expr"),
				" %]",
				indent([join("", path.map(print, "body"))]),
				hardline,
				"[% endlet %]",
			];

		case TokenTypes.IF:
			// embed() handles XQuery formatting; this is the synchronous fallback
			return [
				hardline,
				"[% if ",
				path.call(print, "expr"),
				" %]",
				indent([join("", path.map(print, "consequent"))]),
				...path.map(print, "alternates"),
				hardline,
				"[% endif %]",
			];

		// ELIF and ELSE are Alternate nodes reached via path.map(print, "alternates") in IF
		case TokenTypes.ELIF:
			// embed() handles XQuery formatting; this is the synchronous fallback
			return [
				hardline,
				"[% elif ",
				path.call(print, "expr"),
				" %]",
				indent([join("", path.map(print, "body")), hardline]),
			];

		case TokenTypes.ELSE:
			return [
				hardline,
				"[% else %]",
				indent([join("", path.map(print, "body"))]),
			];

		case TokenTypes.BLOCK: {
			const order = node.order ? ` ${node.order}` : "";
			const isEmpty =
				node.body.length === 0 ||
				(node.body.length === 1 &&
					node.body[0]?.type === TokenTypes.TEXT &&
					node.body[0].value.trim() === "");
			if (isEmpty) {
				return [
					hardline,
					`[% block ${node.name}${order} %]`,
					"[% endblock %]",
				];
			}
			return [
				hardline,
				`[% block ${node.name}${order} %]`,
				indent([join("", path.map(print, "body"))]),
				hardline,
				"[% endblock %]",
			];
		}

		case TokenTypes.TEMPLATE: {
			const order = node.order ? ` ${node.order}` : "";
			return [
				`[% template ${node.name}${order} %]`,
				indent([join("", path.map(print, "body"))]),
				hardline,
				"[% endtemplate %]",
			];
		}

		case TokenTypes.TEMPLATE_OVERRIDE: {
			const order = node.order ? ` ${node.order}` : "";
			return [
				`[% template! ${node.name}${order} %]`,
				indent([join("", path.map(print, "body"))]),
				hardline,
				"[% endtemplate %]",
			];
		}

		default:
			return "";
	}
}
