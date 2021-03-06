const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/web-spindle" };
exports.command = ".configure/.toolsets/@valos/web-spindle";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset 'web-spindle' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(exports.vlm.toolset) || {};
  return yargs.options({
    port: {
      type: "string", default: toolsetConfig.port,
      interactive: answers => ({
        type: "input",
        default: 80,
        when: answers.reconfigure ? "always" : "if-undefined",
      }),
      description: "The port the Web API listens.",
    },
    address: {
      type: "string", default: toolsetConfig.address,
      interactive: answers => ({
        type: "input",
        default: "0.0.0.0",
        when: answers.reconfigure ? "always" : "if-undefined",
      }),
      description: "The local address the Web API is bound to.",
    },
    ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset);
  const toolsetConfigUpdate = {
    ...toolsetConfig,
    port: yargv.port,
    address: yargv.address,
  };
  if (toolsetConfigUpdate.title === undefined) {
    // TOOD(iridian, 2020-06): Make these conditional on user
    // selecting the copy-template-files tool
    Object.assign(toolsetConfigUpdate, {
      title: "openapi Example Title",
      serviceGETHandlerName: "handleGET",
      servicePUTHandlerName: "handlePUT",
      serviceDELETEHandlerName: "handleDELETE",
      servicePOSTHandlerName: "handlePOST",
    });
    await vlm.updateFileConfig("./revela.json", {
      spindles: {
        "@valos/web-spindle": { "!!!": "./revelation_web-spindle" },
      },
    });
  }
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  await require("@valos/type-worker")
      .updateSpindleAsWorkerTool(vlm, vlm.toolset, true);

  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);

  return {
    ...selectionResult,
    success: true,
  };
};
