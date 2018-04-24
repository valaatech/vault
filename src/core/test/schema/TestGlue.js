// @flow
import { GraphQLObjectType } from "graphql/type";

import aliasField from "~/core/tools/graphql/aliasField";
import primaryField from "~/core/tools/graphql/primaryField";

import Discoverable, { discoverableInterface } from "~/core/schema/Discoverable";
import ResourceStub from "~/core/schema/ResourceStub";
import Resource from "~/core/schema/Resource";
import Position from "~/core/schema/Position";
import { toOne } from "~/core/tools/graphql/coupling";

const OBJECT_DESCRIPTION = "test partition glue";

export default new GraphQLObjectType({
  name: "TestGlue",

  interfaces: () => [Discoverable, Resource, ResourceStub],

  description: "An entity connection in 3d space",

  fields: () => ({
    ...discoverableInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("source", "owner", Discoverable,
        "The source partition of the glue",
        { coupling: toOne({ coupledField: "targetGlues" }) },
    ),

    ...primaryField("target", Discoverable,
        "The target partition of the glue",
        { coupling: toOne({ coupledField: "sourceGlues" }) },
    ),

    ...primaryField("dangling", Discoverable,
        "Reference without named coupling",
    ),

    ...primaryField("position", Position,
        "Reference without named coupling",
    ),
  }),
});