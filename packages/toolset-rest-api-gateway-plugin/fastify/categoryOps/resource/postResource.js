// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
  return (request, reply) => {
    server.logEvent(1, () => [
      `resource POST ${route.url}:`,
      "\n\trequest.query:", request.query,
      "\n\trequest.body:", request.body,
    ]);
    reply.code(501);
    reply.send("Not implemented");
  };
}
