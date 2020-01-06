// @flow
import PropTypes from "prop-types";

import { tryUnpackedHostValue } from "~/raem/VALK/hostReference";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import UIComponent from "~/inspire/ui/UIComponent";

import { thenChainEagerly } from "~/tools";

/**
 * Valoscope performs a semantically rich, context-aware render of its local UI focus according to
 * following rules:
 *
 * 1. If component is disabled (ie. its local UI context is undefined):
 *    value-renders (value-rendering defined in section 9.) props/context "disabledLens".
 *    disabledLens must not make any UI context nor UI focus references.
 *
 * 2. If main UI focus kuery is still pending (ie. UI focus is undefined):
 *    value-renders props/context "pendingLens", "loadingLens" or "disabledLens".
 *    A pending kuery is an asynchronous operation which hasn't returned the initial set of values.
 *    pendingLens can refer to UI context normally, but cannot refer to (still-undefined) UI focus.
 *
 * 3. If props.lens or context.lens is defined:
 *    value-renders props/context "lens".
 *    This allows overriding any further render semantics with a specific, hard-coded UI element
 *    which still knows that the main UI focus kuery has been completed.
 *    lens can refer to UI context and UI focus normally.
 *
 * 4. If UI focus is null:
 *    value-renders props/context "nullLens" or "disabledLens".
 *
 * 5. If UI focus is a string, a number, a React element, a function or a boolean:
 *    value-renders focus.
 *    This is the basic literal value rendering rule.
 *    Any React element or function content can refer to UI context and UI focus normally.
 *
 * 6. If UI focus is a valos resource, an appropriate valos Lens for it is located and rendered
 *    (with the resource set as its focus) as per rules below.
 *    valos Lens is a UI component which always has valos Resource as its focus.
 * 6.1. If UI focus is not an Active valos resource, ie. if any of its partitions does not have a
 *    fully formed active connection, then:
 * 6.1.1. If UI focus is an Inactive valos resource, ie. if some of its partitions are not connected
 *    and no connection attempt is being made:
 *    value-renders props/context "inactiveLens" or "disabledLens".
 * 6.1.2. If UI focus is an Activating valos resource, ie. if all of its partitions are either
 *    connected or a connection attempt is being made:
 *    value-renders props/context "activatingLens", "loadingLens" or "disabledLens".
 * 6.1.3. If UI focus is an Unavailable valos resource, ie. if some of its partitions connections
 *    have failed (due to networks issues, permission issues etc.):
 *    value-renders props/context "unavailableLens" or "disabledLens".
 * 6.1.4. If UI focus is an Immaterial non-ghost valos resource:
 *    value-renders props/context "destroyedLens" or "disabledLens".
 * 6.2. If props.activeLens or context.activeLens is defined:
 *    value-renders props/context "activeLens".
 *    Like lens this overrides all further render semantics, but unlike lens
 *    the activeLens content can assume that UI focus is always a valid valos Resource.
 * 6.3. if either props.lensProperty or context.lensProperty is defined (lensProperty from hereon)
 *    and getFocus().propertyValue(lensProperty) is defined:
 *    value-renders getFocus().propertyValue(lensProperty).
 * 6.4. otherwise:
 *    value-renders props/context "lensPropertyNotFoundLens" or "disabledLens".
 *
 * 7. If UI focus is an array or a plain object, Valoscope behaves as if it was a ForEach component
 *    and renders the focus as a sequence, with following rules:
 * 7.1. all Valoscope props which ForEach uses are forwarded to ForEach as-is,
 * 7.2. props.EntryUIComponent default value is Valoscope instead of UIComponent,
 * 7.3. if UI focus is a plain object it is converted into an array using following rules:
 * 7.3.1. array entries are the UI focus object values, ordered lexicographically by their keys,
 * 7.3.2. the ForEach entry props (and thus the React key) for each entry element is created using
 *    childProps(key, { ... }) instead of uiComponentProps({ ... }).
 *
 * 8. Otherwise:
 *    throws a failure for unrecognized UI focus (ie. a complex non-recognized object)
 *
 * 9. value-render process renders a given value(s) directly ie.
 *    without further valos or react operations), as follows:
 * 9.1. if value-render is given multiple values, the first one which is defined is used as value,
 * 9.2. if value === false, if value === null or if it is not defined:
 *    renders null.
 * 9.3. if value is a function:
 *    value-renders value(getUIContext()).
 *    The current UI focus can be found in getUIContext().focus.
 * 9.4. if value === true:
 *    renders props.children.
 * 9.5. if value is a string, number, or a React element:
 *    renders value.
 * 9.6. if value is a valos Resource:
 *    renders <Valoscope focus={value} />.
 * 9.7. otherwise:
 *    throws an exception for unrecognized value
 *
 * @export
 * @class Valoscope
 * @extends {UIComponent}
 */
export default class Valoscope extends UIComponent {
  static mainLensSlotName = "valoscopeLens";

  static propTypes = {
    ...UIComponent.propTypes,
    lensName: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  };

  static contextTypes = {
    ...UIComponent.contextTypes,
    engine: PropTypes.object,
  };

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    const valos = this.getValos();
    this.setUIContextValue(valos.Lens.scopeChildren, props.children);
    const vOwner = this.getParentUIContextValue(valos.Lens.scopeFrameResource);
    const obtainScopeFrame = this.getUIContextValue(valos.Lens.obtainScopeFrame);
    const key = this.getKey();
    thenChainEagerly(
        obtainScopeFrame(props.instanceLensPrototype, vOwner, focus, key, this), [
          (scopeFrame) => {
            this.setUIContextValue("frame", scopeFrame);
            if (scopeFrame === undefined) return undefined;
            if ((typeof key === "string") && (key[0] !== "-") && (vOwner != null)
                && (vOwner instanceof Vrapper) && vOwner.hasInterface("Scope")
                && (vOwner.propertyValue(key) !== scopeFrame)) {
              // TODO(iridian): This is initial non-rigorous prototype functionality:
              // The owner[key] value remains set even after the components get detached.
              vOwner.alterProperty(key, VALEK.fromValue(scopeFrame));
            }
            const vScopeFrame = tryUnpackedHostValue(scopeFrame);
            if (vScopeFrame) this.setUIContextValue(valos.Lens.scopeFrameResource, vScopeFrame);
            return vScopeFrame || scopeFrame;
          },
          (scopeFrame) => this.setState({ scopeFrame }),
        ],
        (error) => this.enableError(error));
  }

  renderLoaded (focus: any) {
    if (Array.isArray(focus)) {
      return this.renderFocusAsSequence(focus, this.props.forEach, Valoscope);
    }
    // Render using current focus as the lens and null as the focus.
    return this.renderLens(focus, null, "focus");
  }
}
