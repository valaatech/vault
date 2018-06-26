/*
# ValOS style guide

The ValOS style is defined via a union of formal machine readable rules in files listed below and
the informal human readable rules inside comments.
Files specifying formal style rules:
- @valos/toolset-vault/shared/.eslintrc.js
- @valos/toolset-vault/templates/.editorconfig

Note: While ValOS style is formally based on airbnb style in practice it has diverged notably.

## Informal rules

### Formatting non-structured inline documentation in CLI contexts

One of the two options must be used for newlines in individual
documentation pieces:
1. manually line-break with max 71 characters per line.
2. only separate paragraphs and leave line-breaking to the CLI tool.

The tool itself is recommended to be consistent with the choice over
all pieces.
*/

module.exports = {
  "parser": "babel-eslint",
  "extends": "airbnb", // With two major exceptions: double quotes and space before paren in function definition
  "env": {
    "browser": true,
    "node": true
  },
  "globals": {
    "jest": false,
    "FEATURES": false,
    "describe": false,
    "afterEach": false,
    "it": false,
    "expect": false,
    "beforeEach": false,
    "xit": false
  },
  "ecmaFeatures": {
    "modules": true
  },
  "plugins": [
    "flowtype"
  ],

  "rules": {
    // ## Major exceptions to AirBnB style

    // These are the exceptions with larger impact and thus ones with more thought and rationale.

    // We often use leading underscore for private methods/variables
    "no-underscore-dangle": [0],

    // Flow of a source file when read top-down should be top-down also structurally: high level,
    // entry point functions should be at the top and their implementation detail functions below
    // them. So we allow calling of those implementation functions before they're defined.
    "no-use-before-define": [0],

    // Double quotes are immediately compatible with hyphens (like "it's'") which arguable are more
    // common in human readable strings. As we have es6 features avilable, template literals
    // (`foo ${myVariable}`) cover all other use cases and is a better fit when generating code and
    // other machine processed text anyway.
    "quotes": [2, "double", {"avoidEscape": true, "allowTemplateLiterals": true}],

    // Differentiating call-sites and definition is useful for non-content-aware searching.
    "space-before-function-paren": [2, "always"],


    // ## Minor exceptions to AirBnB style

    // These exceptions are more of convenience, might have weaker or even obsolete reasons and thus
    // are subject to change more easily.

    "arrow-parens": 0,
    "class-methods-use-this": 0,
    "comma-dangle": [0],
    "global-require": 0, // Usage some techniques require require (no pun intended)
    "new-cap": [0], // eslint doesn't recognize decorator mixins as classes
    "newline-per-chained-call": 0, // VALK kueries like .nullable() don't need newline
    "no-continue": 0,
    "no-console": [0], // 2 for prod, maybe?
    "no-nested-ternary": [0], // chaining ternaries for inline-switching while questionable is common in our codebase
    "no-param-reassign": [2, { "props": false }],
    "no-plusplus": 0,
    "no-prototype-builtins": 0, // We're using meta operations relatively commonly
    "object-property-newline": 0,
    "one-var": 0, // 'let foo, bar, baz;' for pre-declaring variables outside try-blocks so that they are available for debug output in catch-blocks
    "one-var-declaration-per-line": 0, // same as above

    "import/extensions": 0,
    "import/no-dynamic-require": 0, // Too many infrastructure tools use dynamic requires to warrant putting selective disables aroudn
    "import/no-extraneous-dependencies": 0,
    "import/no-unresolved": 0,
    "import/prefer-default-export": 0, // lambda's and flow often necessitate a single named export

    // ## Warning directives

    "complexity": ["warn", 20],
    "no-warning-comments": ["warn", { "terms": ["fixme"], "location": "anywhere" }]
  },
  "settings": {
    "import/resolver": "babel-plugin-root-import"
  }
};