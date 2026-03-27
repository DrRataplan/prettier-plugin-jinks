import { type Options, doc, type Doc } from "prettier";
import type { Node, RootNode } from "./parser.ts";
import { TokenTypes } from "./Token.ts";

const { hardline, indent, join } = doc.builders;

export default function printNode(
	node: Node | RootNode,
	options: Options,
): Doc {
	switch (node.type) {
		case "root":
			return join(
				"",
				node.body.map((n) => printNode(n, options)),
			);

		case TokenTypes.FRONTMATTER: {
			let fm = node.value.trim();
			try {
				fm = JSON.stringify(
					JSON.parse(fm),
					null,
					options.useTabs ? "\t`" : options.tabWidth,
				);
			} catch {
				// not valid JSON — leave as-is
			}
			return ["---json", hardline, fm, hardline, "---", hardline];
		}

		case TokenTypes.COMMENT:
			return ["[#", node.value, "#]"];

		case TokenTypes.TEXT:
			if (node.value.trim() === "") {
				return "";
			}
			return node.value.replaceAll(/\n[\t ]*(\n|$)/gm, "\n\n").trimEnd();

		case TokenTypes.RAW:
			return ["[% raw %]", node.value, "[% endraw %]"];

		case TokenTypes.VALUE:
			// TODO: Embed into XQuery here
			return ["[[ ", node.expr, " ]]"];

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
			return [
				hardline,
				`[% for ${node.var} in ${node.expr} %]`,
				indent([
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endfor %]",
			];

		case TokenTypes.LET:
			return [
				hardline,
				`[% let ${node.var} = ${node.expr} %]`,
				indent([
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endlet %]",
			];

		case TokenTypes.IF: {
			const parts = [
				hardline,
				`[% if ${node.expr} %]`,
				indent([
					join(
						"",
						node.consequent.map((n) => printNode(n, options)),
					),
				]),
			] as Doc[];
			for (const alt of node.alternates) {
				if (alt.type === TokenTypes.ELIF) {
					parts.push(hardline, `[% elif ${alt.expr} %]`);
					parts.push(
						indent([
							join(
								"",
								alt.body.map((n) => printNode(n, options)),
							),
							hardline,
						]),
					);
				} else if (alt.type === TokenTypes.ELSE) {
					parts.push(hardline, "[% else %]");
					parts.push(
						indent([
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

		case TokenTypes.BLOCK: {
			const order = node.order ? ` ${node.order}` : "";
			let body: Doc;
			if (
				node.body.length === 0 ||
				(node.body.length === 1 &&
					node.body[0]?.type === TokenTypes.TEXT &&
					node.body[0].value.trim() === "")
			) {
				body = "";
			} else {
				body = [
					indent([
						join(
							"",
							node.body.map((n) => printNode(n, options)),
						),
					]),
					hardline,
				];
			}
			return [`[% block ${node.name}${order} %]`, body, "[% endblock %]"];
		}

		case TokenTypes.TEMPLATE: {
			const order = node.order ? ` ${node.order}` : "";
			return [
				`[% template ${node.name}${order} %]`,
				indent([
					join(
						"",
						node.body.map((n) => printNode(n, options)),
					),
				]),
				hardline,
				"[% endtemplate %]",
			];
		}

		case TokenTypes.TEMPLATE_OVERRIDE: {
			const order = node.order ? ` ${node.order}` : "";
			return [
				`[% template! ${node.name}${order} %]`,
				indent([
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
