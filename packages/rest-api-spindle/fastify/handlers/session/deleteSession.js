
import type MapperService from "~/rest-api-spindle/fastify/MapperService";
import { burlaesgDecode, hs256JWTDecode } from "~/rest-api-spindle/fastify/security";

export default function createRouter (mapper: MapperService /* , route: Route */) {
  return {
    requiredRules: [
      "routeRoot", "clientRedirectPath", "clientCookie", "sessionCookie",
    ],

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);

      const routeIdentity = this.runtime.identity;
      if (!routeIdentity) {
        throw new Error("Cannot prepare session route DELETE: service identity not configured");
      }
      this.runtime.scopeBase.identity = Object.freeze({
        clientSecret: routeIdentity.clientSecret,
        clientURI: routeIdentity.clientURI,
        clientCookieName: routeIdentity.getClientCookieName(),
        sessionCookieName: routeIdentity.getSessionCookieName(),
      });
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      mapper.infoEvent(1, () => [
        "\n\trequest.query:", request.query,
        "\n\trequest.cookies:", request.cookies,
      ]);
      if (!scope.clientCookie || !scope.sessionCookie) {
        reply.code(404);
        reply.send("No session found");
        return true;
      }
      const { identityPartition } =
          burlaesgDecode(scope.sessionCookie, scope.identity.clientSecret).payload;
      const { iss, sub } =
          hs256JWTDecode(scope.clientCookie, scope.identity.clientSecret).payload;
      if (iss !== scope.identity.clientURI || !identityPartition || (identityPartition !== sub)) {
        reply.code(400);
        reply.send("Bad Request");
        return true;
      }
      reply.setCookie(scope.identity.clientCookieName, "",
          { httpOnly: false, secure: true, maxAge: 0, path: scope.clientRedirectPath });
      reply.setCookie(scope.identity.sessionCookieName, "",
          { httpOnly: true, secure: true, maxAge: 0, path: scope.clientRedirectPath });
      reply.code(303);
      reply.redirect(scope.clientRedirectPath);
      return true;
    },
  };
}
