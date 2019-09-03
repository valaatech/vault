// @flow

export function mintVPath (...segments) {
  return `@${segments.map(_mintVPathSegment).join("@")}@`;
}

function _mintVPathSegment (segment, index) {
  if (typeof segment === "string") {
    return segment[0] === "$"
        ? validateVGRId(segment)
        : validateVerb(segment, index);
  }
  if (!Array.isArray(segment)) {
    throw new Error(`Invalid segment #${index} while minting: must be a string or Array, got ${
      typeof segment}`);
  }
  if (segment[0] !== "$") {
    // verb
    return mintVerb(...segment);
  }
  // vgrid
  if (index) {
    throw new Error(`Invalid segment #${index} while minting:${
      ""} expected verb (is not first segment), got vgrid ("$" as first segment element)`);
  }
  return mintVGRId(...segment.slice(1));
}

export function mintVGRId (formatTerm: string, paramElement: any,
    ...params: (string | ["$", string, ?string])) {
  validateFormatTerm(formatTerm);
  const paramValue = mintParamValue(paramElement);
  if (!paramValue) throw new Error(`Invalid vgrid: param-value missing`);
  return `$${formatTerm}:${paramValue}${params.map(mintParam).join("")}`;
}

export function mintVerb (verbType, ...params: (string | ["$", string, ?string])[]) {
  validateVerbType(verbType);
  return `${verbType}${params.map(mintParam).join("")}`;
}

export function mintParam (paramElement: (string | ["$", string, ?string]), index, params) {
  let ret;
  if (typeof paramElement === "string") {
    ret = validateVParam(paramElement);
  } else if (Array.isArray(paramElement) && (paramElement[0] === "$")) {
    if (paramElement[1]) validateContextTerm(paramElement[1]);
    const value = mintParamValue(paramElement[2]);
    ret = !paramElement[1] ? `:${value}`
        : !value ? `$${paramElement[1]}`
        : `$${paramElement[1]}:${value}`;
  } else {
    throw new Error(`Invalid paramElement #${index
        }: expected a string or a param Array with "$" as first element`);
  }
  if ((ret[0] !== "$") && index) {
    const prevParam = params[index - 1];
    if ((typeof prevParam === "string") ? !prevParam.contains(":") : !prevParam[2]) {
      return `$${ret}`;
    }
  }
  return ret;
}

export function mintParamValue (value) {
  if ((value === undefined) || (value === "")) return value;
  if (typeof value === "string") return encodeURIComponent(value);
  if (value === null) throw new Error(`Invalid param-value null`);
  if (!Array.isArray(value)) throw new Error(`Invalid param-value with type ${typeof value}`);
  if (value[0] !== "@") {
    throw new Error(`Invalid param-value: expanded vpath production must begin with "@"`);
  }
  return mintVPath(...value.slice(1));
}

export function validateVPath (element) {
  const isVRId = (typeof element === "string") ? (element[1] === "$")
      : Array.isArray(element) ? (element[1][0] === "$")
      : undefined;
  if (isVRId === undefined) {
    throw new Error(`Invalid vpath: must be a string or Array with length > 1`);
  }
  return isVRId
      ? validateVRId(element)
      : validateVerbs(element);
}

export function validateVRId (element) {
  const [firstEntry, vgrid, ...verbs] = expandVPath(element);
  if (firstEntry !== "@") {
    throw new Error(`Invalid vrid: expected "@" as first entry`);
  }
  validateVGRId(vgrid);
  verbs.forEach(validateVerb);
  return element;
}

export function validateVerbs (element) {
  const [firstEntry, ...verbs] = expandVPath(element);
  if (firstEntry !== "@") {
    throw new Error(`Invalid verbs: expected "@" as first entry`);
  }
  verbs.forEach(validateVerb);
  return element;
}

export function validateVGRId (element) {
  const [firstEntry, formatTerm, paramValue, ...params] = expandVPath(element);
  if (firstEntry !== "$") {
    throw new Error(`Invalid vgrid: expected "$" as first entry`);
  }
  validateFormatTerm(formatTerm);
  validateParamValueText(paramValue);
  params.forEach(validateVParam);
  return element;
}

export function validateFormatTerm (element) {
  return validateContextTerm(element);
}

export function validateVerb (element) {
  const [verbType, ...params] = expandVPath(element);
  validateVerbType(verbType);
  params.forEach(validateVParam);
  return element;
}

export function validateVerbType (str) {
  if (typeof str !== "string") throw new Error("Invalid verb-type: not a string");
  if (!str.match(/[a-zA-Z0-9\-_.~!*'()]+/)) {
    throw new Error(`Invalid verb-type: doesn't match rule${
      ""} 1*(ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}

export function validateVParam (element: any[]) {
  const [firstEntry, contextTerm, paramValue] =
      (typeof element !== "string") ? element : expandVPath(element);
  if (firstEntry !== "$") {
    throw new Error(`Invalid vparam: expected "$" as first entry`);
  }
  if (contextTerm !== undefined) {
    if (typeof contextTerm !== "string") {
      throw new Error(`Invalid vparam: context-term must be undefined or a string`);
    }
    if (contextTerm !== "") validateContextTerm(contextTerm);
  }
  if (paramValue !== undefined) {
    if (typeof paramValue === "string") {
      if (paramValue[0] === "@") validateVPath(paramValue);
      else validateParamValueText(paramValue);
    } else if (Array.isArray(paramValue)) {
      validateVPath(paramValue);
    } else {
      throw new Error(`Invalid vparam:${
        ""} param-value must be undefined, string or an array containing an expanded vpath`);
    }
  }
  return element;
}

export function validateContextTerm (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term: not a string");
  if (!str.match(/[a-zA-Z][a-zA-Z0-9\-_.]*/)) {
    throw new Error(`Invalid context-term: doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

export function validateContextTermNS (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term-ns: not a string");
  if (!str.match(/[a-zA-Z]([a-zA-Z0-9\-_.]{0,30}[a-zA-Z0-9])?/)) {
    throw new Error(`Invalid context-term: doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

export function validateParamValueText (str) {
  if (typeof str !== "string") throw new Error("Invalid param-value: not a string");
  if (!str.match(/([a-zA-Z0-9\-_.~!*'()]|%[0-9a-fA-F]{2})+/)) {
    throw new Error(`invalid param-value: doesn't match rule${
      ""} 1*("%" HEXDIG HEXDIG |${
      ""} ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}

/**
 * Parse a given VPath into a nested array structure.
 *
 * This nested array has following constraints:
 * 1. All the nested entries are either arrays, non-empty strings, or
 * 1.1. If the given VPath is an array vrid with embedded non-string,
 *      non-array values then those values appear as-is.
 * 2. Concatenating the nested array strings yields the original VPath.
 *    VPath arrays with embedded values cannot be reconstructed.
 * 3. Each nested array represents some VPath element.
 *    ref("@valos/raem/VPath#section_element")
 * 3. The first and last entry of each element determines its type.
 * 3.1. An element with "@" as the first entry is a 'vpath' element.
 * 3.1.1. All other 'vpath' entries are 'verb' elements, except that:
 * 3.1.2. the second 'vpath' entry can be a 'vgrid' element.
 * 3.2. An element with "$" or ":" as the first and "@" as the last
 *      entry is a 'vgrid' element.
 * 3.3. An element with non-("@"|"$"|":") as the first and "@" as the
 *      last entry is a 'verb' element.
 * 3.3.1. All verb element entries between the first and the last are
 *        'verb-param' elements.
 * 3.4. An element with "$" or ":" as first and non-"@" as the last
 *      entry is a 'verb-param' element.
 * 3.5. An entry that follows an "$" is a 'context-term' string value.
 * 3.6. An entry that follows an ":" is either a 'vgrid-value' or
 *      'verb-value' value depending on whether the containing element
 *      is a 'vgrid' or 'verb-param' element.
 * 3.6.1. A 'vgrid-value' entry is a string.
 * 3.6.2. A 'verb-value' that is a string contains a decoded value.
 *   - all pct-encoded elements are decoded as javascript UCS-2 strings.
 * 3.6.3. A 'verb-value' that is an array is a 'vpath' element.
 *
 * @export
 * @param {*} vpath
 * @returns
 */
export function expandVPath (vpath) {
  if (Array.isArray(vpath) && (vpath[0] === "@" || vpath[0] === "$" || !vpath[0].match(/[$:]/))) {
    // already an expanded vpath element.
    // Only re-expand possibly flattened sub-elements.
    return vpath.map(e => ((typeof e === "string") ? e : expandVPath(e)));
  }
  const vpathArray = [];
  for (const part of Array.isArray(vpath) ? vpath : [vpath]) {
    if (Array.isArray(part)) {
      vpathArray.push(expandVPath(part));
    } else if (typeof part === "string"
        && (part !== "") && (part !== "@") && (part !== "$") && (part !== ":")) {
      vpathArray.push(...part.split(/(@|\$|:)/).filter(e => e !== ""));
    } else {
      vpathArray.push(part);
    }
  }
  return _nestAll(vpathArray);
}

function _nestAll (vpathArray, start = 0) {
  let segmentStart = start;
  if (vpathArray[start] === "@") ++segmentStart;
  for (let i = segmentStart; i !== vpathArray.length; ++i) {
    const element = vpathArray[i];
    if (Array.isArray(element)) {
      if (segmentStart !== i) continue;
      if (vpathArray[i + 1] !== "@") {
        throw new Error(`Invalid vpath embedded element at #${i}:${
          ""} expected '@' separator at #${i + 1}`);
      }
      if (element[0] === "@") {
        throw new Error(`Invalid vpath embedded element at #${i}:${
          ""} expected embedded vgrid or verb element (got a vpath beginning with "@")`);
      }
      vpathArray.splice(i + 1, 1);
    } else if ((typeof element !== "string") || (element !== "@")) {
      continue;
    } else if (vpathArray[i - 1] === ":") { // nest deeper, this is a vpath as param-value
      vpathArray.splice(i, 0, _nestAll(vpathArray, i));
      continue;
    } else {
      const segment = vpathArray.splice(segmentStart, i + 1 - segmentStart);
      segment.pop();
      if (segment[0] === ":") {
        throw new Error(`Invalid vpath: neither vgrid nor verb cannot begin with ':'`);
      }
      if (segment[0] === "$") { // vgrid
        segment.splice(2, 1); // drop the ":"
      } else { // verb
        _nestSegment(segment);
      }
      vpathArray.splice(segmentStart, 0, segment);
    }
    i = ++segmentStart;
    if (i === vpathArray.length) return vpathArray;
    if ((vpathArray[i] === "@") || (vpathArray[i] === "$") || (vpathArray[i] === ":")) {
      return vpathArray.splice(start, i - start);
    }
    --i;
  }
  if (vpathArray[start] !== "@") {
    _nestSegment(vpathArray);
  } else if (start) {
    throw new Error(`Invalid vpath element:${
      ""} missing closing "@" (opening "@" is at non-zero location ${start})`);
  }
  return vpathArray;
}

function _nestSegment (segment, initial = 1) {
  for (let i = initial; i !== segment.length; ++i) {
    let nested;
    if (segment[i] === "$") {
      if (segment[i + 2] !== ":") {
        nested = segment.splice(i, 2);
      } else {
        nested = segment.splice(i, 4);
        nested.splice(2, 1);
      }
      validateContextTerm(nested[1]);
    } else if (segment[i] === ":") {
      nested = ["$", "", segment[i + 1]];
      segment.splice(i, 2);
    } else continue;
    const verbValue = nested[2];
    if (typeof verbValue === "string") {
      validateParamValueText(verbValue);
      nested[2] = decodeURIComponent(verbValue);
    } else if (verbValue != null && (!Array.isArray(verbValue) || (verbValue[0] !== "@"))) {
      throw new Error(`Invalid expanded param-value:${
        ""} must be a vpath element array (ie. must have "@" as first entry)`);
    }
    segment.splice(i, 0, nested);
  }
}