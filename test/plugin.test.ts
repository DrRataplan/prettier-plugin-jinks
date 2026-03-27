import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as prettier from "prettier";
import plugin from "../src/main.ts";

import xqueryPlugin from "prettier-plugin-xquery";

function asset(name: string): string {
	return readFileSync(join(import.meta.dirname, "assets", name), "utf8");
}

const snapshotFile = (test: string): string =>
	join(import.meta.dirname, "assets", "snapshots", test);

async function format(text: string, filepath: string): Promise<string> {
	return prettier.format(text, {
		parser: "jinks-templating",
		plugins: [plugin, xqueryPlugin],
		filepath,
	});
}

describe("Prettier plugin roundtrip", () => {
	it("HTML template is idempotent", async (t) => {
		const input = asset("example.tpl.html");
		const pass1 = await format(input, "example.tpl.html");
		const pass2 = await format(pass1, "example.tpl.html");

		t.assert.fileSnapshot(pass1, snapshotFile("example.tpl.html"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("HTML template with prolog is idempotent", async (t) => {
		const input = asset("documentation.html");
		const pass1 = await format(input, "documentation.html");
		const pass2 = await format(pass1, "documentation.html");

		t.assert.fileSnapshot(pass1, snapshotFile("documentation.html"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("HTML template with article is idempotent", async (t) => {
		const input = asset("base.html");
		const pass1 = await format(input, "base.html");
		const pass2 = await format(pass1, "base.html");

		t.assert.fileSnapshot(pass1, snapshotFile("base.html"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("XQL template is idempotent", async (t) => {
		const input = asset("example.tpl.xql");
		const pass1 = await format(input, "example.tpl.xql");
		const pass2 = await format(pass1, "example.tpl.xql");

		t.assert.fileSnapshot(pass1, snapshotFile("example.tpl.xql"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("Complex XQL template is idempotent", async (t) => {
		const input = asset("api.tpl.xql");
		const pass1 = await format(input, "api.tpl.xql");
		const pass2 = await format(pass1, "api.tpl.xql");

		t.assert.fileSnapshot(pass1, snapshotFile("api.tpl.xql"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("Complex XQL template with groups is idempotent", async (t) => {
		const input = asset("generated-config.tpl.xql");
		const pass1 = await format(input, "generated-config.tpl.xql");
		const pass2 = await format(pass1, "generated-config.tpl.xql");

		t.assert.fileSnapshot(pass1, snapshotFile("generated-config.tpl.xql"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("Complex JS template is idempotent", async (t) => {
		const input = asset("search.tps.js");
		const pass1 = await format(input, "search.tps.js");
		const pass2 = await format(pass1, "search.tps.js");

		t.assert.fileSnapshot(pass1, snapshotFile("search.tps.js"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});

	it("CSS template is idempotent", async (t) => {
		const input = asset("example.tpl.css");
		const pass1 = await format(input, "example.tpl.css");
		const pass2 = await format(pass1, "example.tpl.css");

		t.assert.fileSnapshot(pass1, snapshotFile("example.tpl.css"), {
			serializers: [(value: string) => value],
		});
		assert.equal(pass2, pass1);
	});
});
