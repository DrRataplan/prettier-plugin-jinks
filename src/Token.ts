// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------
export const TokenTypes = {
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
	TEMPLATE_OVERRIDE: "TEMPLATE_OVERRIDE",
	ENDTEMPLATE: "ENDTEMPLATE",
	IMPORT: "IMPORT",
	RAW: "RAW",
	FRONTMATTER: "FRONTMATTER",
	COMMENT: "COMMENT",
} as const;

export namespace TokenType {
	export type TokenType =
		| TEXT
		| VALUE
		| FOR
		| ENDFOR
		| LET
		| ENDLET
		| IF
		| ELIF
		| ELSE
		| ENDIF
		| INCLUDE
		| BLOCK
		| ENDBLOCK
		| TEMPLATE
		| TEMPLATE_OVERRIDE
		| ENDTEMPLATE
		| IMPORT
		| RAW
		| FRONTMATTER
		| COMMENT;

	export type TEXT = "TEXT";
	export type VALUE = "VALUE";
	export type FOR = "FOR";
	export type ENDFOR = "ENDFOR";
	export type LET = "LET";
	export type ENDLET = "ENDLET";
	export type IF = "IF";
	export type ELIF = "ELIF";
	export type ELSE = "ELSE";
	export type ENDIF = "ENDIF";
	export type INCLUDE = "INCLUDE";
	export type BLOCK = "BLOCK";
	export type ENDBLOCK = "ENDBLOCK";
	export type TEMPLATE = "TEMPLATE";
	export type TEMPLATE_OVERRIDE = "TEMPLATE_OVERRIDE";
	export type ENDTEMPLATE = "ENDTEMPLATE";
	export type IMPORT = "IMPORT";
	export type RAW = "RAW";
	export type FRONTMATTER = "FRONTMATTER";
	export type COMMENT = "COMMENT";
}
