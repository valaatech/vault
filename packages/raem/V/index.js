module.exports = {
  base: require("@valos/kernel/V"),
  extenderModule: "@valos/raem/V",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    V: "@valos/kernel/V",
  },
  vocabulary: {
    ...require("./Resource"),
    ...require("./Bvob"),
    ...require("./Absent"),
    ...require("./Extant"),
    ...require("./NonExistent"),
  },
};