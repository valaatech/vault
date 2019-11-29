Object.defineProperty(exports, "__esModule", { value: true });

const inBrowser = require("../gateway-api/inBrowser").default;
const getGlobal = require("../gateway-api/getGlobal").default;

const { thenChainEagerly } = require("./thenChainEagerly");
const { wrapError } = require("./wrapError");

const _cache = {};

exports.default = function fetchJSON (input, options) {
  return _cache[input] || (_cache[input] = thenChainEagerly({ ...options }, [
    function performFetch (innerOptions) {
      const fetch = getGlobal().fetch;
      if (!fetch) {
        throw new Error(`window/global.fetch is missing; if running in a non-browser ${
            ""}environment please execute through perspire gateway (or similar)`);
      }
      if (!input) throw new Error(`missing fetchJSON input`);
      if (!inBrowser() && (innerOptions.crossOrigin === undefined)) {
        innerOptions.crossOrigin = false;
      }
      if (innerOptions.body && (typeof innerOptions.body === "object")) {
        innerOptions.body = JSON.stringify(innerOptions.body);
        innerOptions.headers = {
          ...(innerOptions.headers || {}),
          "Content-Type": "application/json",
        };
      }
      return fetch(input, innerOptions);
    },
    function extractJSON (response) {
      if (response.status >= 400) {
        const error = new Error(`fetch response ${response.status} for ${
          (options || {}).method || "GET"} ${input}: ${response.statusText}`);
        error.response = response;
        throw error;
      }
      return (response.status === 204) ? undefined
          : response.json();
    },
    function clearCache (json) {
      delete _cache[input];
      return json;
    },
  ], function errorOnFetchJSON (error) {
    delete _cache[input];
    throw wrapError(error, `During fetchJSON(${input}), with:`,
        "\n\toptions:", options,
    );
  }));
};
