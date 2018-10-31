// @flow
import { invariantifyNumber, invariantifyObject } from "~/tools/invariantify";
import { invariantifyId } from "~/raem/ValaaReference";

export class Action {
  +type: string;
  timeStamp: ?number;
}

export class EventBase extends Action {
  version: ?string;
  parentId: ?string;
}

export class UniversalEvent extends EventBase {
  eventId: number;
  commandId: string;
}

export class Truth extends EventBase {
  // partitions: ?Object;
}

export default class Command extends EventBase {
  // partitions: ?Object;
}

export function validateCommandInterface (command: Command) {
  const { type, version, commandId, eventId, partitions, parentId, timeStamp } = command;

  invariantifyId(version, `${type}.version`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyId(commandId, `${type}.commandId`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyNumber(eventId, `${type}.eventId`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyObject(partitions, `${type}.partitions`, { allowUndefined: true, allowEmpty: true },
      "\n\tcommand:", command);
  invariantifyId(parentId, `${type}.parentId`, { allowUndefined: true },
      "\n\tcommand:", command);
  invariantifyNumber(timeStamp, `${type}.timeStamp`, { allowUndefined: true },
      "\n\tcommand:", command);
}
