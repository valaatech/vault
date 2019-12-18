// @flow

import Vrapper from "~/engine/Vrapper";

import type { PrefixRouter } from "~/rest-api-spindle/MapperService";

import { dumpObject } from "~/tools";

import { _vakonpileVPath } from "./_vakonpileOps";

export function _createProjectorRuntime (router: PrefixRouter, { name, url, config }, runtime) {
  for (const ruleName of (config.requiredRules || [])) {
    if (config.rules[ruleName] === undefined) {
      throw new Error(`Required route rule '${ruleName}' missing for route <${url}>`);
    }
  }
  for (const ruleName of (config.requiredRuntimeRules || [])) {
    if (config.rules[ruleName] === undefined) {
      throw new Error(`Required runtime route rule '${ruleName}' missing for route <${url}>`);
    }
  }
  const scopeBase = runtime.scopeBase = Object.create(router.getViewScope());
  runtime.name = name;
  runtime.ruleResolvers = [];
  runtime.staticResources = [];
  runtime.identity = router.getIdentity();

  Object.entries(config.rules).forEach(([ruleName, rule]) => {
    if (!Array.isArray(rule)) {
      scopeBase[ruleName] = rule;
      return;
    }
    let ruleVAKON, maybeStaticReference, resolveRule;
    try {
      ruleVAKON = _vakonpileVPath(rule, runtime);
      maybeStaticReference = (ruleVAKON != null) && (ruleVAKON[0] === "§ref")
          && !ruleVAKON[1].slice(1).find(e => Array.isArray(e))
          && ruleVAKON[1].slice(1);
      resolveRule = maybeStaticReference
              ? (engine => engine.getVrapper(maybeStaticReference, { contextPartitionURI: null }))
          : (ruleVAKON !== null)
              ? ((engine, head, options) => engine.run(head, ruleVAKON, options))
              : (engine, head) => head;
      if (ruleName === "routeRoot") {
        runtime.resolveRouteRoot = resolveRule;
      } else {
        runtime.ruleResolvers.push([
          ruleName, resolveRule, (config.requiredRuntimeRules || []).indexOf(ruleName) !== -1,
        ]);
      }
    } catch (error) {
      throw router.wrapErrorEvent(error, new Error(`prepareRule(${ruleName})`),
          "\n\trule:", ...dumpObject(rule),
          "\n\truleVAKON:", ...dumpObject(ruleVAKON),
          "\n\tmaybeStaticReference:", ...dumpObject(maybeStaticReference),
      );
    }
  });
  return runtime;
}

export async function _preloadRuntimeResources (router: PrefixRouter, projector, runtime) {
  let vRouteRoot;
  try {
    runtime.scopeBase.serviceIndex = router.getViewFocus();
    if (runtime.scopeBase.serviceIndex === undefined) {
      throw new Error(`Can't locate service index for ${router._projectorName(projector)}`);
    }

    if (!runtime.resolveRouteRoot) {
      throw new Error(`Route root rule 'routeRoot' missing for ${
          router._projectorName(projector)}`);
    }
    vRouteRoot = runtime.scopeBase.routeRoot = runtime.resolveRouteRoot(
        router.getEngine(), runtime.scopeBase.serviceIndex, { scope: runtime.scopeBase });
    if (!(vRouteRoot instanceof Vrapper)) {
      throw new Error(`Route root is not a resource for ${router._projectorName(projector)}`);
    }
    router.infoEvent(1, () => [`Preloading projector ${router._projectorName(projector)}`,
        "; activating", runtime.staticResources.length, "static rule resources and root",
        vRouteRoot.debugId()]);
    const rootActivation = vRouteRoot.activate();
    if (rootActivation) await rootActivation;
    const activations = runtime.staticResources
        .map(staticResource => router.getEngine()
            .getVrapper(staticResource, { contextPartitionURI: null }).activate())
        .filter(e => e);
    await Promise.all(activations);
    router.infoEvent(1, () => ["Done preloading projector:", router._projectorName(projector),
        (rootActivation
            ? "\n\twaited for route root activation:"
            : "\n\troute root already active:"), ...dumpObject(vRouteRoot.debugId()),
        "\n\twaited for", activations.length, `static resource activations (${
          runtime.staticResources.length - activations.length} were already active})`]);
  } catch (error) {
    throw router.wrapErrorEvent(error, new Error(`preloadRuntimeResources(${
            router._projectorName(projector)})`),
        "\n\tvRouteRoot:", ...dumpObject(vRouteRoot),
        "\n\tconfig.rules:", JSON.stringify(projector.config.rules, null, 2),
    );
  }
}

export function _buildRuntimeVALKOptions (
    router: PrefixRouter, projector, runtime, request, reply) {
  const scope = Object.create(runtime.scopeBase);
  const valkOptions = { scope };
  scope.request = request;
  scope.reply = reply;
  return valkOptions;
}

export function _resolveRuntimeRules (router: PrefixRouter, runtime, valkOptions) {
  const scope = valkOptions.scope;
  // TODO: create transaction here.
  for (const [ruleName, resolveRule, requireRuntimeRule] of runtime.ruleResolvers) {
    scope[ruleName] = resolveRule(router.getEngine(), scope.routeRoot, Object.create(valkOptions));
    if (requireRuntimeRule && (scope[ruleName] === undefined)) {
      if (typeof requireRuntimeRule === "function") {
        return requireRuntimeRule(ruleName, router.getEngine(), scope.routeRoot, valkOptions);
      }
      scope.reply.code(400);
      scope.reply.send(`Required route runtime rule '${ruleName}' resolved into undefined`);
      return true;
    }
  }
  return false; // Success.
}
