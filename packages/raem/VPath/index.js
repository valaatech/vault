const { formVPath, formVGRId, formVerb, formParam, formParamValue } = require("./_formOps");
const { expandVPath, expandVKeyPath } = require("./_expandOps");
const {
  validateVPath, validateVKeyPath, validateFullVPath,
  validateVRId, validateVerbs, validateVGRId,
  validateFormatTerm, validateVerb, validateVerbType, validateVParam,
  validateContextTerm, validateContextTermNS, validateParamValueText
} = require("./_validateOps");
const { cementVPath } = require("./_cementOps");

module.exports = {
  formVPath,
  formVGRId,
  formVerb,
  formParam,
  formParamValue,
  validateVPath,
  validateVKeyPath,
  validateFullVPath,
  validateVRId,
  validateVerbs,
  validateVGRId,
  validateFormatTerm,
  validateVerb,
  validateVerbType,
  validateVParam,
  validateContextTerm,
  validateContextTermNS,
  validateParamValueText,
  expandVPath,
  expandVKeyPath,
  cementVPath,
};