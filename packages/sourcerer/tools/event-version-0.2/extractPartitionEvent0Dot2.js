// @flow

import { Action, isTransactedLike } from "~/raem/events";

import Connection from "~/sourcerer/api/Connection";

import { dumpObject } from "~/tools";

export default function extractPartitionEvent0Dot2 (connection: Connection, action: Action,
    partitionKey: string = String(connection.getPartitionURI()), excludeMetaless: ?boolean) {
  const meta = action.meta || action.local;
  if (!meta) return excludeMetaless ? undefined : action;
  const partitions = meta.partitions;
  if (partitions && partitionKey && !partitions[partitionKey]) return undefined;
  const ret = { ...action };
  try {
    delete ret.meta;
    delete ret.local;
    if (ret.aspects) ret.aspects = { ...ret.aspects };
    if (!partitions) return ret;
    if (Object.keys(partitions).length !== 1) {
      if (!isTransactedLike(action)) {
        throw new Error(`Non-TRANSACTED-like multi-partition command type ${
            action.type} not supported`);
      }
      if (action.type !== "TRANSACTED") {
        throw new Error(`Multi-partition ${action.type} not implemented`);
      }
    }
    if (action.actions) {
      ret.actions = action.actions
          .map(subAction => extractPartitionEvent0Dot2(
              connection, subAction, partitionKey, meta.partitionURI !== partitionKey))
          .filter(notFalsy => notFalsy);
      if (!ret.actions.length) {
        throw new Error(`INTERNAL ERROR: No TRANSACTED.actions found for current partition ${
            ""}in a multi-partition TRANSACTED action`);
      }
      if ((ret.type === "TRANSACTED") && (ret.actions.length === 1)) {
        const simplifiedAction = ret.actions[0];
        delete ret.actions;
        Object.assign(ret, simplifiedAction);
      }
    }
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error,
        new Error(`extractPartitionEvent0Dot2(${connection.getName()})`),
        "\n\tpartitionKey:", partitionKey,
        "\n\taction:", ...dumpObject(action),
        "\n\taction partitions:", ...dumpObject(partitions),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}