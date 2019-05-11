// @flow

/* eslint-disable */

import ContentAPI from "./SourcererContentAPI";
import schemeModules from "./schemeModules";

const valos = require("~/gateway-api/valos").default;

export default valos.exportPlugin({ name: "@valos/sourcerer", ContentAPI, schemeModules });

export {                   default as EVENT_VERSION } from "./tools/EVENT_VERSION";

export {
                                      ContentAPI,
                        ContentAPI as EngineContentAPI,
};
export {                   default as Discourse } from "./api/Discourse";
export {                   default as Follower } from "./api/Follower";
export {                   default as Connection } from "./api/Connection";
export {                   default as Sourcerer } from "./api/Sourcerer";
export                           type Transaction = Object;

export {
                           default as FalseProphet,
                                      deserializeVRL,
} from "./FalseProphet";
export {
                           default as FalseProphetDiscourse
} from "./FalseProphet/FalseProphetDiscourse";

export {                   default as Oracle } from "./Oracle";
export {                   default as DecoderArray } from "./Oracle/DecoderArray";

export {                   default as Scribe } from "./Scribe";

export {                   default as Authority } from "./Authority";
export {
                           default as AuthorityConnection,
                                      AuthorityEventResult,
} from "./Authority/AuthorityConnection";
export {                   default as AuthorityNexus } from "./Authority/AuthorityNexus";
export type {
                                      AuthorityConfig,
                                      AuthorityOptions,
                                      SchemeModule,
} from "./AuthorityNexus";