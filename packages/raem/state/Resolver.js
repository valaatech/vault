// @flow

import { GraphQLSchema } from "graphql/type";

import ValaaReference, { obtainVRef, tryCoupledFieldFrom } from "~/raem/ValaaReference";
import type { JSONIdData, IdData, RawId, VRef } from "~/raem/ValaaReference"; // eslint-disable-line no-duplicate-imports
import type ValaaURI from "~/raem/ValaaURI";

import GhostPath from "~/raem/state/GhostPath";
import Transient, { createImmaterialTransient, createIdTransient }
    from "~/raem/state/Transient";
import type { FieldInfo, State } from "~/raem/state";
import { getObjectRawField } from "~/raem/state/getObjectField";

import { tryHostRef } from "~/raem/VALK/hostReference";

import { dumpObject, invariantify, invariantifyObject, invariantifyString, LogEventGenerator }
    from "~/tools";

import { _getFieldGhostElevation, _elevateReference } from "./FieldInfo";

/**
 * Resolver is a very low-level component for performing various
 * resolutions against a specific known state.
 *
 * Three main types of resolutions are:
 * 1. resolving ValaaReference's (VRef's) to find corresponding
 *    Transient's from the state
 * 2. binding external, possibly serialized VRef data to existing VRef
 *    objects with the same identity in the state
 * 3. resolving Transient field lookups, including ghost elevation
 *    proceduce
 *
 * All references in corpus state must be VRef's, and those VRef's must
 * be bound, meaning that the same conceptual reference uses the same
 * object and can thus be compared with '==='.
 * Binding means that before storing their target Transient is looked
 * up, and the VRef is replaced with that of the transient "id" field
 * (with appropriate coupledField). This enables both internal
 * consistency (no invalid references to void) as well as better
 * performance.
 *
 * @export
 * @class Resolver
 */
export default class Resolver extends LogEventGenerator {
  deserializeReference: (idData: IdData, originatingPartitionURI?: ValaaURI) => VRef;

  constructor (options: ?Object) {
    if (!options.name) options.name = "Resolver";
    super(options);
    this.state = options.state;
    this.schema = options.schema;
    if (!(this.schema instanceof GraphQLSchema)) {
      invariantifyObject(this.schema, `${this.getName()}.schema`, { instanceof: GraphQLSchema });
    }
  }

  schema: GraphQLSchema;

  obtainReference (params, originatingPartitionURI: ?ValaaURI) {
    return params
        && (tryHostRef(params)
            || (this._deserializeReference
                && this._deserializeReference(params, originatingPartitionURI))
            || obtainVRef(params, undefined, undefined, originatingPartitionURI || undefined));
  }

  setDeserializeReference (deserializeReference: Function) {
    this._deserializeReference = deserializeReference;
  }

  getSchema () { return this.schema; }
  getTypeIntro (typeName: string) {
    return this.schema.getType(typeName);
  }

  state: State;

  getState () { return this.state; }

  setState (state: State) {
    if (!state) invariantify(state, "state must be truthy");
    this.state = state;
    return this;
  }

  maybeForkWithState (state: ?State) {
    return !state || (state === this.state) ? this : Object.create(this).setState(state);
  }

  // object section
  objectTypeName: ?string;

  setObject (id: VRef, typeName: string) {
    this.objectId = id;
    this.objectTypeName = typeName;
  }

  tryStateTransient (rawId: string, typeName: string): Transient {
    let transientCandidate = this.state.getIn([typeName, rawId]);
    if (typeof transientCandidate === "string") {
      this.objectTypeName = transientCandidate;
      transientCandidate = this.state.getIn([transientCandidate, rawId]);
    }
    return transientCandidate;
  }


  /**
   * Returns a bound field-VRef object.
   * Similar to bindObjectId but sets the coupled field name for the returned field-VRef based
   * on given options and the given fieldRef.
   * Note that the mapping [corpus, rawId, coupledField] -> [fieldVRef1, fieldVRef2, ...] is not
   * unique so field VRef comparisons cannot be done using strict object equality.
   *
   * TODO(iridian): Add convenience for retrieving the associated id-VRef from a field-VRef.
   *
   * The rules for determining the coupled field:
   * 1. options.coupledField
   * 2. ref.coupledField
   * 3. options.defaultCoupledField
   * 4. null - the bound id reference is used directly
   *
   *
   * @param {JSONIdData} id
   * @param {any} [{ coupledField, defaultCoupledField }={}]    accepts a fieldInfo structure
   * @returns
   */
  bindFieldVRef (fieldRef: VRef | JSONIdData, fieldInfo: FieldInfo,
      contextPartitionURI?: ValaaURI) {
    const coupledField = fieldInfo.coupledField
        || tryCoupledFieldFrom(fieldRef)
        || fieldInfo.defaultCoupledField;
    const boundId = this.bindObjectId(fieldRef, "TransientFields", contextPartitionURI);
    return !coupledField ? boundId : boundId.coupleWith(coupledField);
  }

  /**
   * Returns a bound id-VRef object. Bound id means that the id VRef
   * object is retrieved from an existing resource 'id' property.
   * Binding gives three benefits:
   *
   * 1. it validates that the referred resource actually exists within
   *    the Corpus
   * 2. for commands going upstream the correct partition URI is made
   *    available
   * 3. it applies flyweight pattern on the non-trivial id VRef
   *    construct, improving performance
   *
   * Step 1. is pre-validation for upstream commands, but also serves
   * the purpose of catching corrupted events coming downstream from
   * the backend, offering an opportunity for escalating diagnostics
   * alarms.
   *
   * The mapping [corpus, rawId] -> id-VRef is unique (within single
   * state, see below), so VRef equality comparisons between bound id's
   * in the context of the corpus can use strict object equality. Note
   * that this only applies to id-VRef, ie. VRef's with undefined
   * coupledField.
   *
   * TODO(iridian): modify/construct variants/destroy don't actually
   * use bindObjectId but have their custom processes relying on
   * goToTransientOfRawId directly. This duplicate logic could be
   * simplified.
   *
   * @param {JSONIdData} id             serialized JSONIdData or plain VRef
   * @returns {VRef}
   */
  bindObjectId (idData: IdData, typeName: string, contextPartitionURI?: ValaaURI) {
    let object;
    let objectId = tryHostRef(idData);
    const rawId = objectId ? objectId.rawId()
        : Array.isArray(idData) ? idData[0]
        : (objectId = this.obtainReference(idData, contextPartitionURI)).rawId();
    try {
      object = this.tryStateTransient(rawId, typeName);
      // TODO(iridian): Evaluate if validating a bound id against the
      // reference idData (for partitions etc.) makes sense.
      if (object) return object.get("id");
      if (!objectId) objectId = this.obtainReference(idData, contextPartitionURI);

      // Immaterial ghost, inactive or fail
      // Inactive references might become active.
      if (objectId.isInactive()) return objectId;
      // Immaterial ghosts are not bound (although maybe the ghost path steps should be)
      if (objectId.isGhost()) return objectId;
      const partitionURI = objectId.getPartitionURI();
      if (!partitionURI) {
        throw new Error(`Cannot determine the partition of reference <${objectId
            }> to missing transient`);
      }
      this.warnEvent(`Cannot bind to non-existent non-ghost resource <${
            objectId}> inside active partition ${partitionURI}`,
          "\n\tlikely destroyed, marking reference as inactive",
          "\n\tduring passage:", ...dumpObject(this.passage));
      // TODO(iridian, 2019-01): Improve destroyed resource handling
      objectId.setInactive();
      return objectId;
    } catch (error) {
      throw this.wrapErrorEvent(error, `bindObjectId(${rawId || objectId || idData}:${typeName})`,
          "\n\tidData:", ...dumpObject(idData),
          "\n\tcontextPartitionURI:", ...dumpObject(contextPartitionURI),
          "\n\tobjectId candidate:", ...dumpObject(objectId),
          "\n\tobject:", ...dumpObject(object),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  objectTransient: Transient;
  objectId: VRef;

  goToTransient (id: VRef, typeName: string) {
    return this.tryGoToTransient(id, typeName, true, false);
  }

  tryGoToNonGhostTransient (id: VRef, typeName: string) {
    return this.tryGoToTransient(id, typeName, false, true);
  }

  goToNonGhostTransient (id: VRef, typeName: string) {
    return this.tryGoToTransient(id, typeName, true, true);
  }

  /**
   * tryGoToTransientOfRawId resolves a transient based on given
   * objectId and typeName.
   * this.objectId will be assigned the id of this transient.
   * If the requested resource is an immaterialized ghost then an
   * immaterialized temporary transient is created for it.
   *
   * @param {RawId} rawId
   * @param {string} [typeName]
   * @returns
   * @memberof Resolver
   */
  tryGoToTransient (objectId: VRef, typeName: string, require: ?boolean,
      nonGhostLookup: ?boolean, onlyMostMaterialized?: any, withOwnField?: string) {
    try {
      if (typeof typeName !== "string") {
        invariantifyString(typeName, "tryGoToTransient.typeName");
      }
      if (!(objectId instanceof ValaaReference)) {
        if (objectId || require) {
          throw new Error("tryGoToTransient.objectId must be a valid ValaaReference");
        }
        this.objectId = null;
        this.objectTypeName = null;
        return (this.objectTransient = null);
      }
      return this.tryGoToTransientOfRawId(objectId.rawId(), typeName, require,
          !nonGhostLookup && objectId.tryGhostPath(), onlyMostMaterialized, withOwnField, objectId);
    } catch (error) {
      throw this.wrapErrorEvent(error, "tryGoToTransient",
          "\n\tid:", ...dumpObject(objectId), ":", typeName,
          "\n\trequire:", require, ", nonGhostLookup:", nonGhostLookup);
    }
  }

  goToTransientOfRawId (rawId: RawId, typeName?: string, ghostPath?: GhostPath) {
    return this.tryGoToTransientOfRawId(rawId, typeName, true, ghostPath);
  }

  /**
   * tryGoToTransientOfRawId resolves a transient based on given rawId and
   * typeName and then it to this.objectTransient.
   * this.objectId will be assigned the id of this transient.
   * If the requested resource is an immaterialized ghost then an
   * immaterialized temporary transient is created for it.
   *
   * @param {RawId} rawId
   * @param {string} [typeName]
   * @returns
   * @memberof Resolver
   */
  tryGoToTransientOfRawId (rawId: RawId, typeName?: string, require?: boolean = false,
      ghostPath?: GhostPath, onlyMostMaterialized?: any, withOwnField?: string, objectId?: VRef) {
    try {
      if (typeName) this.objectTypeName = typeName;
      this.objectTransient = this.tryStateTransient(rawId, this.objectTypeName);
      if (this.objectTransient && (!withOwnField || this.objectTransient.has(withOwnField))) {
        this.objectId = this.objectTransient.get("id");
      } else if ((this.objectTypeName === "Blob") || (objectId && objectId.isInactive())) {
        // Blob and inactive resources are given an id-transient
        this.objectId = objectId || new ValaaReference(rawId);
        if (this.objectTypeName !== "Blob") this.objectTypeName = this.schema.inactiveType.name;
        this.objectTransient = createIdTransient(this.objectId);
      } else if ((!withOwnField && (!ghostPath || !ghostPath.isGhost()))
          || !this.goToMostInheritedMaterializedTransient(
              ghostPath, require, withOwnField, this.objectTransient)) {
        // A missing concrete resource or a ghost resource with its
        // base prototype fully in an inactive partition.
        this.objectId = null;
        this.objectTransient = null;
      } else if (onlyMostMaterialized || withOwnField) {
        // A most inherited materialized transient or withOwnField was
        // found but as its id naturally is different from the rawId
        // that was requested, we clear objectId to denote that.
        this.objectId = null;
      } else {
        // Create an immaterial transient which inherits from the most
        // inherited materialized transient.
        this.objectTransient = createImmaterialTransient(rawId, ghostPath, this.objectTransient);
        this.objectId = this.objectTransient.get("id");
      }
      if (!this.objectTransient && require) {
        throw new Error(`Could not find non-ghost resource "${rawId}":${this.objectTypeName}'`);
      }
      return this.objectTransient;
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`goToTransientOfRawId("${rawId}":${this.objectTypeName}${
              ghostPath ? `/${ghostPath}` : ""})`),
          "\n\trequire:", require,
          "\n\tghostPath:", ...dumpObject(ghostPath),
          "\n\tstate:", ...dumpObject(this.state.toJS()),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }

  /**
   * Resolves the outermost materialized ghost transient and sets it as
   * this.objectTransient, based on given currentPath.
   * Returns the full top-level ghost path which has been rebased on
   * top of the materialized transient ghost path.
   * If no materialized ghost prototype is found returns undefined
   * if require is not, otherwise throws an error.
   *
   * @export
   * @param {Resolver} resolver
   * @param {GhostPath} currentPath
   * @param {GhostPath} withOwnField - require transient to have this field for it to be considered
   *                                   a match
   * @returns {GhostPath} the transient ghostPath
   */
  goToMostInheritedMaterializedTransient (ghostPath: GhostPath, require: boolean = true,
      withOwnField?: string, initialTransient?: Object): GhostPath {
    let nextStep = ghostPath;
    let currentPath;
    let transient = initialTransient;
    try {
      while (true) { // eslint-disable-line no-constant-condition
        currentPath = nextStep.previousGhostStep();
        if (!currentPath && withOwnField && transient) {
          const nonGhostPrototype = transient.get("prototype");
          currentPath = nonGhostPrototype && nonGhostPrototype.tryGhostPath();
        }
        if (!currentPath) {
          if (!require) return undefined;
          throw new Error(`GhostPath base or instance reached without finding a materialized ${
              ""}ghost or concrete object`);
        }
        const rawId = currentPath.headRawId();
        transient = this.tryStateTransient(rawId, this.objectTypeName);
        if (transient && (!withOwnField || transient.get(withOwnField))) {
          this.objectTransient = transient;
          const transientId = transient.get("id");
          const transientGhostPath = transientId.getGhostPath();
          if (currentPath !== transientGhostPath) {
            // Rebase nextStep (which is a generated ghost path) on top of a persisted ghost path.
            Object.setPrototypeOf(nextStep, transientGhostPath);
          }
          return transientId;
        }
        nextStep = currentPath;
      }
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`goToMostInheritedMaterializedTransient`),
          "\n\tghostPath:", ...dumpObject(ghostPath),
          "\n\tcurrentPath:", ...dumpObject(currentPath),
          "\n\twithOwnField:", withOwnField);
    }
  }

  goToCurrentObjectOwnerTransient () {
    let owner;
    try {
      const fieldInfo = { name: "owner" };
      const elevator = Object.create(this);
      owner = getObjectRawField(elevator, this.objectTransient, "owner", fieldInfo);
      if (owner) {
        const elevation = _getFieldGhostElevation(fieldInfo, this.objectId);
        if (elevation) {
          owner = _elevateReference(elevator, owner, fieldInfo, elevation, "Resource");
        }
        if (owner instanceof ValaaReference) return this.goToTransient(owner, "Resource");
        this.objectId = owner.get("id");
        this.objectTransient = owner;
      } else {
        this.objectId = null;
        this.objectTransient = null;
      }
      return this.objectTransient;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`goToCurrentObjectOwnerTransient`),
          "\n\nowner:", ...dumpObject(owner),
          "\n\tobjectTransient:", ...dumpObject(this.objectTransient),
          "\n\tthis:", ...dumpObject(this),
      );
    }
  }
}
