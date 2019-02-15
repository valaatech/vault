#!/usr/bin/env vlm

exports.vlm = { toolset: "@valos/toolset-worker" };
exports.command = "perspire [revelationPath] [additionalRevelationPaths..]";
exports.describe = "Launch a headless worker for performing virtual DOM ValOS computation";
exports.introduction = `${exports.describe}.

.`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.option({
  output: {
    type: "string",
    default: "",
    description: "Path of a file to which the view root is rendered as a HTML DOM string",
  },
  exec: {
    type: "object",
    default: null,
    description: `Execute ValaaScript.\n\texec.body = direct VS content to execute. ${
        ""}exec.path = path to a VS file to execute.\n\texec.this = the name of the ${
        ""}resource that is used as 'this' of the VS body; a URI specifies a Resource directly, ${
        ""}otherwise it is used look up a partition connection root resource.\n\tAll the ${
        ""}options are available for the script via Valaa.perspire.options object with possible ${
        ""}expansions.`
  },
  keepalive: {
    default: false,
    description: `Keeps server alive after initial run. If keepalive is a positive number then ${
        ""}the possible output will be rendered and execute script run every 'keepalive' seconds. ${
        ""}If keepalive is negative the output/run cycle is run once after abs(keepalive) seconds.`,
  },
  plugin: {
    type: "string",
    array: true,
    default: [],
    description: `List of plugin id's which are require'd before gateway creation.`,
  },
  partitions: {
    type: "object",
    description: `A lookup of partition URI's to load before execution.${
        ""}\nThe partitions are loaded after revelation partitions but before view is attached.${
        ""}\nValaa.perspire.partitions contains these partitions connected this way as well as the${
        ""}"root" and "view" revelation partitions.`
  },
  cacheBasePath: {
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache base path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    description: "Direct revelation object placed after other revelations for gateway init.",
  },
  siteRoot: {
    type: "string", default: process.cwd(),
    description: `Explicit gateway.options.siteRoot path`,
  },
  domainRoot: {
    type: "string",
    description: `Explicit gateway.options.domainRoot path (by default siteRoot)`,
  },
  revelationRoot: {
    type: "string",
    description: `Explicit gateway.options.revelationRoot path ${
        ""}(by default path.dirname(revelationPath))`,
  },
});

exports.handler = async (yargv) => {
  // revelationPaths parsing
  global.window = global;
  const PerspireServer = require("@valos/inspire/PerspireServer").default;
  const outputError = require("@valos/tools/wrapError").outputError;

  const vlm = yargv.vlm;
  let revelationPath = yargv.revelationPath || "./revela.json";
  let revelationRoot = yargv.revelationRoot;
  if (revelationRoot === undefined) {
    revelationRoot = vlm.path.dirname(revelationPath);
    revelationPath = vlm.path.basename(revelationPath);
  } else {
    revelationPath = vlm.path.resolve(revelationPath);
  }

  const execBody = yargv.exec && (yargv.exec.body || await vlm.readFile(yargv.exec.path, "utf8"));
  if (yargv.exec && (typeof execBody !== "string")) {
    console.warn("execBody:", execBody);
    throw new Error(`Invalid exec body, expected a string, got: '${typeof execBody}' for path "${
        yargv.exec.path}"`);
  }

  vlm.shell.mkdir("-p", yargv.cacheBasePath);

  const server = new PerspireServer({
    logger: vlm,
    plugins: yargv.plugin,
    cacheBasePath: yargv.cacheBasePath,
    siteRoot: yargv.siteRoot || process.cwd(),
    domainRoot: yargv.domainRoot,
    revelationRoot,
    revelations: [
      { "...": revelationPath },
      ...(yargv.additionalRevelationPaths || []).map(p => {
        const absolutePath = vlm.path.resolve(p);
        if (!vlm.shell.test("-f", absolutePath)) {
          throw new Error(`Cannot open additional revelation path "${absolutePath}" for reading`);
        }
        return { "...": absolutePath };
      }),
      { gateway: { verbosity: vlm.verbosity } },
      yargv.revelation || {},
    ],
  });

  await server.initialize();
  const partitions = { root: server.gateway.rootPartition };
  for (const [key, partitionURI] of Object.entries(yargv.partitions || {})) {
    partitions[key] = await server.gateway.falseProphet
        .acquirePartitionConnection(partitionURI, { newPartition: false })
        .getActiveConnection();
  }
  const mainView = await server.createMainView();
  partitions.view = mainView.getViewPartition();

  mainView.rootScope.Valaa.Perspire.options = yargv;

  let vExecThis;
  if (yargv.exec) {
    const vThisConnection = partitions[yargv.exec.this || "view"];
    // TODO(iridian, 2019-02): Add support for URI form exec.this
    vExecThis = mainView.engine.getVrapperByRawId(vThisConnection.getPartitionRawId());
  }

  const keepaliveInterval = (typeof yargv.keepalive === "number")
      ? yargv.keepalive : (yargv.keepalive && 1);
  if (!keepaliveInterval) {
    vlm.info("No keepalive enabled");
    return _tick("immediate", 0, "immediate rendering");
  }
  vlm.info(`Setting up keepalive render every ${keepaliveInterval} seconds`);
  return server.run(Math.abs(keepaliveInterval), (tickIndex) => {
    const ret = _tick(`heartbeat ${tickIndex}:`, tickIndex, "delayed single shot rendering");
    if (keepaliveInterval >= 0) return undefined;
    return ret;
  });

  function _tick (header, tick, mode) {
    const domString = server.serializeMainDOM();
    mainView.rootScope.Valaa.Perspire.state = {
      "...": { chapters: true },
      domString,
      tick,
      mode,
    };
    _writeDomString(domString, header);
    const sourceInfo = {
      phase: "perspisre.exec transpilation",
      source: execBody,
      mediaName: yargv.exec.path || "exec.body",
      sourceMap: new Map(),
    };
    const execResult = vExecThis && execBody && vExecThis.doValaaScript(execBody, { sourceInfo });
    return execResult !== undefined ? execResult : mainView.rootScope.Valaa.Perspire.state;
  }

  function _writeDomString (domString, header) {
    if (yargv.output) {
      vlm.shell.ShellString(domString).to(yargv.output);
      vlm
      .ifVerbose(1).babble(header, `wrote ${domString.length} dom string chars to "${
          yargv.output}"`)
      .ifVerbose(2).expound("\tdom string:\n", domString);
    } else {
      vlm
      .ifVerbose(1).babble(header, `discarded ${domString.length} dom string chars`)
      .ifVerbose(2).expound("\tdom string:\n", domString);
    }
  }
};