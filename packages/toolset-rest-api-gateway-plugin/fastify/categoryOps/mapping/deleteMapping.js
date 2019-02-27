// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
  return (request, reply) => {
    const sourceId = request.params[route.config.sourceIdRouteParam];
    const targetId = request.params[route.config.targetIdRouteParam];
    server.logEvent(1, () => [
      `mapping DELETE ${route.url}:`, sourceId, route.config.mappingName, targetId,
      "\n\trequest.query:", request.query,
    ]);
    reply.code(501);
    reply.send("Not implemented");
  };
}
