// @flow

import { UniversalEvent } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { NarrateOptions, ChronicleOptions, ChronicleEventResult } from "~/prophet/api/Prophet";

import { dumpObject } from "~/tools";

/**
 * @export
 * @class FalseProphetPartitionConnection
 * @extends {PartitionConnection}
 */
export default class FalseProphetPartitionConnection extends PartitionConnection {
  _firstNonAuthorizedCommandId: number = 0;
  _pendingCommands: UniversalEvent[] = [];
  _eventsPendingSequencing: UniversalEvent[] = [];
  _isFrozen: ?boolean;

  // this._notifyProphetOfCommandCount(),

  setIsFrozen (value: boolean = true) { this._isFrozen = value; }

  isFrozen (): boolean { return !!this._isFrozen; }

  narrateEventLog (options: NarrateOptions = {}): Promise<Object> {
    return super.narrateEventLog({
      ...options,
      receiveTruths: this.getReceiveTruths(options.receiveTruths),
      receiveCommands: this.getReceiveCommands(options.receiveCommands),
    });
  }

  chronicleEventLog (eventLog: UniversalEvent[], options: ChronicleOptions = {}):
      Promise<{ eventResults: ChronicleEventResult[] }> {
    if (!eventLog || !eventLog.length) return { eventResults: eventLog };
    if (!eventLog[0].eventId) {
      eventLog.forEach((event, index) => {
        event.eventId = this._firstNonAuthorizedCommandId + this._pendingCommands.length
            + index;
      });
      this._addNonAuthorizedCommands(eventLog);
    }
    return super.chronicleEventLog(eventLog, {
      ...options,
      receiveTruths: this.getReceiveTruths(options.receiveTruths),
      receiveCommands: !options.alreadyReduced && this.getReceiveCommands(options.receiveCommands),
    });
  }

  receiveTruths (truthEvents: UniversalEvent[]) {
    return truthEvents.map(this._receiveTruth).filter(notNull => notNull);
  }

  _receiveTruth = (truth: UniversalEvent) => {
    const nonAuthorizedIndex = truth.eventId - this._firstNonAuthorizedCommandId;
    if (nonAuthorizedIndex < 0) return undefined;
    if (nonAuthorizedIndex < this._pendingCommands.length) {
      // const purgedCommands = await _confirmOrPurgeQueuedCommands(connection, lastNewEvent);
      if (truth.commandId === this._pendingCommands[nonAuthorizedIndex].commandId) {
        // authorized
        this._firstNonAuthorizedCommandId += nonAuthorizedIndex;
        this._pendingCommands.splice(0, nonAuthorizedIndex);
      } else {
        // purge
      }
    } else {
      const eventIndex = nonAuthorizedIndex - this._pendingCommands.length;
      this._eventsPendingSequencing[eventIndex] = truth;
    }
    if (!this._pendingCommands.length) {
      while (this._eventsPendingSequencing[0]) {
        ++this._firstNonAuthorizedCommandId;
        this._prophet._fabricateProphecy(this._eventsPendingSequencing.shift(), "truth");
      }
    }
    return truth;
  }

  receiveCommands (commands: UniversalEvent[]) {
    return commands.map(this._receiveCommand).filter(notNull => notNull);
  }

  _receiveCommand = (commandEvent: UniversalEvent) => {
    try {
      const nonAuthorizedIndex = commandEvent.eventId - this._firstNonAuthorizedCommandId;
      if (nonAuthorizedIndex < 0) {
        throw new Error("Can't receive commands with eventId before authorized head");
      }
      if (nonAuthorizedIndex < this._pendingCommands.length) return commandEvent;
      if (this._eventsPendingSequencing.length) {
        throw new Error(
            "Can't receive commands if there are out-of-order truths pending sequencing");
      }
      if (nonAuthorizedIndex !== this._pendingCommands.length) {
        throw new Error("Can only receive commands to the end of non-authorized commands queue");
      }
      this._addNonAuthorizedCommands([commandEvent]);
      this._prophet._fabricateProphecy(commandEvent, "reclaim");
      return commandEvent;
    } catch (error) {
      throw this.wrapErrorEvent(error, `receiveCommand(${commandEvent.eventId}, ${
              commandEvent.commandId})`,
          "\n\tcommandEvent:", ...dumpObject(commandEvent),
          "\n\tnonAuthorizedCommands:", ...dumpObject([...this._pendingCommands]),
          "\n\teventsPendingSequencing:", ...dumpObject([...this._eventsPendingSequencing]),
          "\n\tthis:", ...dumpObject(this)
      );
    }
  }

  _addNonAuthorizedCommands (commands: UniversalEvent[]) {
    this._pendingCommands.push(...commands);
    this.setIsFrozen(commands[commands.length - 1].type === "FROZEN");
    this._notifyProphetOfCommandCount();
  }

  _notifyProphetOfCommandCount () {
    this._prophet.setConnectionCommandCount(this.getPartitionURI().toString(),
        this._pendingCommands.length);
  }
}

/*
async function _confirmOrPurgeQueuedCommands (connection: ScribePartitionConnection,
    lastNewEvent: UniversalEvent) {
  let purgedCommands;
  const { firstEventId: firstCommandId, lastEventId: lastCommandId, commandIds }
      = connection._commandQueueInfo;
  if ((firstCommandId <= lastNewEvent.eventId) && (lastNewEvent.eventId <= lastCommandId)
      && (lastNewEvent.commandId !== commandIds[lastNewEvent.eventId - firstCommandId])) {
    // connection.warnEvent("\n\tPURGING by", event.commandId, eventId, event, commandIds,
    //    "\n\tcommandIds:", firstCommandId, lastCommandId, commandIds);
    // Frankly, we could just store the commands in the 'commandIds' fully.
    purgedCommands = await connection._readCommands(
        { firstEventId: firstCommandId, lastEventId: lastCommandId });
  }

  const newCommandQueueFirstEventId = (purgedCommands ? lastCommandId : lastNewEvent.eventId) + 1;
  if (connection.getFirstCommandEventId() < newCommandQueueFirstEventId) {
    _setCommandQueueFirstEventId(connection, newCommandQueueFirstEventId);
  }

  // Delete commands after event is stored, so we get no gaps.
  // TODO(iridian): Put these to the same transaction with the writeEvent
  if (connection.isLocallyPersisted()) {
    if (purgedCommands) {
      // TODO(iridian): Add merge-conflict-persistence. As it stands now, for the duration of
      // the merge process the purged commands are not persisted anywhere and could be lost.
      connection._deleteCommands(firstCommandId, lastCommandId);
    } else if (lastNewEvent.eventId >= firstCommandId) {
      connection._deleteCommands(firstCommandId, Math.min(lastNewEvent.eventId, lastCommandId));
    }
  }
  return purgedCommands;
}
*/
