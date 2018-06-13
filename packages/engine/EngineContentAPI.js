import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ProphetContentAPI from "~/prophet/ProphetContentAPI";

export default createContentAPI({
  name: "ValaaEngineContentAPI",
  inherits: [ProphetContentAPI],
  exposes: [],
});