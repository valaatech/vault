exports.vlm = { toolset: "@valos/type-vault" };
exports.command = ".configure/.@valos/type-vault/.tools/.select/domain";
exports.brief = "select domain management";
exports.describe = "Select domain management tool for a vault workspace";
exports.introduction =
`This type-vault tool enables the domain management and (re)generation
of docs/index.html domain summary revdoc document.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a vault (is ${yargs.vlm.getValOSConfig("type")})`;

exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolOptions(exports),
  "regenerate-on-release": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "regenerateOnRelease"),
    description: "Regenerate domain summary revdoc on each vault (pre)release",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
  "summary-target": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "domain", "summaryTarget")
        || `packages/${yargs.vlm.getValOSConfig("domain")
            .split(yargs.vlm.getValOSConfig("prefix") || "/")[1] || "REPLACEME"}/summary.json`,
    description: "Target domain summary JSON path",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const domain = vlm.getValOSConfig("domain");
  const domainWorkshopPath = vlm.path.join(process.cwd(), "packages", domain.split("/")[1]);
  if (!vlm.shell.test("-d", domainWorkshopPath) &&
      await vlm.inquireConfirm(`Create domain workshop workspace ${vlm.theme.package(domain)} at ${
          vlm.theme.path(domainWorkshopPath)}?`)) {
    vlm.shell.mkdir("-p", domainWorkshopPath);
    vlm.shell.pushd(domainWorkshopPath);
    await vlm.invoke(`init`, {
      description: `The domain '${domain}' workshop`,
      valos: { type: "workshop", domain },
      devDependencies: false,
    });
    vlm.shell.popd();
  }
  return {
    command: exports.command,
    toolsetsUpdate: { [yargv.vlm.toolset]: { tools: { domain: {
      inUse: true,
      regenerateOnRelease: yargv["regenerate-on-release"] || false,
      summaryTarget: yargv["summary-target"] || "",
    } } } },
  };
};
