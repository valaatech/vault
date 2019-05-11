// @flow

import { Command, EventBase } from "~/raem/events";
import { getActionFromPassage, Story } from "~/raem/redux/Bard";

import TransactionState from "~/sourcerer/FalseProphet/TransactionState";
import { initializeAspects } from "~/sourcerer/tools/EventAspects";
import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";

import { dumpObject, outputError } from "~/tools";

import FalseProphet from "./FalseProphet";
import FalseProphetConnection from "./FalseProphetConnection";
import { Prophecy, _confirmProphecyCommand, _reformProphecyCommand, _rejectHereticProphecy }
    from "./_prophecyOps";
import StoryRecital from "./StoryRecital";

export function _composeStoryFromEvent (falseProphet: FalseProphet, event: EventBase,
    dispatchDescription: string, timed: ?EventBase, transactionState?: TransactionState) {
  if (!event.aspects) initializeAspects(event, { version: EVENT_VERSION });
  let story = (transactionState && transactionState._tryFastForwardOnCorpus(falseProphet.corpus));
  if (!story) {
    // If no transaction or transaction is not a fast-forward, do a regular dispatch
    if (transactionState) {
      falseProphet.warnEvent(1, () => [
          `Committing a diverged transaction '${transactionState.name}' normally:`,
          "\n\trestrictedTransacted:", ...dumpObject(event)]);
    }
    story = falseProphet.corpus.dispatch(event, dispatchDescription);
  }
  story.timed = timed;
  if (dispatchDescription.slice(0, 8) === "prophecy") story.isProphecy = true;
  if (dispatchDescription === "receiveTruth") story.isTruth = true;
  // story.id = story.aspects.command.id; TODO(iridian): what was this?
  falseProphet._primaryRecital.addStory(story);
  // console.log("Added dispatched event:", event, story, { state: story.state.toJS() });
  return story;
}

export function _rejectLastProphecyAsHeresy (falseProphet: FalseProphet, hereticClaim: EventBase) {
  if (falseProphet._primaryRecital.getLast().aspects.command.id
      !== hereticClaim.aspects.command.id) {
    throw new Error(`_rejectLastProphecyAsHeresy.hereticClaim.aspects.command.id ('${
        hereticClaim.aspects.command.id}') does not that of the latest story ('${
        falseProphet._primaryRecital.getLast().aspects.command.id}')`);
  }
  const hereticProphecy = falseProphet._primaryRecital.getLast();
  falseProphet._primaryRecital.removeStory(hereticProphecy);
  falseProphet.recreateCorpus(hereticProphecy.previousState);
}

export function _confirmCommands (connection: FalseProphetConnection,
    confirmedCommands: Command[]) {
  const falseProphet = connection.getSourcerer();
  for (const confirmed of confirmedCommands) {
    const story = falseProphet._primaryRecital.getStoryBy(confirmed.aspects.command.id);
    if (story) {
      if (!story.isProphecy) story.isTruth = true;
      else _confirmProphecyCommand(connection, story, confirmed);
    } else {
      connection.warnEvent(`_confirmCommands encountered a command '${
              confirmed.aspects.command.id}' with no corresponding story, with:`,
          "\n\tcurrent command:", ...dumpObject(confirmed),
          "\n\tconfirmed commands:", ...dumpObject(confirmedCommands),
          "\n\tprimary recital:", ...dumpObject(falseProphet._primaryRecital));
    }
  }
}

export function _purgeAndRecomposeStories (connection: FalseProphetConnection,
    newEvents: Command[], type: string, purgedCommands: ?Command[]) {
  connection.clockEvent(2, () => ["falseProphet.stories",
      `_purgeAndRecomposeStories(${newEvents.length}, ${type}, ${purgedCommands || []}.length)`]);
  if (purgedCommands && purgedCommands.length) connection.setIsFrozen(false);
  const falseProphet = connection.getSourcerer();
  const originatingPartitionURI = connection.getPartitionURI();
  const purgedPartitionURI = String(connection.getPartitionURI());
  const newAndRewrittenStories = [];
  let schismaticRecital, schismaticStory, reviewedPartitions;
  newEvents.forEach((event, index) => {
    newEvents[index] = {
      ...event,
      meta: {
        ...(event.meta || {}),
        partitionURI: originatingPartitionURI,
      },
    };
  });

  // Purge events.
  if (purgedCommands) {
    connection.clockEvent(2, () => ["falseProphet.stories.purge",
        `_beginPurge(${purgedCommands}.length)`]);
    schismaticRecital = _beginPurge(falseProphet, purgedCommands);
    schismaticStory = schismaticRecital && schismaticRecital.next;
    reviewedPartitions = { [purgedPartitionURI]: {} };
  }
  let newEventIndex = 0;
  let reformingPurgedProphecy;
  connection.clockEvent(2, () => ["falseProphet.stories.compose",
      `Composing and reforming up to ${newEvents.length} events`]);
  while (true) { // eslint-disable-line
    // Alternate between dispatching new events and purged stories,
    // always preferring new events unless a new event is part of an
    // existing purged story. In that case repeat-dispatch purged
    // stories until that existing story is repeated and then go back
    // to dispatching new events.
    for (; !reformingPurgedProphecy && (newEventIndex !== newEvents.length); ++newEventIndex) {
      const newEvent = newEvents[newEventIndex];
      reformingPurgedProphecy = schismaticRecital
          && schismaticRecital.getStoryBy(newEvent.aspects.command.id);
      if (!reformingPurgedProphecy) {
        newAndRewrittenStories.push(falseProphet._composeStoryFromEvent(newEvent, type));
      }
    }

    if (schismaticStory === schismaticRecital) break;

    if (schismaticStory.isProphecy && !schismaticStory.schismDescription) {
      const purgedPartitionURIs = !schismaticStory.meta ? []
          : schismaticStory.meta.partitions ? Object.keys(schismaticStory.meta.partitions)
          : schismaticStory.meta.partitionURI ? [schismaticStory.meta.partitionURI]
          : [];
      for (const partitionURI of purgedPartitionURIs) {
        const reviewedPartition = reviewedPartitions[partitionURI];
        if (!reviewedPartition) continue;
        schismaticStory.needsReview = true;
        if (partitionURI === purgedPartitionURI) {
          if (schismaticStory === reformingPurgedProphecy) continue;
          schismaticStory.schismDescription = `schism created by a prophecy reordering reformation`;
          schismaticStory.reorderingSchism = reformingPurgedProphecy;
        } else if (reviewedPartition.isSchismatic) {
          schismaticStory.schismDescription = `a prophecy partition contains an earlier schism`;
          schismaticStory.schismPartition = partitionURI;
        } else continue;
        (schismaticStory.schismPartitions || (schismaticStory.schismPartitions = []))
            .push(partitionURI);
      }
    }

    let recomposedStory;
    if (!schismaticStory.schismDescription) {
      recomposedStory = _recomposeStoryFromPurgedEvent(connection.getSourcerer(), schismaticStory);
      if (recomposedStory && schismaticStory.needsReview) {
        const revisedProphecy = connection._reviewPurgedProphecy(schismaticStory, recomposedStory);
        if (!revisedProphecy) {
          _rejectLastProphecyAsHeresy(connection.getSourcerer(), recomposedStory);
        }
        recomposedStory = revisedProphecy;
      }
      if (recomposedStory) newAndRewrittenStories.push(recomposedStory);
    }

    if (schismaticStory === reformingPurgedProphecy) {
      const reformingEvent = newEvents[newEventIndex - 1];
      _reformProphecyCommand(connection, schismaticStory, reformingEvent);
      if (schismaticStory.schismDescription) {
        connection.errorEvent("REFORMATION ERROR: a purged prophecy was reformed by new event but",
            "is still schismatic as a whole.",
            "\n\tRecomposing only the new event while rejecting the rest of the original prophecy.",
            "\n\tschism description:", schismaticStory.schismDescription,
            "\n\tpurged prophecy:", schismaticStory,
            "\n\treforming event:", reformingEvent,
            "\n\trecomposed prophecy:", recomposedStory);
        newAndRewrittenStories.push(
            falseProphet._composeStoryFromEvent(reformingEvent, `${type}-reformation-schism`));
      }
      reformingPurgedProphecy = null;
    }

    if (schismaticStory.schismDescription || schismaticStory.needsReview) {
      // Mark all partitions of the old prophecy as schismatic/revisioned.
      // If schismatic all subsequent commands on these partitions
      // need to be fully, possibly interactively revised as they're
      // likely to depend on the first schismatic change.
      for (const partitionURI of Object.keys((schismaticStory.meta || {}).partitions || {})) {
        const partition = reviewedPartitions[partitionURI]
            || (reviewedPartitions[partitionURI] = {});
        if (schismaticStory.schismDescription) {
          partition.isSchismatic = true;
          partition.originalSchism = schismaticStory;
          (partition.purgedProphecies || (partition.purgedProphecies = [])).push(schismaticStory);
        }
      }
    }

    // Remove successfully repeated/reviewed stories from the purged
    // recital so that only schismatic ones remain.
    schismaticStory = !schismaticStory.schismDescription
        ? schismaticRecital.removeStory(schismaticStory) // Also advances to next
        : schismaticStory.next; // Keep it, just advance to next
  }

  // Revise purged events.
  if (schismaticRecital && (schismaticRecital.getFirst() !== schismaticRecital)) {
    connection.clockEvent(2, () => ["falseProphet.stories.revise",
      `Revising ${schismaticRecital.size()} events from event ${newEventIndex} onward`]);
    const revisions = falseProphet._reviseSchismaticRecital(
        schismaticRecital, reviewedPartitions, connection, purgedCommands, newEvents);
    if (revisions) newAndRewrittenStories.push(...revisions);
  }
  if (schismaticRecital && (schismaticRecital.getFirst() === schismaticRecital)) {
    schismaticRecital = undefined;
  }

  connection.clockEvent(2, () => ["falseProphet.stories.recite",
    `_tellStoriesToFollowers(${
      newAndRewrittenStories.length}, ${schismaticRecital ? schismaticRecital.size() : 0})`]);
  falseProphet._tellStoriesToFollowers(newAndRewrittenStories, schismaticRecital);

  _confirmLeadingTruthsToFollowers(falseProphet);

  connection._checkForFreezeAndNotify();
  connection.clockEvent(2, "falseProphet.stories.done");
}

function _beginPurge (falseProphet: FalseProphet, purgedCommands: Command[]): Story {
  let firstPurgedProphecy;
  for (const purgedCommand of purgedCommands) {
    const purged = falseProphet._primaryRecital.getStoryBy(purgedCommand.aspects.command.id);
    if (!purged) continue;
    if (!firstPurgedProphecy) firstPurgedProphecy = purged;
    purged.needsReview = true;
  }
  if (!firstPurgedProphecy) return undefined;
  falseProphet._primaryRecital.extractStoryChain(firstPurgedProphecy);
  const purgedState = firstPurgedProphecy.previousState;
  falseProphet.recreateCorpus(purgedState);
  return new StoryRecital(firstPurgedProphecy, `purge-${firstPurgedProphecy.aspects.command.id}`);
}

export function _recomposeStoryFromPurgedEvent (falseProphet: FalseProphet, purged: Prophecy) {
  const purgedEvent = getActionFromPassage(purged);
  // const oldPartitions = purgedEvent.partitions;
  try {
    return _composeStoryFromEvent(falseProphet, purgedEvent,
        !purged.needsReview
            ? "story-repeat"
        : !purged.schismDescription
            ? "prophecy-review"
            : "prophecy-schism-revise");
  } catch (error) {
    const wrappedError = falseProphet.wrapErrorEvent(error, purged.needsReview
            ? new Error(`_recomposeStoryFromPurgedEvent.review.dispatch(${purged.aspects.command.id
                }) structural schism: failed to reduce the purged command against fresh corpus`)
            : new Error(`_recomposeStoryFromPurgedEvent.repeat.dispatch(${purged.aspects.command.id
                }) INTERNAL ERROR: non-purged event repeat dispatch shouldn't cause errors`),
        "\n\tpurgedEvent:", ...dumpObject(purgedEvent),
        "\n\tpurgedProphecy:", ...dumpObject(purged));
    if (!purged.needsReview) {
      outputError(wrappedError, "Exception caught during _recomposeStoryFromPurgedEvent");
      purged.needsReview = true;
    }
    purged.schismDescription = `a structural schism found when ${
        purged.needsReview ? "review" : "repeat"}-recomposing a story from a purged command; ${
            error.message}`;
    purged.structuralSchism = wrappedError;
  }
  return undefined;
}

export function _reviseSchismaticRecital (falseProphet: FalseProphet,
    schismaticRecital: StoryRecital, reviewedPartitions: Object,
    originatingConnection: FalseProphetConnection, purgedStories: Story[],
    newEvents: EventBase[]) {
  const ret = [];
  const rejectedSchisms = [];
  let schismaticStory = schismaticRecital.getFirst();
  while (schismaticStory !== schismaticRecital) {
    const revisedProphecies = originatingConnection._reviseSchism(
        schismaticStory, purgedStories, newEvents);
    if (revisedProphecies) {
      ret.push(...revisedProphecies);
      schismaticStory = schismaticRecital.removeStory(schismaticStory);
    } else {
      rejectedSchisms.push(schismaticStory);
      schismaticStory = schismaticStory.next;
    }
  }
  if (rejectedSchisms.length) {
    rejectedSchisms.forEach(herecy => _rejectHereticProphecy(falseProphet, herecy));
    originatingConnection.errorEvent(1, () => [
      "\n\nSCHISMS REJECTED (ie. conflicting prophecies):",
      "\n\trejected schisms:", ...dumpObject(rejectedSchisms),
      "\n\tof schismatic recital:", ...dumpObject(schismaticRecital),
      "\n\treviewed partitions:", ...dumpObject(reviewedPartitions),
      "\n\toriginating partition:", ...dumpObject(originatingConnection),
      "\n\tpurged stories:", ...dumpObject(purgedStories),
      "\n\tnew events:", ...dumpObject(newEvents),
    ]);
  }
  return ret;
}

export function _tellStoriesToFollowers (falseProphet: FalseProphet, stories: Story[],
    purgedRecital: ?StoryRecital) {
  let followerReactions;
  falseProphet._followers.forEach((discourse, follower) => {
    let reactions;
    try {
      reactions = discourse.receiveCommands(stories, purgedRecital);
      if (reactions !== undefined) {
        if (!followerReactions) followerReactions = new Map();
        followerReactions.set(follower, reactions);
      }
    } catch (error) {
      falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
          "_tellStoriesToFollowers",
          "\n\tstories:", ...dumpObject(stories),
          "\n\treactions:", ...dumpObject(reactions),
          "\n\ttarget discourse:", ...dumpObject(discourse),
      ));
    }
  });
  return stories.map((story, index) => ({
    story,
    getFollowerReactions: !followerReactions ? () => {}
        : (async (filter) => {
          const storyReactions = [];
          for (const [allStoryReactions, follower] of followerReactions.entries()) {
            if (!filter
                || ((typeof filter !== "function") ? filter === follower : filter(follower))) {
              const reactions = allStoryReactions[index];
              storyReactions.push(...(!reactions ? [] : await Promise.all(reactions)));
            }
          }
          return storyReactions;
        }),
  }));
}

// Notify followers about the stories that have been confirmed as
// permanent truths in chronological order, ie. all stories at the
// front of the recital marked as isTruth and which thus can no
// longer be affected by any future purges and revisionings.
function _confirmLeadingTruthsToFollowers (falseProphet: FalseProphet) {
  const truths = [];
  for (let story = falseProphet._primaryRecital.getFirst(); story.isTruth; story = story.next) {
    truths.push(story);
  }
  falseProphet.clockEvent(2, () => ["falseProphet.truths.confirm",
    `_confirmLeadingTruthsToFollowers(${truths.length})`]);
  if (!truths.length) return;
  falseProphet._primaryRecital.extractStoryChain(truths[0], truths[truths.length - 1].next);
  falseProphet._followers.forEach(discourse => {
    try {
      discourse.receiveTruths(truths);
    } catch (error) {
      falseProphet.outputErrorEvent(falseProphet.wrapErrorEvent(error,
          "_confirmLeadingTruthsToFollowers",
          "\n\tstories:", ...dumpObject(truths),
          "\n\ttarget discourse:", ...dumpObject(discourse),
      ));
    }
  });
}

/*
remoteAuthority = operation.authorities[authorityURIs[0]];
if (falseProphet.getVerbosity() === 1) {
  falseProphet.logEvent(1, `${remoteAuthority
    ? "Queued a remote command locally"
    : "Done claiming a local event"} of authority "${authorityURIs[0]}":`,
    "of partitions:", ...[].concat(...partitionDatas.map(([pdata]) => [conn.getName()])));
} else if (falseProphet.getVerbosity() >= 2) {
  falseProphet.warnEvent(2, () => [
    `Done ${remoteAuthority
        ? "queuing a remote command locally"
        : "claiming a local event"} of authority "${authorityURIs[0]}":`,
    "\n\tpartitions:", ...partitionDatas.map(([, conn]) => conn.getName()),
    "\n\tcommand:", operation.prophecy,
  ]);
}

if (!remoteAuthority) {
  const event = { ...operation.prophecy };
  try {
    partitionDatas.map(([, connection]) =>
        connection._receiveTruthOf("localAuthority", event));
  } catch (error) {
    throw falseProphet.wrapErrorEvent(error, new Error("chronicleEvents.meta.onConfirmTruth"));
  }
  return operation.prophecy;
}
let ret;
try {
  ret = await remoteAuthority.chronicleEvent(operation.prophecy, operation.options)
      .getPremiereStory();
} catch (error) {
  throw falseProphet.wrapErrorEvent(error,
      new Error("chronicleEvents.remoteAuthority.chronicleEvent"));
}
if (falseProphet.getVerbosity() === 1) {
  falseProphet.logEvent(1, () => [
    `Done claiming remote command of authority`, remoteAuthority,
    "and of partitions:", ...[].concat(...partitionDatas.map(([pdata]) => [conn.getName()])),
  ]);
} else if (falseProphet.getVerbosity() === 2) {
  falseProphet.warnEvent(2, () => [`Done claiming remote command"`, ret]);
}
*/

/*
  const authorityURIs = Object.keys(operation.authorities);
  if (!authorityURIs.length) throw new Error("command is missing authority information");
  else if (authorityURIs.length > 1) {
    throw new Error(`ValOS FalseProphet: multi-authority commands not supported, authorities:"${
        authorityURIs.join(`", "`)}"`);
  }

// operation.authorityPersistProcesses = _getOngoingAuthorityPersists(falseProphet, operation);

function _getOngoingAuthorityPersists (falseProphet: FalseProphet, { command }: Object) {
  const ret = [];
  for (const contentHash of Object.keys(command.addedBvobReferences || {})) {
    for (const { referrerId } of command.addedBvobReferences[contentHash]) {
      let connection;
      try {
        const partitionURIString = String(referrerId.getPartitionURI());
        connection = falseProphet._connections[partitionURIString];
        invariantifyObject(connection, `connections[${partitionURIString}]`);
      } catch (error) {
        throw errorOnGetOngoingAuthorityPersists.call(falseProphet, contentHash, referrerId, error);
      }
      const persistProcess = thenChainEagerly(
          connection.asActiveConnection(),
          () => {
            const authorityConnection = connection.getUpstreamConnection();
            return authorityConnection && authorityConnection.getContentPersistProcess(contentHash);
          },
          errorOnGetOngoingAuthorityPersists.bind(falseProphet, contentHash, referrerId),
      );
      if (persistProcess) ret.push(persistProcess);
    }
  }
  return ret;
  function errorOnGetOngoingAuthorityPersists (contentHash, referrerId, error) {
    throw falseProphet.wrapErrorEvent(error, new Error("_getOngoingAuthorityPersists"),
            "\n\tcurrent referrerId:", ...dumpObject(referrerId),
            "\n\tcurrent contentHash:", ...dumpObject(contentHash),
            "\n\tret (so far):", ...dumpObject(ret),
            "\n\tcommand:", ...dumpObject(command));
  }
}
*/