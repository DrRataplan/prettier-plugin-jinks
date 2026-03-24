import { describe, it } from "node:test";
import parse from "../src/parser.ts";
import tokenize from "../src/tokenize.ts";
import assert from "node:assert/strict";
import { type TokenType, TokenTypes } from "../src/Token.ts";

function assertType<T extends TokenType.TokenType>(
	actual: TokenType.TokenType,
	expected: T,
): asserts actual is T {
	assert.equal(actual, expected);
}

describe("parser", () => {
	it("plain text becomes root > text", () => {
		const ast = parse(tokenize("<p>hello</p>"));
		assert.equal(ast.type, "root");
		assert.equal(ast.body[0].type, TokenTypes.TEXT);
	});

	it("for loop nests body correctly", () => {
		const ast = parse(
			tokenize("[% for $x in $items %]<li>[[ $x ]]</li>[% endfor %]"),
		);
		const forNode = ast.body[0];
		assertType(forNode.type, TokenTypes.FOR);
		assert.equal(forNode.var, "$x");
		assert.equal(forNode.expr, "$items");
		assert.equal(forNode.body.length, 3); // text, value, text
		assert.equal(forNode.body[1].type, TokenTypes.VALUE);
	});

	it("let binding nests body correctly", () => {
		const ast = parse(
			tokenize("[% let $x = expr() %]<p>[[ $x ]]</p>[% endlet %]"),
		);
		const letNode = ast.body[0];
		assertType(letNode.type, TokenTypes.LET);
		assert.equal(letNode.var, "$x");
		assert.equal(letNode.body[1].type, TokenTypes.VALUE);
	});

	it("if with else produces alternates array", () => {
		const ast = parse(tokenize("[% if $a %]yes[% else %]no[% endif %]"));
		const ifNode = ast.body[0];
		assertType(ifNode.type, TokenTypes.IF);

		assertType(ifNode.consequent[0].type, TokenTypes.TEXT);
		assert.equal(ifNode.consequent[0].value, "yes");
		assertType(ifNode.alternates[0].type, TokenTypes.ELSE);
		assertType(ifNode.alternates[0].body[0].type, TokenTypes.TEXT);
		assert.equal(ifNode.alternates[0].body[0].value, "no");
	});

	it("if with elif produces alternates array", () => {
		const ast = parse(
			tokenize("[% if $a %]a[% elif $b %]b[% elif $c %]c[% endif %]"),
		);

		const ifNode = ast.body[0];

		assertType(ifNode.type, TokenTypes.IF);
		assert.equal(ifNode.alternates.length, 2);
		assertType(ifNode.alternates[0].type, TokenTypes.ELIF);
		assert.equal(ifNode.alternates[0].expr, "$b");
		assertType(ifNode.alternates[1].type, TokenTypes.ELIF);
		assert.equal(ifNode.alternates[1].expr, "$c");
	});

	it("nested for inside if", () => {
		const ast = parse(
			tokenize(
				"[% if $items %][% for $x in $items %][[ $x ]][% endfor %][% endif %]",
			),
		);
		const ifNode = ast.body[0];
		assertType(ifNode.type, TokenTypes.IF);
		const forNode = ifNode.consequent[0];
		assertType(forNode.type, TokenTypes.FOR);
		assert.equal(forNode.body[0].type, TokenTypes.VALUE);
	});

	it("block node", () => {
		const ast = parse(tokenize("[% block content %]<main/>[% endblock %]"));
		const block = ast.body[0];
		assertType(block.type, TokenTypes.BLOCK);
		assert.equal(block.name, "content");
		assert.equal(block.body[0].type, TokenTypes.TEXT);
	});

	it("template node with overwrite", () => {
		const ast = parse(
			tokenize("[% template! header %]<h1/>[% endtemplate %]"),
		);
		const tmpl = ast.body[0];
		assertType(tmpl.type, TokenTypes.TEMPLATE_OVERRIDE);
		assert.equal(tmpl.name, "header");
	});

	it("template node without overwrite", () => {
		const ast = parse(
			tokenize("[% template header %]<h1/>[% endtemplate %]"),
		);
		const tmpl = ast.body[0];
		assertType(tmpl.type, TokenTypes.TEMPLATE);
		assert.equal(tmpl.name, "header");
	});

	it("import node at root level", () => {
		const ast = parse(
			tokenize('[% import "http://example.com" as "ex" %]<div/>'),
		);
		assertType(ast.body[0].type, TokenTypes.IMPORT);
		assertType(ast.body[1].type, TokenTypes.TEXT);
	});

	it("raw node content is preserved", () => {
		const ast = parse(tokenize("[% raw %][[ escaped ]][% endraw %]"));
		assertType(ast.body[0].type, TokenTypes.RAW);
		assert.equal(ast.body[0].value, "[[ escaped ]]");
	});
});
