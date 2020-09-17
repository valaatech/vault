// @flow

import { qualifiedSymbol } from "~/raem/tools/namespaceSymbols";

import { getValosheathNamespace, integrateNamespace } from "~/engine/valosheath";

const LensNamespace = require("~/inspire/Lens");
const OnNamespace = require("~/inspire/On");

export default function extendValOSWithInspire (rootScope: Object, hostDescriptors: any) {
  const valosheath = rootScope.valos || (rootScope.Valaa = rootScope.valos = {});

  valosheath.Lens = integrateNamespace(LensNamespace, rootScope, hostDescriptors);
  valosheath.On = integrateNamespace(OnNamespace, rootScope, hostDescriptors);
  const primaryNamespace = getValosheathNamespace(valosheath, "valos");
  Object.getOwnPropertyNames(valosheath.Lens).forEach(lensName => {
    primaryNamespace.addSymbolField(lensName, valosheath.Lens[lensName]);
  });
  for (const deprecatedName of Object.keys(LensNamespace.deprecatedNames)) {
    Object.defineProperty(valosheath, deprecatedName, {
      configurable: false, enumerable: false,
      get () { return qualifiedSymbol("Lens", deprecatedName); },
    });
  }
}
