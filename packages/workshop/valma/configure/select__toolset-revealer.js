exports.vlm = { toolset: "@valos/toolset-revealer" };
exports.command = ".configure/.select/@valos/toolset-revealer";
exports.describe = "Configure the workspace toolset 'toolset-revealer'";
exports.introduction = `${exports.describe}.

Adds valma command 'rouse-revealer'.

Sets up the webpack entry and output config as webpack.config.js in
the repository root, which combines shared revealer config from
@valos/toolset-revealer/shared/webpack.config.js, local toolset config
and any customizations in the root webpack.config.js itself.`;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => !yargs.vlm.getToolsetsConfig()
    && "Can't select 'toolset-revealer': toolset config missing";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'toolset-revealer' config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  // This script is outdated: it combines select and configure script.
  // The configure script should be extracted and moved under
  // @valos/toolset-revealer actual. See type/toolsets.js for how new
  // select/configure scripts are created.
  const vlm = yargv.vlm;
  const toolsetWebpackConfig = vlm.getToolsetConfig(vlm.toolset, "webpack");
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying revealer template files from ", vlm.theme.path(templates),
      "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
  vlm.instruct(`! Edit ${vlm.theme.path("webpack.config.js")
      } to configure webpack entry and output locations.`);
  if (!toolsetWebpackConfig) {
    vlm.updateToolsetConfig(vlm.toolset, {
      webpack: {
        entry: { "valos-inspire": "./node_modules/@valos/inspire/index.js" },
        output: {
          path: "dist/revealer/valos/inspire/",
          publicPath: "/valos/inspire/",
          filename: "[name].js"
        }
      }
    });
    vlm.instruct(`! Edit toolsets.json:['${vlm.theme.package(vlm.toolset
        )}'].webpack to further configure webpack entry and output locations.`);
  }
  const devDependencies = { "@valos/toolset-revealer": true };
  if (!vlm.getPackageConfig("devDependencies", "@valos/inspire")) {
    if (await vlm.inquireConfirm(`Install @valos/inspire in devDependencies?`)) {
      devDependencies["@valos/inspire"] = true;
    }
  }
  return {
    command: exports.command,
    devDependencies,
  };
};