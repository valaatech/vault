exports.command = ".configure/.domain/packages";
exports.summary = "Configure a Valaa repository to be part of the packages utility domain";
exports.describe = `${exports.summary}.

Packages utility domain provides tools for assembling and publishing
packages to npm repositories.`;

exports.builder = (yargs) => yargs;

exports.handler = (yargv) => yargv.vlm.invoke(`.configure/.domain/.packages/**/*`);