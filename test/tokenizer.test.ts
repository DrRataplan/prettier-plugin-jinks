import assert from "assert/strict";
import { it, describe } from "node:test";
import tokenize from "../src/tokenize.ts";
import { TokenTypes } from "../src/Token.ts";

describe("Tokenize", () => {
	it("plain text produces a single TEXT token", () => {
		const tokens = tokenize("<div>hello</div>");
		assert.equal(tokens.length, 1);
		assert.equal(tokens[0].type, "TEXT");
		assert.equal(tokens[0]!.value, "<div>hello</div>");
	});

	it("value interpolation [[ expr ]]", () => {
		const tokens = tokenize("Hello [[ $name ]]!");
		assert.equal(tokens.length, 3);
		assert.equal(tokens[1].type, "VALUE");
		assert.equal(tokens[1].expr.type, "XQEXPR");
		assert.equal(tokens[1].expr.value, "$name");
	});

	it("comment is stripped from output tokens", () => {
		const tokens = tokenize("before[# this is a comment #]after");
		const comment = tokens.find((t) => t.type === "COMMENT");
		assert.ok(comment, "COMMENT token should exist");
		assert.equal(comment.type, TokenTypes.COMMENT);
		assert.equal(comment.value, " this is a comment ");
	});

	it("for loop tokens", () => {
		const tokens = tokenize("[% for $doc in $documents %]x[% endfor %]");
		assert.equal(tokens[0].type, "FOR");
		assert.equal(tokens[0].var, "$doc");
		assert.equal(tokens[0].expr.type, "XQEXPR");
		assert.equal(tokens[0].expr.value, "$documents");
		assert.equal(tokens[2].type, "ENDFOR");
	});

	it("let binding tokens", () => {
		const tokens = tokenize("[% let $x = foo:bar($y) %]x[% endlet %]");
		assert.equal(tokens[0].type, "LET");
		assert.equal(tokens[0].var, "$x");
		assert.equal(tokens[0].expr.type, "XQEXPR");
		assert.equal(tokens[0].expr.value, "foo:bar($y)");
		assert.equal(tokens[2].type, "ENDLET");
	});

	it("if / elif / else / endif tokens", () => {
		const tokens = tokenize(
			"[% if $a %]a[% elif $b %]b[% else %]c[% endif %]",
		);
		assert.equal(tokens[0].type, "IF");
		assert.equal(tokens[0].expr.type, "XQEXPR");
		assert.equal(tokens[0].expr.value, "$a");
		assert.equal(tokens[2].type, "ELIF");
		assert.equal(tokens[2].expr.type, "XQEXPR");
		assert.equal(tokens[2].expr.value, "$b");
		assert.equal(tokens[3].type, "TEXT");
		assert.equal(tokens[3].value, "b");
		assert.equal(tokens[4].type, "ELSE");
		assert.equal(tokens[5].type, "TEXT");
		assert.equal(tokens[5].value, "c");
		assert.equal(tokens[6].type, "ENDIF");
	});

	it("block / endblock tokens", () => {
		const tokens = tokenize("[% block main %]content[% endblock %]");
		assert.equal(tokens[0].type, "BLOCK");
		assert.equal(tokens[0].name, "main");
		assert.equal(tokens[2].type, "ENDBLOCK");
	});

	it("template / endtemplate tokens", () => {
		const tokens = tokenize("[% template sidebar %]nav[% endtemplate %]");
		assert.equal(tokens[0].type, "TEMPLATE");
		assert.equal(tokens[0].name, "sidebar");
		assert.equal(tokens[2].type, "ENDTEMPLATE");
	});

	it("template! is differerent", () => {
		const tokens = tokenize("[% template! sidebar %]nav[% endtemplate %]");
		assert.equal(tokens[0].type, "TEMPLATE_OVERRIDE");
	});

	it("import token", () => {
		const tokens = tokenize(
			'[% import "http://example.com/api" as "api" at "modules/api.xql" %]',
		);
		assert.equal(tokens[0].type, "IMPORT");
		assert.equal(tokens[0].uri, "http://example.com/api");
		assert.equal(tokens[0].as, "api");
		assert.equal(tokens[0].at, "modules/api.xql");
	});

	it("import without at clause", () => {
		const tokens = tokenize(
			'[% import "http://example.com/api" as "api" %]',
		);
		assert.equal(tokens[0].type, "IMPORT");
		assert.equal(tokens[0].at, "");
	});

	it("include token", () => {
		const tokens = tokenize('[% include "partials/nav.html" %]');
		assert.equal(tokens[0].type, "INCLUDE");
		assert.equal(tokens[0].target, '"partials/nav.html"');
	});

	it("raw block preserves content verbatim", () => {
		const tokens = tokenize("[% raw %][[ not a template %][% endraw %]");
		assert.equal(tokens[0].type, "RAW");
		assert.equal(tokens[0].value, "[[ not a template %]");
	});

	it("frontmatter is parsed", () => {
		const tokens = tokenize('---json\n{"key": "value"}\n---\n<div/>');
		assert.equal(tokens[0].type, "FRONTMATTER");
		assert.ok(tokens[0].value.includes('"key"'));
	});

	it("multiple value interpolations in one line", () => {
		const tokens = tokenize("[[ $a ]] and [[ $b ]]");
		const values = tokens.filter((t) => t.type === "VALUE");
		assert.equal(values.length, 2);
		assert.equal(values[0].type, TokenTypes.VALUE);
		assert.equal(values[0].expr.type, "XQEXPR");
		assert.equal(values[0].expr.value, "$a");
		assert.equal(values[1].type, TokenTypes.VALUE);
		assert.equal(values[1].expr.type, "XQEXPR");
		assert.equal(values[1].expr.value, "$b");
	});
});
