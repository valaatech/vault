// @flow

import { dumpKuery, dumpObject } from "~/engine/VALEK";
import Vrapper, { LiveUpdate } from "~/engine/Vrapper";

import { invariantify, thenChainEagerly, wrapError } from "~/tools";

import type UIComponent from "./UIComponent";
import { getScopeValue, setScopeValue } from "./scopeValue";

import { _comparePropsOrState } from "./_propsOps";
import { _initiateSubscriptions, _finalizeUnbindSubscribersExcept } from "./_subscriberOps";

// const _timings = {};

// function _addTiming (/* component, name, start, ...rest */) {
  /*
  return;
  const duration = performance.now() - start;
  const timing = _timings[name] || (_timings[name] = { total: 0, count: 0 });
  timing.total += duration;
  ++timing.count;
  console.log(component.constructor.name, component.getKey(), name, ...rest,
      "duration:", duration, "count:", timing.count, "total:", timing.total);
  */
// }

export function _componentWillMount (component: UIComponent) {
  // const start = performance.now();
  component._activeParentFocus = _getActiveParentFocus(component, component.props);
  _updateFocus(component, component.props);
  // _addTiming(component, "componentWillMount.updateFocus", start);
}

export function _componentWillReceiveProps (component: UIComponent, nextProps: Object,
    nextContext: Object, forceReattachListeners: ?boolean) {
  // const start = performance.now();
  const nextActiveParentFocus = _getActiveParentFocus(component, nextProps);
  const shouldUpdateFocus = (forceReattachListeners === true)
      || (nextProps.uiContext !== component.props.uiContext)
      || (nextProps.parentUIContext !== component.props.parentUIContext)
      || (component._activeParentFocus !== nextActiveParentFocus)
      || (nextProps.focus !== component.props.focus)
      || (nextProps.head !== component.props.head)
      || (nextProps.kuery !== component.props.kuery)
      || _comparePropsOrState(nextProps.context, component.props.context, "shallow")
      || _comparePropsOrState(nextProps.locals, component.props.locals, "shallow");
  // _addTiming(component, "componentWillReceiveProps.check", start, shouldUpdateFocus);
  if (shouldUpdateFocus) {
    component._activeParentFocus = nextActiveParentFocus;
    // const startUpdate = performance.now();
    _updateFocus(component, nextProps);
    // _addTiming(component, "componentWillReceiveProps.updateFocus", startUpdate);
  }
}

// If there is no local props focus, we track parent focus changes for props updates.
function _getActiveParentFocus (component: UIComponent, props: Object) {
  if (props.hasOwnProperty("focus") || props.hasOwnProperty("head")
      || !props.parentUIContext) {
    return undefined;
  }
  return props.parentUIContext.hasOwnProperty("focus")
      ? getScopeValue(props.parentUIContext, "focus")
      : getScopeValue(props.parentUIContext, "head");
}

function _updateFocus (component: UIComponent, newProps: Object) {
  try {
    /*
    console.warn(component.debugId(), "._updateFocus",
        "\n\tnew props.uiContext:", newProps.uiContext,
        "\n\tnew props.parentUIContext:", newProps.parentUIContext,
        "\n\tnew props.head:", newProps.head,
        "\n\tnew props.focus:", newProps.focus,
        "\n\tnew props.kuery:", ...dumpKuery(newProps.kuery));
    // */
    component.unbindSubscriptions();
    component._errorObject = null;
    const newUIContext = newProps.uiContext;

    if (newUIContext && newProps.parentUIContext) {
      invariantify(!(newUIContext && newProps.parentUIContext),
      `only either ${component.constructor.name
          }.props.uiContext or ...parentUIContext can be defined at the same time`);
    }

    const scope = newUIContext || newProps.parentUIContext;
    if (!scope) return;
    const focus = newProps.hasOwnProperty("focus")
            ? newProps.focus
        : newProps.hasOwnProperty("head")
            ? newProps.head
        : (getScopeValue(scope, "focus") !== undefined)
            ? getScopeValue(scope, "focus")
            : getScopeValue(scope, "head");
    if (focus === undefined) return;
    if (newProps.kuery === undefined) {
      _createContextAndSetFocus(component, focus, newProps);
      return;
    }
    if (!newProps.parentUIContext) {
      invariantify(newProps.parentUIContext, `if ${component.constructor.name
      }.props.kuery is specified then ...parentUIContext must also be specified`);
    }
    if (component.state.uiContext) {
      component.setUIContextValue("focus", undefined);
      // component.setUIContextValue("head", undefined);
    }
    component.bindLiveKuery("UIComponent_focus", focus, newProps.kuery, {
      scope,
      onUpdate: function updateFocusDependents (liveUpdate: LiveUpdate) {
        _finalizeUnbindSubscribersExcept(component, "UIComponent.focus");
        _createContextAndSetFocus(component, liveUpdate.value(), newProps);
      },
    });
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n ._updateFocus:`,
        "\n\tnew props:", newProps,
        ...(newProps.uiContext ? ["\n\tnew props.uiContext:", newProps.uiContext] : []),
        ...(newProps.parentUIContext
            ? ["\n\tnew props.parentUIContext:", newProps.parentUIContext] : []),
        ...(newProps.kuery ? ["\n\tnew props.kuery:", ...dumpKuery(newProps.kuery)] : []),
        "\n\tcurrent props:", component.props,
        "\n\tstate:", component.state,
    );
  }
}

function _createContextAndSetFocus (component: UIComponent, newFocus: any, newProps: Object) {
  const uiContext = newProps.uiContext
      || component.state.uiContext
      || Object.create(component.props.parentUIContext);
  const currentDepthSlot = component.getValos().Lens.currentRenderDepth;
  uiContext[currentDepthSlot] = (component.props.parentUIContext[currentDepthSlot] || 0) + 1;
  if (newProps.context) {
    for (const name of Object.getOwnPropertyNames(newProps.context)) {
      setScopeValue(uiContext, name, newProps.context[name]);
    }
    for (const symbol of Object.getOwnPropertySymbols(newProps.context)) {
      setScopeValue(uiContext, symbol, newProps.context[symbol]);
    }
  }
  uiContext.reactComponent = component;
  if (component.state.uiContext !== uiContext) {
    component.setState({ uiContext }, _attachSubscribersWhenDone);
  } else {
    _attachSubscribersWhenDone();
    component.forceUpdate();
  }
  function _attachSubscribersWhenDone () {
    if (newFocus === undefined) return;
    thenChainEagerly(newFocus, [
      resolvedNewFocus => {
        setScopeValue(uiContext, "focus", resolvedNewFocus);
        setScopeValue(uiContext, "head", resolvedNewFocus);
        const isResource = (newFocus instanceof Vrapper) && newFocus.isResource();
        return isResource && (newFocus.activate() || true);
      },
      (isResource) => {
        if (!isResource) return component;
        if (newFocus.isActive()) {
          // If some later update has updated focus prevent subscriber
          // attach and let the later update handle it instead.
          if (newFocus !== getScopeValue(uiContext, "focus")) return undefined;
          return component;
        }
        let error;
        if (newFocus.isInactive() || newFocus.isActivating()) {
          error = new Error(`Resource ${newFocus.debugId()} did not activate properly; ${
            ""} expected focus status to be 'Active', got '${newFocus.getPhase()}' instead`);
          error.slotName = newFocus.isInactive() ? "inactiveLens" : "activatingLens";
        } else if (newFocus.isImmaterial()) {
          error = new Error(`Resource ${newFocus.debugId()} has been destroyed`);
          error.slotName = "destroyedLens";
        } else if (newFocus.isUnavailable()) {
          error = new Error(`Resource ${newFocus.debugId()} is unavailable`);
          error.slotName = "unavailableLens";
        } else {
          error = new Error(`Resource ${newFocus.debugId()} has unrecognized phase '${
            newFocus.getPhase()}'`);
        }
        throw error;
      },
      component_ => component_ && _initiateSubscriptions(component, newFocus, newProps),
    ], function errorOnCreateContextAndSetFocus (error) {
      component.enableError(
          wrapError(error, new Error(`createContextAndSetFocus()`),
              "\n\tnew focus:", ...dumpObject(newFocus),
              "\n\tnew props:", ...dumpObject(newProps),
              "\n\tnew uiContext:", ...dumpObject(uiContext),
              "\n\tcomponent:", ...dumpObject(component)),
          "UIComponent._createContextAndSetFocus");
    });
  }
}

export function _shouldComponentUpdate (component: UIComponent, nextProps: Object,
    nextState: Object, nextContext: Object): boolean { // eslint-disable-line
  // const start = performance.now();
  const ret = _comparePropsOrState(component.props, nextProps, "deep",
          component.constructor.propsCompareModesOnComponentUpdate, "props")
      || _comparePropsOrState(component.state, nextState, "deep",
          component.constructor.stateCompareModesOnComponentUpdate, "state");
  // _addTiming(component, "shouldComponentUpdate.check", start, ret);
  return ret;
}

export function _componentWillUnmount (component: UIComponent) {
  // const start = performance.now();
  component._isMounted = false;
  component.unbindSubscriptions();
  if (component.context.releaseVssSheets) component.context.releaseVssSheets(component);
  // _addTiming(component, "componentWillUnmount", start);
}
