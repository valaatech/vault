// @flow

import { mintVerb, expandVPath } from "~/raem";
import patchWith from "~/tools/patchWith";

export const ObjectSchema = Symbol("Object-JSONSchema");
export const CollectionSchema = Symbol("Array-JSONSchema");

// export const EmailType = { type: "email" };
export const EmailType = { type: "string" };
export const BooleanType = { type: "boolean" };
export const StringType = { type: "string" };
export const XWWWFormURLEncodedStringType = { type: "string" };
export const NumberType = { type: "number" };
// export const URIReferenceType = { type: "uri-reference" };
export const URIReferenceType = { type: "string" };

export const UnixEpochSecondsType = { type: "number" };
/*
export const DateExtendedISO8601Type = { type: "date" };
export const TimeExtendedISO8601Type = { type: "time" };
export const ZoneExtendedISO8601Type = { type: "string" };
export const DateTimeZoneExtendedISO8601Type = { type: "date-time" };
*/
export const DateExtendedISO8601Type = { type: "string", format: "date" };
export const TimeExtendedISO8601Type = { type: "string" };
export const ZoneExtendedISO8601Type = { type: "string" };
export const DateTimeZoneExtendedISO8601Type = { type: "string", format: "date-time" };

export const IdValOSType = {
  type: "string",
  pattern: "^[a-zA-Z0-9\\-_.~]+$",
  valospace: { projection: [".$V:rawId"] },
};
// export const ReferenceValOSType = { type: "uri" };
export const ReferenceValOSType = { type: "string" };

export const $VType = {
  [ObjectSchema]: { valospace: { /* projection: "" */ } },
  id: IdValOSType,
  // name: StringType, // internal ValOS name
};

export const ResourceType = {
  $V: $VType,
};

export function namedResourceType (schemaName, baseTypes, schema) {
  return patchWith({},
      [].concat(
          baseTypes || [], {
            [ObjectSchema]: { schemaName },
            $V: $VType,
          },
          schema),
      { patchSymbols: true, concatArrays: false });
}

export function extendType (baseTypes, schema) {
  return patchWith({}, [].concat(baseTypes || [], schema));
}

export function mappingToOneOf (mappingName, aTargetType, relationNameOrProjection,
    options = {}) {
  if (!options[ObjectSchema]) options[ObjectSchema] = {};
  options[ObjectSchema].valospace = {
    ...(options[ObjectSchema].valospace || {}),
    mappingName,
  };
  return relationToOneOf(aTargetType, relationNameOrProjection, options);
}

export function mappingToManyOf (mappingName, aTargetType, relationNameOrProjection,
    options = {}) {
  if (!options[CollectionSchema]) options[CollectionSchema] = {};
  options[CollectionSchema].valospace = {
    ...(options[CollectionSchema].valospace || {}),
    mappingName,
  };
  return relationToManyOf(aTargetType, relationNameOrProjection, options);
}

export function relationToOneOf (aTargetType, relationNameOrProjection, options = {}) {
  if (options[CollectionSchema] !== undefined) {
    throw new Error("Must not specify options[CollectionSchema] for a Relation-to-one type");
  }
  return _createRelationTypeTo(aTargetType, relationNameOrProjection, options);
}

export function relationToManyOf (aTargetType, relationNameOrProjection, options = {}) {
  if (options[CollectionSchema] === undefined) options[CollectionSchema] = {};
  return _createRelationTypeTo(aTargetType, relationNameOrProjection, options);
}

export function getBaseRelationTypeOf (anAnyRelationType, schemaPatch) {
  const actualRelationType = (typeof anAnyRelationType === "function")
      ? anAnyRelationType()
      : anAnyRelationType;
  return patchWith({
    ...actualRelationType,
    [ObjectSchema]: actualRelationType[ObjectSchema],
    [CollectionSchema]: undefined,
  }, schemaPatch || []);
}

export function enumerateMappingsOf (aResourceType) {
  return [].concat(...Object.values(aResourceType).map(property => {
    const actualProperty = (typeof property !== "function") ? property : property();
    const outermostSchema = (actualProperty != null)
        && (actualProperty[CollectionSchema] || actualProperty[ObjectSchema]);
    if (!outermostSchema) return [];
    const mappingName = (outermostSchema.valospace || {}).mappingName;
    if (mappingName) return [[mappingName, actualProperty]];
    return enumerateMappingsOf(actualProperty);
  }));
}

export function sharedSchemaOf (aType) {
  const schemaName = aType[ObjectSchema].schemaName;
  if (!schemaName) {
    throw new Error("Type[ObjectSchema].schemaName missing when trying to get a shared Type");
  }
  const schema = generateSchemaOf(aType);
  schema.$id = schemaName;
  return schema;
}

export function trySchemaNameOf (aType) {
  return ((aType || {})[ObjectSchema] || {}).schemaName
      && `${aType[ObjectSchema].schemaName}#`;
}

export function schemaRefOf (aType) {
  return trySchemaNameOf(aType) || generateSchemaOf(aType);
}

function _createRelationTypeTo (aTargetType, relationNameOrProjection, {
    [CollectionSchema]: collectionSchema,
    [ObjectSchema]: objectSchema = {},
    ...relationProperties
} = {}) {
  const projection = (typeof relationNameOrProjection === "string")
      ? mintVerb("*out", ["$", "", relationNameOrProjection])
      : expandVPath(relationNameOrProjection);
  const ret = {
    [CollectionSchema]: collectionSchema && { ...collectionSchema },
    [ObjectSchema]: { ...objectSchema },
    $V: {
      [ObjectSchema]: {
        valospace: {
          TargetType: aTargetType,
        },
      },
      href: {
        ...URIReferenceType,
        // valospace: { projection: "" }, // not yet
      },
      rel: {
        ...StringType,
        // valospace: { projection: "" }, // not yet
      },
    },
    ...relationProperties,
  };
  const outermost = ret[CollectionSchema] || ret[ObjectSchema];
  outermost.valospace = {
    ...(outermost.valospace || {}),
    projection,
  };
  return ret;
}

export function generateSchemaOf (aType) {
  if (typeof aType === "function") return generateSchemaOf(aType());
  if ((aType == null) || (typeof aType !== "object") || (Array.isArray(aType))) return aType;
  const ret = {};
  let current = ret;
  if (aType[CollectionSchema]) {
    Object.assign(current, aType[CollectionSchema]);
    delete current.TargetType;
    current.type = "array";
    current.items = {};
    current = current.items;
  }
  if (aType[ObjectSchema]) {
    Object.assign(current, aType[ObjectSchema]);
    current.type = "object";
    current = current.properties = {};
  }
  for (const [key, value] of Object.entries(aType)) {
    current[key] = schemaRefOf(value);
  }
  if (ret.valospace) {
    ret.valospace = { ...ret.valospace };
    if (ret.valospace.TargetType) {
      ret.valospace.TargetType = schemaRefOf(ret.valospace.TargetType);
    }
    if (ret.valospace.projection) {
      ret.valospace.projection = expandVPath(ret.valospace.projection);
    }
    if (ret.valospace.gate) {
      ret.valospace.gate = {
        ...ret.valospace.gate,
        injection: expandVPath(ret.valospace.gate.injection),
      };
    }
  }
  return ret;
}
