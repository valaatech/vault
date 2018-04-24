// @flow
import { GraphQLObjectType, GraphQLList, GraphQLNonNull } from "graphql/type";

import aliasField from "~/core/tools/graphql/aliasField";
import primaryField from "~/core/tools/graphql/primaryField";
import transientField from "~/core/tools/graphql/transientField";

import { toOne, toMany, toManyOwnlings, toNone } from "~/core/tools/graphql/coupling";

import Blob from "~/core/schema/Blob";
import Data from "~/core/schema/Data";
import Discoverable, { discoverableInterface } from "~/core/schema/Discoverable";
import ResourceStub from "~/core/schema/ResourceStub";
import Partition, { partitionInterface } from "~/core/schema/Partition";
import Resource from "~/core/schema/Resource";

import SemVer from "~/core/schema/SemVer";
import Sprite from "~/core/schema/Sprite";
import MediaType from "~/core/schema/MediaType";

import TestDataGlue from "~/core/test/schema/TestDataGlue";
import TestGlue from "~/core/test/schema/TestGlue";

// TODO(iridian): This introduces library cross-dependence and should be replaced.
import Scope, { scopeInterface } from "~/script/schema/Scope";

const OBJECT_DESCRIPTION = "testing partition";

const TestScriptyThing = new GraphQLObjectType({
  name: "TestScriptyThing",

  description: "An encompassing partition for testing core schema and tools.",

  interfaces: () => [Partition, Scope, Discoverable, Resource, ResourceStub],

  fields: () => ({
    ...discoverableInterface(OBJECT_DESCRIPTION).fields(),
    ...scopeInterface(OBJECT_DESCRIPTION).fields(),
    ...partitionInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("parent", "owner", TestScriptyThing,
        "Non-owning parent test partition",
        { coupling: toOne({ coupledField: "children" }) },
    ),

    ...primaryField("children", new GraphQLList(TestScriptyThing),
        "Ownling child test partitions",
        { coupling: toManyOwnlings() },
    ),

    ...primaryField("siblings", new GraphQLList(TestScriptyThing),
        "Sibling test partitions",
        { coupling: toMany({ coupledField: "siblings" }) },
    ),

    ...primaryField("uncoupledField", TestScriptyThing,
        "TestScriptyThing reference with no coupling",
        { coupling: toNone() },
    ),

    ...primaryField("targetGlues", new GraphQLList(TestGlue),
        "Target Glue's",
        { coupling: toManyOwnlings() },
    ),

    ...transientField("sourceGlues", new GraphQLList(TestGlue),
        "Source Glue's",
        { coupling: toMany({ coupledField: "target" }) },
    ),

    ...primaryField("sourceDataGlues", new GraphQLList(TestDataGlue),
        "Source DataGlue's",
    ),

    ...primaryField("targetDataGlues", new GraphQLList(Data),
        "Target DataGlue's",
    ),

    ...primaryField("version", new GraphQLNonNull(SemVer),
        "Version of the testing partition",
    ),

    ...primaryField("blobs", new GraphQLList(Blob),
        "Blob's contained in the testing partition",
    ),

    ...primaryField("music", new GraphQLList(Sprite),
        "Referenced abstract denoted music Sprite's in the testing partition",
    ),

    ...primaryField("mediaType", MediaType,
    `The media type of this test partition`),
  }),
});

export default TestScriptyThing;