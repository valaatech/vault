// @flow
import { created, addedTo, transacted } from "~/raem/events";
import { vRef } from "~/raem/VRL";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { createLocalPartitionURIFromRawId, createMemoryPartitionURIFromRawId }
    from "~/raem/ValaaURI";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valos-shared-content";

/*
function vCrossRef (rawId, partitionRawId = rawId) {
  const uri = naiveURI.createPartitionURI("valaa-test:", partitionRawId);
  return vRef(rawId, null, null, uri);
}
*/

describe("partitions", () => {
  beforeEach(() => {});

  const createBlockA = [
    // LocalPartition is implicitly created
    created({ id: ["A_grandparent"], typeName: "TestThing",
      initialState: {
        authorityURI: "valaa-local:"
      },
    }),
    created({ id: ["A_parent"], typeName: "TestThing",
      initialState: { owner: vRef("A_grandparent", "children") },
    }),
    created({ id: ["A_child1"], typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: ["A_child2"], typeName: "TestThing",
      initialState: {
        owner: vRef("A_parent", "children"),
        authorityURI: "valaa-memory:",
      },
    }),
    created({ id: ["A_grandchild"], typeName: "TestThing",
      initialState: {
        owner: vRef("A_child2", "children"),
      },
    }),
    created({ id: ["A_grandownee"], typeName: "TestThing",
      initialState: {
        owner: ["A_child2"],
      },
    }),
  ];

  it("CREATED has correct partition and id.getPartitionURI() for top-level children", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    const grandparent = harness.run(vRef("A_grandparent"), null);
    const grandparentPartitionURI = harness.run(grandparent, "id").getPartitionURI();

    expect(grandparentPartitionURI)
        .toEqual(createLocalPartitionURIFromRawId("A_grandparent"));
    expect(harness.run(grandparent, "authorityURI"))
        .toEqual("valaa-local:");
    expect(harness.run(grandparent, "partition"))
        .toBe(grandparent);

    expect(harness.run(vRef("A_parent"), "id").getPartitionURI())
        .toBe(grandparentPartitionURI);
    expect(harness.run(vRef("A_parent"), "partition"))
        .toBe(grandparent);

    expect(harness.run(vRef("A_child1"), "id").getPartitionURI())
        .toBe(grandparentPartitionURI);
    expect(harness.run(vRef("A_child1"), "partition"))
        .toBe(grandparent);
  });

  it("CREATED has correct partition and id.getPartitionURI() for non-top-level partition", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    const child2 = harness.run(vRef("A_child2"), null);
    const child2PartitionURI = harness.run(child2, "id").getPartitionURI();

    expect(child2PartitionURI)
        .toEqual(createMemoryPartitionURIFromRawId("A_child2"));
    expect(harness.run(child2, "authorityURI"))
        .toEqual("valaa-memory:");
    expect(harness.run(child2, "partition"))
        .toBe(child2);

    expect(harness.run(vRef("A_grandchild"), "id").getPartitionURI())
        .toBe(child2PartitionURI);
    expect(harness.run(vRef("A_grandchild"), "partition"))
        .toBe(child2);

    expect(harness.run(vRef("A_grandownee"), "id").getPartitionURI())
        .toBe(child2PartitionURI);
    expect(harness.run(vRef("A_grandownee"), "partition"))
        .toBe(child2);
  });

  it("meshes partition infos properly when setting cross-partition dependency", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    const finalEvent = harness.chronicleEvent(transacted({
      actions: [
        created({ id: ["B_testRoot"], typeName: "TestThing",
          initialState: {
            authorityURI: testAuthorityURI,
          },
        }),
        addedTo({ id: ["A_grandparent"], typeName: "TestThing",
          adds: { siblings: [vRef("B_testRoot")], },
        }),
      ],
    })).getTruthEvent();
    const aGrandparentPartition = { // eslint-disable-line
      "valaa-local:?id=A_grandparent": {},
    };
    const bTestRootPartition = { // eslint-disable-line
      "valaa-test:?id=B_testRoot": {},
    };
    expect(finalEvent.meta.partitions)
        .toEqual({ ...aGrandparentPartition, ...bTestRootPartition });
    expect(finalEvent.meta.partitionURI)
        .toEqual("valaa-test:?id=B_testRoot");
    expect((finalEvent.actions[0].meta || {}).partitions)
        .toBeFalsy();
    expect((finalEvent.actions[0].meta || {}).partitionURI)
        .toBeFalsy();
    expect(finalEvent.actions[1].meta.partitions)
        .toEqual({ ...aGrandparentPartition, ...bTestRootPartition });


    const aGrandParent = harness.run(vRef("A_grandparent"), null);
    const bTestRoot = harness.run(vRef("B_testRoot"), null);
    expect(aGrandParent.getPartitionRawId())
        .toEqual("A_grandparent");
    expect(bTestRoot.getPartitionRawId())
        .toEqual("B_testRoot");

    expect(harness.run(vRef("A_grandparent"), ["§->", "siblings", 0]))
        .toBe(bTestRoot);
    expect(harness.run(vRef("B_testRoot"), ["§->", "siblings", 0]))
        .toBe(aGrandParent);
  });
});
