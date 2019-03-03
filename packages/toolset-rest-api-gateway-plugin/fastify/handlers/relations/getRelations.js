// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpify, dumpObject } from "~/tools";

import { _addToRelationsSourceSteps } from "../_handlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "relations", method: "GET", fastifyRoute: route,
    requiredRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      this.toRelationsFields = ["§->"];
      _addToRelationsSourceSteps(server, route.config.resourceSchema, route.config.relationName,
          this.toRelationsFields);
      server.buildKuery(route.schema.response[200], this.toRelationsFields);
    },
    // async preload () {
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    // }
    handleRequest (request, reply) {
      const scope = server.buildRequestScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
        "\n\ttoRelationsFields:", dumpify(this.toRelationsFields),
      ]);
      scope.resource = server._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
      }
      let results = scope.resource.get(this.toRelationsFields, { scope, verbosity: 0 });
      const { fields } = request.query;
      if (fields) {
        results = server._pickResultFields(results, fields);
      }
      reply.send(JSON.stringify(results, null, 2));
      reply.code(200);
      server.infoEvent(2, () => [
        `${this.name}:`,
        "\n\tresults:", ...dumpObject(results),
      ]);
      return true;
    },
  };
}