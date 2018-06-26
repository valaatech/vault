exports.command = ".configure/.type/authollery";
exports.summary = "Configure a Valaa authollery repository";
exports.describe = `${exports.summary}.

Authollery is a portmanteau of AUTHority contrOLLEr repositoRY.
Autholleries are responsible for configuring, deploying, updating,
monitoring and diagnosing all types of live infrastructure resources
which relate to a particular Valaa authority.

Autholleries rely heavily on various toolsets to get their job done.

Will add '@valos/toolset-authollery' as devDependency.`;

exports.builder = (yargs) => yargs;

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!((vlm.packageConfig || {}).devDependencies || {})["@valos/toolset-authollery"]) {
    await vlm.execute("yarn", ["add", "-W", "--dev", "@valos/toolset-authollery"]);
  }
  return vlm.invoke(`.configure/.type/.authollery/**/*`);
};