const vdocExtractee = require("@valos/vdoc/extractee");
const { outputError } = require("@valos/tools/wrapError");

const { aggregate, blockquote, c, cpath, em, ref, strong } = vdocExtractee;

module.exports = {
  ...vdocExtractee,

  /**
   * Construct a VRevdoc:ABNF element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  example () {
    return {
      "@type": "VRevdoc:Example",
      "VDoc:content": [].slice.call(arguments), // eslint-disable-line prefer-rest-params
    };
  },

  /**
   * Construct a VRevdoc:ABNF element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  abnf (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c(text, { language: "https://tools.ietf.org/html/rfc5234" }),
      "@type": "VRevdoc:ABNF",
    };
  },

  /**
   * Construct a VRevdoc:JSONLD element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  jsonld (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c(text, { language: "https://www.w3.org/TR/json-ld11/" }),
      "@type": "VRevdoc:JSONLD",
    };
  },

  /**
   * Construct a VRevdoc:ABNF element.
   *
   * @param {*} text
   * @param {*} rest
   * @returns
   */
  turtle (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c(text, { language: "https://www.w3.org/TR/turtle/" }),
      "@type": "VRevdoc:Turtle",
    };
  },

  vsx (text) {
    // Add validation and maybe restructuring?
    return {
      // TODO(iridian, 2019-08): Figure out if there's any sense in
      // providing language identifiers for non-natural languages.
      ...c(text, { language: "https://valospace.org/inspire/Lens/#VSX" }),
      "@type": "VRevdoc:VSX",
    };
  },

  /**
   * Construct VRevdoc:dfn element.
   *
   * @param {*} text
   * @param {*} definitionId
   * @param {*} explanation
   * @returns
   */
  dfn (text, definitionId, ...explanation) {
    return aggregate({
      "VRevdoc:dfn": definitionId,
      "VDoc:content": [strong(ref(text, definitionId))],
    }, "VDoc:content", ...explanation);
  },

  /**
   * Construct VRevdoc:Package reference element.
   *
   * @param {*} packageName
   * @param {*} rest
   * @returns
   */
  pkg (packageName, ...rest) {
    return {
      ...ref(em(packageName), packageName, ...rest),
      "@type": "VRevdoc:Package",
    };
  },

  /**
   * Construct VRevdoc:Command reference element.
   *
   * @param {*} packageName
   * @param {*} rest
   * @returns
   */
  command (commandName) {
    return {
      ...cpath(commandName),
      "@type": "VRevdoc:Command",
    };
  },

  /**
   * Construct VRevdoc:Invokation element.
   * Splits and spreads parts strings by whitespaces and if the first
   * part is a string wraps it in a VRevdoc:Command if it is a string.
   *
   *
   * @param {*} parts
   * @returns
   */
  invokation (...parts) {
    return {
      "@type": "VRevdoc:Invokation",
      "VDoc:words": [].concat(...parts.map(
              part => (typeof part !== "string" ? [part] : part.split(/(\s+)/))))
          .filter(w => (typeof w !== "string") || !w.match(/^\s+$/))
          .map((w, i) => ((i || typeof w !== "string") ? w : module.exports.command(w))),
    };
  },

  inv6n (...parts) { return module.exports.invokation(...parts); },

  /**
   * Construct VRevdoc:CommandLineInteraction rows element.
   *
   * @param {*} rows
   * @returns
   */
  cli (...rows) {
    const commandedRows = rows.map(line => ((typeof line !== "string")
        ? line
        : module.exports.invokation(line)));
    let currentContext = "";
    const interactions = [];
    for (const row of commandedRows) {
      if (row == null) continue;
      const firstEntry = Array.isArray(row) ? row[0] : row;
      switch (firstEntry["@type"]) {
        case "VDoc:ContextBase":
          currentContext = firstEntry;
          continue;
        case "VDoc:ContextPath":
        case "VRevdoc:Command":
        case "VRevdoc:Invokation":
          if (firstEntry["VDoc:context"] === undefined) {
            firstEntry["VDoc:context"] = currentContext;
          }
          break;
        default:
      }
      interactions.push([row]);
    }
    return {
      "@type": "VRevdoc:CommandLineInteraction",
      "VDoc:lines": interactions,
    };
  },

  tooltip (content, tooltipContent) {
    return {
      "@type": "VRevdoc:Tooltip",
      "VDoc:content": Array.isArray(content) ? content : [content],
      "VRevdoc:tooltipContent": tooltipContent,
    };
  },

  filterKeysWithAnyOf (entryFieldName, searchedValueOrValues = [], container) {
    return filterKeysWithFieldReduction(entryFieldName, searchedValueOrValues, container,
        (a, [field, searched]) => a || field.includes(searched));
  },

  filterKeysWithAllOf (entryFieldName, searchedValueOrValues = [], container) {
    return filterKeysWithFieldReduction(entryFieldName, searchedValueOrValues, container,
        (a, [field, searched]) => a && field.includes(searched), true);
  },

  filterKeysWithNoneOf (entryFieldName, searchedValueOrValues = [], container) {
    return filterKeysWithFieldReduction(entryFieldName, searchedValueOrValues, container,
        (a, [field, searched]) => a && !field.includes(searched), true);
  },

  valosRaemFieldClasses: [
    "VState:Field",
    "VState:Field", "VState:EventLoggedField", "VState:CoupledField",
    "VState:GeneratedField", "VState:TransientField", "VState:AliasField",
  ],

  filterKeysWithFieldReduction,

  prepareTestDoc (title) {
    const tests = [];
    return {
      itExpects (named, operations, toSatisfy, result) {
        if (!named) return {};
        tests.push([named, operations, toSatisfy, result]);
        return {
          "dc:title": named,
          "#0": [
            ...[].concat(operations)
                .map(extractExampleText)
                .map((bodyText, index) => [index ? "via" : "we expect", blockquote(c(bodyText))]),
            toSatisfy,
            blockquote(c(extractExampleText(result))),
          ],
        };
      },
      runTestDoc () {
        if (typeof describe !== "undefined") {
          describe(`testdoc: ${title}`, () => {
            for (const [named, operations, toSatisfy, result] of tests) {
              it(named, async () => {
                try {
                  const actual = await [].concat(operations).reduce(async (a, op) => {
                    const ra = await a;
                    return op(typeof ra === "function" ? ra() : ra);
                  });
                  expect(typeof actual === "function" ? await actual() : actual)[toSatisfy](
                      typeof result === "function" ? await result() : result);
                } catch (error) {
                  outputError(error, `Exception noted while running testdoc test ${named}`);
                  throw error;
                }
              });
            }
          });
        }
      }
    };
  },

  extractExampleText,
};

function extractExampleText (example) {
  if (typeof example === "function") {
    const bodyText = example.toString();
    return bodyText.slice(
        Math.min(bodyText.indexOf("{") !== -1 ? bodyText.indexOf("{") : bodyText.length,
            bodyText.indexOf(">") !== -1 ? bodyText.indexOf(">") : bodyText.length) + 1,
        Math.max(bodyText.lastIndexOf("}"), bodyText.length));
  }
  return JSON.stringify(example, null, 2);
}

function filterKeysWithFieldReduction (entryFieldName, searchedValueOrValues, container,
    reduction, initial) {
  const searchedValues = [].concat(
      searchedValueOrValues !== undefined ? searchedValueOrValues : []);
  return Object.entries(container)
      .filter(([, entry]) => searchedValues
          .reduce((a, searchedValue) => reduction(a, [
            [].concat(entry[entryFieldName] !== undefined ? entry[entryFieldName] : []),
            searchedValue,
          ]), initial))
      .map(([key]) => key);
}
