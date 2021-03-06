// @flow

import { vRef } from "~/raem/VRL";

import { created, destroyed } from "~/raem/events";
import { createGhostRawId } from "~/raem/state/GhostPath";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { createEngineTestHarness, testRootId } from "~/engine/test/EngineTestHarness";

const transactionA = {
  type: "TRANSACTED",
  actions: [
    created({ id: ["test"], typeName: "TestScriptyThing", initialState: {
      owner: [testRootId],
      name: "testName",
    }, }),
    created({ id: ["child"], typeName: "TestScriptyThing", initialState: {
      parent: ["test"],
      name: "childName",
    }, }),
    created({ id: ["ownling"], typeName: "TestScriptyThing", initialState: {
      owner: ["test"],
      name: "ownlingName",
    }, }),
    created({ id: ["grandChild"], typeName: "TestScriptyThing", initialState: {
      parent: ["child"],
    }, }),
    created({ id: ["grandSibling"], typeName: "TestScriptyThing", initialState: {
      parent: ["child"],
    }, }),
    created({ id: ["greatGrandChild"], typeName: "TestScriptyThing", initialState: {
      parent: ["grandChild"],
    }, }),
    created({ id: ["greatGrandChildOwnling"], typeName: "TestScriptyThing", initialState: {
      owner: ["greatGrandChild"],
      name: "greatGrandChildOwnlingName",
    }, }),
  ]
};

const createAInstance
    = created({ id: ["test+1"], typeName: "TestScriptyThing", initialState: {
      owner: [testRootId],
      instancePrototype: vRef("test"),
    }, });

const createMedia = {
  type: "TRANSACTED",
  actions: [
    created({ id: ["@$~bvob.theContent@@"], typeName: "Blob" }),
    created({ id: ["theMedia"], typeName: "Media", initialState: {
      owner: ["child"],
      name: "mediaName",
      content: ["@$~bvob.theContent@@"],
    }, }),
  ],
};


describe("Vrapper", () => {
  let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
  const testScriptyThings = () => harness.createds.TestScriptyThing;
  const medias = () => harness.createds.Media;
  const entities = () => harness.createds.Entity;

  const expectNoVrapper = rawId => { expect(harness.engine.tryVrapper(rawId)).toBeFalsy(); };
  const expectVrapper = rawId => { expect(harness.engine.tryVrapper(rawId)).toBeTruthy(); };

  const touchField = (vrapper, field) => {
    const value = vrapper.step(field);
    vrapper.setField(field, `touched_${value}`);
  };

  const checkVrapperSets = (observedVrapper, { expectFields, targetId, sets, expectUpdates }) => {
    const updatedValues = {};
    for (const key of Object.keys(expectFields)) {
      expect(observedVrapper.step(key))
          .toEqual(expectFields[key]);
    }
    for (const key of Object.keys(sets || {})) {
      observedVrapper.obtainSubscription(key)
          .addListenerCallback(harness, "test", (update) => {
            updatedValues[key] = update.value();
          }, false);
    }
    harness.proclaimTestEvent({ type: "FIELDS_SET", id: targetId,
      typeName: "TestScriptyThing",
      sets,
    });
    const actualExpectUpdates = expectUpdates || sets;
    for (const key of Object.keys(actualExpectUpdates || {})) {
      expect(updatedValues[key])
          .toEqual(actualExpectUpdates[key]);
    }
  };

  const getGhostVrapperById = (ghostPrototypeRawId, instanceRawId) =>
      harness.engine.getVrapperByRawId(createGhostRawId(ghostPrototypeRawId, instanceRawId));

  describe("Vrapper basic functionality", () => {
    it("returns vrappers for non-ghost when returned from kuery", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expectVrapper("test");
      const vChild = testScriptyThings().test.step(["§->", "children", 0]);
      expect(vChild instanceof Vrapper)
          .toEqual(true);
      expect(vChild)
          .toEqual(harness.engine.getVrapperByRawId("child"));
    });

    it("touches a Vrapper field and it is properly modified for subsequent reads", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      touchField(testScriptyThings().test, "name");
      expect(testScriptyThings().test.step("name"))
          .toEqual("touched_testName");
      expect(harness.engine.getVrapperByRawId("test").step("name"))
          .toEqual("touched_testName");
    });

    it("doesn't create Vrappers for ghosts by default", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expectNoVrapper(createGhostRawId("@$~raw.child@@", "@$~raw.test%2B1@@"));
    });

    it("returns Vrappers for ghost when returned from kuery", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptyThings()["test+1"].step(["§->", "children", 0]);
      expect(vChildGhost instanceof Vrapper)
          .toEqual(true);
      const expectedChildGhostRawId = createGhostRawId("@$~raw.child@@", "@$~raw.test%2B1@@");
      expect(vChildGhost.getRawId())
          .toEqual(expectedChildGhostRawId);
      expectVrapper(expectedChildGhostRawId);
    });

    it("returns a correct Vrapper with getGhostIn", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const result = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      expect(result)
          .toEqual(getGhostVrapperById("@$~raw.child@@", "@$~raw.test%2B1@@"));
    });

    it("returns a correct Vrapper with kuery", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const result = testScriptyThings()["test+1"].step(["§->", "children", 0]);
      expect(result)
          .toEqual(getGhostVrapperById("@$~raw.child@@", "@$~raw.test%2B1@@"));
    });
  });

  describe("Vrapper media decoder integration", () => {
    let testVrapper;

    beforeEach(() => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, createMedia,
      ]);
      testVrapper = medias().theMedia;
    });

    describe("_getMediaTypeFromTags", () => {
      it("should return a media type object for the first valid mediaType tag", () => {
        testVrapper.addToField("tags", { typeName: "Tag", tagURI: "invalidtaguri" });
        testVrapper.addToField("tags",
            { typeName: "Tag", tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType" });
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType#second"
        });
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:mediaType#application/valoscript"
        });
        expect(testVrapper._getMediaTypeFromTags()).toEqual({
          contentType: "application/valoscript",
        });
      });

      it("should return a null if there are no valid media type tags", () => {
        testVrapper.addToField("tags", { typeName: "Tag", tagURI: "invalidtaguri" });
        testVrapper.addToField("tags",
            { typeName: "Tag", tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType" });
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType#second"
        });
        expect(testVrapper._getMediaTypeFromTags()).toEqual(null);
      });
    });

    describe("Media interpretation", () => {
      let mediaTypeUsed;
      const mockIntegrateDecoding = (decodedContent, vOwner, mediaType) => {
        mediaTypeUsed = mediaType;
        return decodedContent;
      };

      let testVrapperMediaInfo;
      beforeEach(() => {
        testVrapperMediaInfo = {
          name: "file.vs", contentType: "meta/data",
        };
        testVrapper.getEngine()._integrateDecoding = mockIntegrateDecoding;
        testVrapper.interpretContent = (() => "");
        testVrapper.hasInterface = () => true;
        testVrapper.step = function step (kuery) {
          if (kuery === Vrapper.toMediaInfoFields) return ({ ...testVrapperMediaInfo });
          return Vrapper.prototype.step.call(this, kuery);
        };
      });

      it("should use appropriate media type based on the following rule order: " +
         "from options.mediaType > from media itself > from name extension", () => {
        const vIntegrationScope = testVrapper;
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:mediaType#application/javascript"
        });
        testVrapper._obtainMediaInterpretation({
          decodedContent: "", mediaInfo: { contentType: "application/javascript" },
          vIntegrationScope,
        });
        expect(mediaTypeUsed.contentType).toEqual("application/javascript");

        testVrapper._obtainMediaInterpretation(
            { decodedContent: "", contentType: "text/plain", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("text/plain");

        testVrapper._obtainMediaInterpretation({ decodedContent: "", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("meta/data");

        testVrapper._obtainMediaInterpretation(
            { decodedContent: "", fallbackContentType: "fall/back", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("meta/data");

        testVrapperMediaInfo.contentType = "";
        testVrapper._obtainMediaInterpretation({ decodedContent: "", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("application/valoscript");
        testVrapper._obtainMediaInterpretation(
            { decodedContent: "", fallbackContentType: "fall/back", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("application/valoscript");

        testVrapperMediaInfo.name = "file";
        testVrapper._obtainMediaInterpretation({ decodedContent: "", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("application/octet-stream");
        testVrapper._obtainMediaInterpretation(
            { decodedContent: "", fallbackContentType: "fall/back", vIntegrationScope });
        expect(mediaTypeUsed.contentType).toEqual("fall/back");
      });
    });
  });

  describe("Vrapper MODIFIED notifications", () => {
    it("notifies on field change when modified directly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperSets(testScriptyThings().test, {
        expectFields: { name: "testName" },
        targetId: ["test"],
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    it("notifies on untouched instance field change when modified through prototype", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperSets(testScriptyThings()["test+1"], {
        expectFields: { name: "testName" },
        targetId: ["test"],
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    /* Currently always notifying: would need additional logic to filter these out.
     * One possibility is to just compare the values: it might make sense to eliminate notifications
     * on events which change nothing.
    it("does not notify on touched instance field change when modified through prototype", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      touchField(testScriptyThings["test+1"], "name");
      checkVrapperSets(testScriptyThings["test+1"], {
        expectFields: { name: "touched_testName" },
        targetId: "test",
        sets: { name: "harambe" },
        expectUpdates: { name: undefined }, // undefined means 'no update seen'
      });
    });
    */

    it("notifies on immaterial ghost field change when modified through ghost prototype", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      expect(vChildGhost.isMaterialized())
          .toEqual(false);
      checkVrapperSets(vChildGhost, {
        expectFields: { name: "childName" },
        targetId: ["child"],
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    it("notifies on material ghost untouched field change when modified through ghost prototype",
    () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      vChildGhost.materialize();
      expect(vChildGhost.isMaterialized())
          .toEqual(true);
      checkVrapperSets(vChildGhost, {
        expectFields: { name: "childName" },
        targetId: ["child"],
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    it("notifies on immaterial ghost field change when modified directly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      expect(vChildGhost.isMaterialized())
          .toEqual(false);
      checkVrapperSets(vChildGhost, {
        expectFields: { name: "childName" },
        targetId: vChildGhost.getVRef(),
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
      expect(vChildGhost.isMaterialized())
          .toEqual(true);
    });

    it("notifies subscribers to the owner list when a child object is DESTROYED", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      let modCalled = false;
      testScriptyThings().child.obtainSubscription("children")
          .addListenerCallback(harness, "test", () => { modCalled = true; }, false);
      harness.proclaimTestEvent(destroyed({ type: "DESTROYED", id: ["grandChild"] }));
      // children modified subscriber should have been called when the sub-event to remove
      // grandChild from the children list was reduced
      expect(modCalled).toEqual(true);
    });

    it("notifies subscribers to the owner list when a child object is reparented", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      let modCalled = false;
      testScriptyThings().grandChild.obtainSubscription("children")
          .addListenerCallback(harness, "test", () => { modCalled = true; }, false);
      testScriptyThings().greatGrandChild.setField("parent",
          testScriptyThings().grandSibling);

      // children modified subscriber should have been called when the sub-event to remove
      // grandChild from the children list was reduced
      expect(modCalled).toEqual(true);
    });
  });

  const checkVrapperDestroy = (observedVrapper, { destroyVrapper = observedVrapper } = {}) => {
    let count = 0;
    const observedRawId = observedVrapper.getRawId();
    observedVrapper.addDESTROYEDHandler(() => {
      ++count;
    });
    destroyVrapper.destroy();
    expect(count)
        .toEqual(1);
    expect(harness.engine.tryVrapper(observedRawId))
        .toBeFalsy();
  };

  describe("Vrapper DESTROYED notifications", () => {
    it("calls destroy subscribers when the object is destroyed", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [transactionA]);
      checkVrapperDestroy(testScriptyThings().test);
    });

    it("calls destroy subscribers when the instance is destroyed", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperDestroy(testScriptyThings()["test+1"]);
    });

    it("calls destroy subscribers when the ghost is destroyed", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperDestroy(testScriptyThings().child.getGhostIn(
          testScriptyThings()["test+1"]));
    });

    it("calls destroy subscribers on an instance when its prototype is destroyed", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(() => checkVrapperDestroy(testScriptyThings()["test+1"],
              { destroyVrapper: testScriptyThings().test }))
          .toThrow(/destruction blocked/);
    });

    it("calls destroy subscribers on a ghost when its ghost prototype is destroyed", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperDestroy(
          testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]),
          { destroyVrapper: testScriptyThings().child });
    });
  });

  describe("Vrapper sub-event notifications", () => {
    it("calls the destroy subscriber for all children of a destroyed object", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA,
      ]);
      const counts = [];
      testScriptyThings().test.addDESTROYEDHandler(() => { counts[0] = (counts[0] || 0) + 1; });
      testScriptyThings().child.addDESTROYEDHandler(() => { counts[1] = (counts[1] || 0) + 1; });
      testScriptyThings().grandChild.addDESTROYEDHandler(
          () => { counts[2] = (counts[2] || 0) + 1; });
      testScriptyThings().test.destroy();
      expect(counts)
          .toEqual([1, 1, 1]);
    });

    it("calls the destroy subscriber for all ghosts of a destroyed object", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const counts = [];
      const childGhost = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      childGhost.addDESTROYEDHandler(() => { counts[0] = (counts[0] || 0) + 1; });
      const grandChildGhost = testScriptyThings().grandChild.getGhostIn(
          testScriptyThings()["test+1"]);
      grandChildGhost.addDESTROYEDHandler(() => { counts[1] = (counts[1] || 0) + 1; });
      expect(harness.engine.tryVrapper("child"))
          .toBeTruthy();
      expect(harness.engine.tryVrapper("grandChild"))
          .toBeTruthy();
      testScriptyThings().child.destroy();
      expect(counts)
          .toEqual([1, 1]);
      expect(harness.engine.tryVrapper(childGhost.getRawId()))
          .toBeFalsy();
      expect(harness.engine.tryVrapper(grandChildGhost.getRawId()))
          .toBeFalsy();
    });
  });

  describe("Ghost relations manipulations", () => {
    it("does not mutate ghost prototype list field when mutating immaterial ghost field", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const childGhost = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      expect(testScriptyThings().child.step("children").length)
          .toEqual(2);
      harness.engine.create("TestScriptyThing", { parent: childGhost, name: "guest" });
      expect(testScriptyThings().child.step("children").length)
          .toEqual(2);
    });

    it("maintains list references on list field prototype->ghost upgrades", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const childGhost = testScriptyThings().child.getGhostIn(testScriptyThings()["test+1"]);
      const grandChildGhost = testScriptyThings().grandChild.getGhostIn(
          testScriptyThings()["test+1"]);
      expect(childGhost.step(["§->", "children", 0]))
          .toEqual(grandChildGhost);
      const vGuest = harness.engine.create("TestScriptyThing",
          { parent: childGhost, name: "guest" });
      expect(vGuest.step("parent"))
          .toEqual(childGhost);
      const childGhostChildren = childGhost.step("children");
      expect(childGhostChildren.length)
          .toEqual(3);
      expect(childGhostChildren[0])
          .toEqual(grandChildGhost);
      expect(childGhostChildren[2])
          .toEqual(vGuest);
    });
  });

  describe("abstraction piercing operations", () => {
    it("recurses materialized fields: ['children']", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapperByRawId("test")
              .do(VALEK.recurseMaterializedFieldResources(["children"]).map("rawId")))
          .toEqual([
            "@$~raw.child@@", "@$~raw.grandChild@@", "@$~raw.greatGrandChild@@",
            "@$~raw.grandSibling@@",
          ]);
    });
    it("doesn't recurse immaterialized fields: ['children']", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapperByRawId("test+1")
              .do(VALEK.recurseMaterializedFieldResources(["children"]).map("rawId")))
          .toEqual([]);
    });
    it("recurses materialized fields: ['unnamedOwnlings']", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapperByRawId("test")
              .do(VALEK.recurseMaterializedFieldResources(["unnamedOwnlings"]).map("rawId")))
          .toEqual(["@$~raw.ownling@@"]);
    });
    it("recurses materialized fields: ['children', 'unnamedOwnlings']", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapperByRawId("test")
              .do(VALEK.recurseMaterializedFieldResources(["children", "unnamedOwnlings"])
                  .map("rawId")))
          .toEqual([
            "@$~raw.child@@", "@$~raw.grandChild@@", "@$~raw.greatGrandChild@@",
            "@$~raw.greatGrandChildOwnling@@", "@$~raw.grandSibling@@", "@$~raw.ownling@@",
          ]);
    });
    it("0000101: recurseMaterializedFieldResources kueries must not leak non-vrapped data", () => {
      // Bug was indeed directly with recurseMaterializedFieldResources: it was returning packed
      // transients inside a native container, which is forbidden.
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        created({ id: ["top"], typeName: "Entity", initialState: {
          name: "TopElement",
          owner: [testRootId],
        }, }),
        created({ id: ["middleA"], typeName: "Entity", initialState: {
          name: "MiddleElementA",
          owner: vRef("top"),
        }, }),
        created({ id: ["middleB"], typeName: "Entity", initialState: {
          name: "MiddleElementB",
          owner: vRef("top"),
        }, }),
        created({ id: ["bottom"], typeName: "Entity", initialState: {
          name: "BottomElement",
          owner: vRef("middleA"),
        }, }),
      ]);
      const top = entities().top;
      const recurseKuery = VALEK.recurseMaterializedFieldResources(["unnamedOwnlings"]);
      const filtered = top.step(recurseKuery.filter(VALEK.isTruthy()));
      const unfiltered = top.step(recurseKuery);

      expect(filtered[0] instanceof Vrapper).toEqual(true);
      expect(unfiltered[0] instanceof Vrapper).not.toEqual(false); // <-- differentiate jest output
    });
  });

  const basicProperties = {
    type: "TRANSACTED",
    actions: [
      created({ id: ["test-testField"], typeName: "Property", initialState: {
        owner: vRef("test", "properties"),
        name: "testField",
        value: { typeName: "Literal", value: "testOwned.testField" },
      }, }),
      created({ id: ["test-secondField"], typeName: "Property", initialState: {
        owner: vRef("test", "properties"),
        name: "secondField",
        value: { typeName: "Literal", value: "testOwned.secondField" },
      }, }),
      created({ id: ["grandChild-testField"], typeName: "Property", initialState: {
        owner: vRef("grandChild", "properties"),
        name: "testField",
        value: { typeName: "Literal", value: "grandChildOwned.testField" },
      }, }),
      created({ id: ["grandSibling-siblingField"], typeName: "Property", initialState: {
        owner: vRef("grandSibling", "properties"),
        name: "siblingField",
        value: { typeName: "Literal", value: "grandSiblingOwned.siblingField" },
      }, }),
    ],
  };

  describe("valospace scope - basic accesses", () => {
    it("reads property values through valospace scope", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      const test = testScriptyThings().test;
      expect(test.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(test.getFabricScope().testField)
          .toEqual("testOwned.testField");
      expect(test.step(VALEK.fromScope("secondField").toValueLiteral()))
          .toEqual("testOwned.secondField");
      expect(test.getFabricScope().secondField)
          .toEqual("testOwned.secondField");
      const testInstance = testScriptyThings().test;
      expect(testInstance.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testInstance.getFabricScope().testField)
          .toEqual("testOwned.testField");
      expect(testInstance.step(VALEK.fromScope("secondField").toValueLiteral()))
          .toEqual("testOwned.secondField");
      expect(testInstance.getFabricScope().secondField)
          .toEqual("testOwned.secondField");
    });

    it("accesses grand-parent properties through valospace scope", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      const grandChild = testScriptyThings().grandChild;
      expect(grandChild.step(VALEK.fromScope("secondField").toValueLiteral()))
          .toEqual("testOwned.secondField");
      expect(grandChild.getFabricScope().secondField)
          .toEqual("testOwned.secondField");
      const grandChildGhost = grandChild.getGhostIn(testScriptyThings()["test+1"]);
      expect(grandChildGhost)
          .not.toEqual(grandChild);
      expect(grandChildGhost.step("prototype"))
          .toEqual(grandChild);
      expect(grandChildGhost.step(VALEK.fromScope("secondField").toValueLiteral()))
          .toEqual("testOwned.secondField");
      expect(grandChildGhost.getFabricScope().secondField)
          .toEqual("testOwned.secondField");
    });

    it("accesses overridden grand-parent Scope property through valospace scope", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      const grandChild = testScriptyThings().grandChild;
      expect(grandChild.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
      expect(grandChild.getFabricScope().testField)
          .toEqual("grandChildOwned.testField");
      const grandChildGhost = testScriptyThings().grandChild
          .getGhostIn(testScriptyThings()["test+1"]);
      expect(grandChildGhost.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
      expect(grandChildGhost.getFabricScope().testField)
          .toEqual("grandChildOwned.testField");
    });
  });

  describe("valospace scope - renaming and ownership changes", () => {
    it("most recent property with a name overrides its sibling", () => {
      const oldWarn = console.warn;
      console.warn = jest.fn(); // eslint-disable-line
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA,
        createAInstance,
        basicProperties,
      ]);
      testScriptyThings().test.getValospaceScope(); // trigger property listeners
      harness.proclaimTestEvent(
          created({ id: ["test-conflictingTestField"], typeName: "Property", initialState: {
            owner: vRef("test", "properties"),
            name: "testField",
            value: { typeName: "Literal", value: "testOwned.conflictingTestField" },
          }, }));
      expect(console.warn.mock.calls.length).toBe(1);
      expect(console.warn.mock.calls[0][0])
          .toBe(`Overriding existing Property 'testField' in Scope Vrapper$.2@$~raw.test@@`);
      console.warn = oldWarn;
      expect(testScriptyThings().test.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.conflictingTestField");
    });

    it("accesses renamed Scope property", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      testScriptyThings().test.step(VALEK.property("testField"))
          .setField("name", "renamedField");
      expect(testScriptyThings().test.step(VALEK.fromScope("renamedField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptyThings().grandChild.step(
              VALEK.fromScope("renamedField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptyThings().grandChild.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
    });

    it("fails to access previous value of a renamed Scope property", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      expect(testScriptyThings().test.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      testScriptyThings().test.step(VALEK.property("testField"))
          .setField("name", "renamedField");
      expect(() => testScriptyThings().test
              .step(VALEK.fromScope("testField").toValueLiteral(), { verbosity: 0 }))
          .toThrow(/Valk path step head unpacks to 'undefined' at notNull assertion/);
    });

    it("fails to access a removed Scope value", async () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      const vTest = testScriptyThings().test;
      expect(vTest.step(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      await vTest.step(VALEK.property("testField"))
          .destroy().getPremiereStory();
      expect(() => vTest.step(VALEK.fromScope("testField").toValueLiteral(), { verbosity: 0 }))
          .toThrow(/Valk path step head unpacks to 'undefined' at notNull assertion/);
    });

    it("updates lexicalScope when reparented", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      testScriptyThings().greatGrandChild.emplaceAddToField("properties", {
        name: "ggField", value: { typeName: "Literal", value: "ggChildOwned.ggField" }
      });
      expect(testScriptyThings().greatGrandChild.step(
              VALEK.fromScope("ggField").toValueLiteral()))
          .toEqual("ggChildOwned.ggField");
      expect(testScriptyThings().greatGrandChild.step(
              VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
      expect(() => testScriptyThings().greatGrandChild.step(
              VALEK.fromScope("siblingField").toValueLiteral()))
          .toThrow(/Valk path step head unpacks to 'undefined' at notNull assertion/);
      testScriptyThings().greatGrandChild.setField(
          "parent", testScriptyThings().grandSibling);
      expect(testScriptyThings().greatGrandChild.step(
              VALEK.fromScope("ggField").toValueLiteral()))
          .toEqual("ggChildOwned.ggField");
      expect(testScriptyThings().greatGrandChild.step(
              VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptyThings().greatGrandChild.step(
              VALEK.fromScope("siblingField").toValueLiteral()))
          .toEqual("grandSiblingOwned.siblingField");
    });

    it("fails to access a Scope property with no name", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
        created({ id: ["test-namelessField"], typeName: "Property", initialState: {
          owner: vRef("test", "properties"),
          name: "",
          value: { typeName: "Literal", value: "testOwned.namelessField" },
        }, }),
      ]);
      expect(() => testScriptyThings().test.step(VALEK.fromScope("").toValueLiteral()))
          .toThrow(/Valk path step head unpacks to 'undefined' at notNull assertion/);
    });
  });
});
