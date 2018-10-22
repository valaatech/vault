import { GraphQLString, GraphQLObjectType, GraphQLInputObjectType, GraphQLNonNull }
    from "graphql/type";

import mutationInputField from "~/raem/tools/graphql/mutationInputField";
import mutationPayloadField from "~/raem/tools/graphql/mutationPayloadField";
import destroyed from "~/raem/command/destroyed";

const DestroyMutationInput = new GraphQLInputObjectType({
  name: "DestroyMutationInput",
  fields: {
    ...mutationInputField("clientMutationId", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("id", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("typeName", new GraphQLNonNull(GraphQLString)),
  },
});

const DestroyMutationPayload = new GraphQLObjectType({
  name: "DestroyMutationPayload",
  fields: {
    ...mutationPayloadField("clientMutationId", new GraphQLNonNull(GraphQLString)),
  },
});

const destroy = {
  type: DestroyMutationPayload,
  description: "Elementary destroy resource",
  args: {
    input: { type: new GraphQLNonNull(DestroyMutationInput) },
  },
  resolve: async (context, args/* , info */) => {
    try {
      const proclamation = await context.store.dispatch(destroyed(args.input));
      return {
        clientMutationId: proclamation.id,
      };
    } catch (error) {
      console.error(error.message, error.stack);
      throw error;
    }
  },
};

export default destroy;
