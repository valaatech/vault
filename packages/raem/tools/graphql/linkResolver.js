// @flow

import getObjectField from "~/raem/state/getObjectField";
import getObjectTransient from "~/raem/state/getObjectTransient";

import dumpify from "~/tools/dumpify";

// context { rootValue, returnType, parentType, fieldName, operation, fragments, fieldASTs, schema }
export default function linkResolver (source: any, args: any, context: Object) {
  try {
    // console.log(`Resolving link ${context.parentType.name}.${context.fieldName}: ${
    //    returnType.name}`);
    return getObjectTransient(context.rootValue.resolver,
        getObjectField(context.rootValue.resolver, source, context.fieldName));
  } catch (error) {
    const suggestion = error.message.slice(0, 10) !== "source.get" ? "" : `
  Is this a mutation resolver? If so, remember to wrap resolver in mutationResolver.`;
    context.rootValue.logger.error(`During linkResolver for field ${context.fieldName}
  from source: ${dumpify(source, { sliceAt: 1000, sliceSuffix: "...}" })}
  forwarding exception: ${error.message.slice(0, 140)}...${suggestion}`);
    throw error;
  }
}
