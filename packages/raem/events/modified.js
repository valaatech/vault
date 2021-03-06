// @flow

import Action, { validateActionBase } from "~/raem/events/Action";
import VRL, { invariantifyId, invariantifyTypeName } from "~/raem/VRL";

import { invariantifyObject, invariantifyArray } from "~/tools/invariantify";

export const FIELDS_SET = "FIELDS_SET";
export const ADDED_TO = "ADDED_TO";
export const REMOVED_FROM = "REMOVED_FROM";
export const REPLACED_WITHIN = "REPLACED_WITHIN";

class Modified extends Action {
  type: "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN";

  id: mixed;
  typeName: string;
}

export class FieldsSet extends Modified {
  type: "FIELDS_SET";
  sets: ?Object;
}

export class AddedTo extends Modified {
  type: "ADDED_TO";
  adds: Object;
}

export class RemovedFrom extends Modified {
  type: "REMOVED_FROM";
  removes: Object;
}

export class ReplacedWithin extends Modified {
  type: "REPLACED_WITHIN";
}

function _validateModifiedBase (expectedType: string, action: Action,
    id: string | VRL, typeName: string, rest: Object): Modified {
  validateActionBase(expectedType, action, rest);

  invariantifyId(id, `${expectedType}.id`, {});
  invariantifyTypeName(typeName, `${expectedType}.typeName`, {});
  return action;
}

/**
 * For Map/object type properties
 * sets = { property: value, ... }
 */
export function fieldsSet (action: Action): FieldsSet {
  action.type = FIELDS_SET;
  return validateFieldsSet(action);
}

export function validateFieldsSet (action: Action): FieldsSet {
  const { id, typeName, sets, ...rest } = action;
  _validateModifiedBase(FIELDS_SET, action, id, typeName, rest);

  invariantifyObject(sets, "FIELDS_SET.sets", {
    allowEmpty: true,
    elementInvariant: (value, key) => key && (typeof key === "string"),
  }, "\n\taction:", action);
  return action;
}

/**
 * For Set type properties.
 * If an added entry already exists in the target set it is implicitly removed before adding it
 * back. Because the sets are ordered by their insertion this has the
 * intended effect of moving the added entry to the end of the sequence. Thus the iteration of the
 * target field will contain the adds as a strict sub-sequence. An existing entry which is in this
 * way only reordered will not cause coupling updates and will not otherwise be visible as a new
 * addition.
 * This means that ADDED_TO can be used to reorder sequences by adding the whole sequence in the
 * newly desired order. This does not allow removal of entries however; see REPLACED_WITHIN for
 * the fully generic replacement as combination of REMOVED_FROM and ADDED_TO.
 * adds: { property: value, ... } or { property: [ value1, value2, ...], ... }
 */
export function addedTo (action: Action): AddedTo {
  action.type = ADDED_TO;
  return validateAddedTo(action);
}

export function validateAddedTo (action: Action): AddedTo {
  const { id, typeName, adds, ...rest } = action;
  _validateModifiedBase(ADDED_TO, action, id, typeName, rest);

  invariantifyObject(adds, `ADDED_TO.adds`, {
    allowEmpty: true,
    elementInvariant: (value, key) => key
        && (typeof key === "string")
        && invariantifyArray(value, `ADDED_TO.adds['${key}'], with:`,
            {},
            "\n\taction.adds:", action.adds,
            "\n\taction:", action)
  }, "\n\taction:", action);
  return action;
}

// TODO(iridian): This API is horrible. Fix it.
/**
 * For Set type properties
 * adds: { property: value, ... } or { property: [ value1, value2, ...], ... }
 */
export function removedFrom (action: Action): RemovedFrom {
  action.type = REMOVED_FROM;
  return validateRemovedFrom(action);
}

export function validateRemovedFrom (action: Action): RemovedFrom {
  const { id, typeName, removes, ...rest } = action;
  _validateModifiedBase(REMOVED_FROM, action, id, typeName, rest);

  invariantifyObject(removes, `REMOVED_FROM.removes`, {
    allowEmpty: true,
    elementInvariant: (value, key) => key
        && (typeof key === "string")
        && invariantifyArray(value, `REMOVED_FROM.removes['${key}'], with:`,
            { allowNull: true },
            "\n\taction.removes:", action.removes,
            "\n\taction:", action)
  }, "\n\taction:", action);
  return action;
}

/**
 * REPLACED_WITHIN is semantically an alias for a REMOVED_FROM followed by an ADDED_TO.
 * This combination allows the replacement of any arbitrary subset of values with an arbitrary
 * ordered set.
 * The removes and adds sequences must be disjoint; all entries in the adds are considered
 * implicitly removed as per ADDED_TO semantics.
 */
export function replacedWithin (action: Action): ReplacedWithin {
  action.type = REPLACED_WITHIN;
  return validateReplacedWithin(action);
}

export function validateReplacedWithin (action: Action): ReplacedWithin {
  const { id, typeName, removes, adds, ...rest } = action;
  _validateModifiedBase(REPLACED_WITHIN, action, id, typeName, rest);

  invariantifyObject(removes, `REPLACED_WITHIN.removes`, {
    allowEmpty: true,
    elementInvariant: (value, key) => key
        && (typeof key === "string")
        && invariantifyArray(value, `REPLACED_WITHIN.removes['${key}'], with:`,
            { allowNull: true },
            "\n\taction.removes:", action.removes,
            "\n\taction:", action)
  }, "\n\taction:", action);
  invariantifyObject(adds, `REPLACED_WITHIN.adds`, {
    allowEmpty: true,
    elementInvariant: (value, key) => key
        && (typeof key === "string")
        && invariantifyArray(value, `REPLACED_WITHIN.adds['${key}'], with:`,
            {},
            "\n\taction.adds:", action.adds,
            "\n\taction:", action)
  }, "\n\taction:", action);

  return action;
}
