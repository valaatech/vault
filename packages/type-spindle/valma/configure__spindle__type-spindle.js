const { createConfigureToolsetOptions, configureToolSelection } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-spindle" };
exports.command = ".configure/.type/.spindle/@valos/type-spindle";
exports.brief = "configure 'type-spindle'";
exports.describe = "Configure the 'type-spindle' toolset";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "spindle")
    && `Workspace is not a spindle`;
exports.builder = (yargs) => yargs.options({
  ...createConfigureToolsetOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing spindle config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");

  const devDependencies = {};
  if (!vlm.getPackageConfig("devDependencies", "@valos/tools")) {
    if (await vlm.inquireConfirm(`Install @valos/tools in devDependencies?`)) {
      devDependencies["@valos/tools"] = yargv.vlm.domainVersionTag("@valos/kernel");
    }
  }

  const selectionResult = await configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { command: exports.command, devDependencies, ...selectionResult };
};
