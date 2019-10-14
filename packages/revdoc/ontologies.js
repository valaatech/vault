const { extendOntology } = require("@valos/vdoc");

module.exports = extendOntology("revdoc", "https://valospace.org/revdoc#", {}, {
  Document: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:Chapter",
    "rdfs:comment": "A ReSpec specification document",
  },
  Example: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:Node",
    "rdfs:comment": "A ReSpec example node",
  },
  Definition: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:Node",
    "rdfs:comment": "A ReSpec term definition document node",
  },
  Package: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:Reference",
    "rdfs:comment": "A package reference document node",
  },
  ABNF: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:CharacterData",
    "rdfs:comment": "An ABNF section node",
  },
  JSONLD: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:CharacterData",
    "rdfs:comment": "An JSONLD section node",
  },
  Turtle: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:CharacterData",
    "rdfs:comment": "An Turtle section node",
  },
  Invokation: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:Node",
    "rdfs:comment": "A command invokation document node",
  },
  Command: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "vdoc:ContextPath",
    "rdfs:comment": "A command reference node",
  },
  CommandLineInteraction: { "@type": "vdoc:Class",
    "rdfs:subClassOf": "revdoc:Example",
    "rdfs:comment": "A command line interaction sequence document node",
  },
  prefix: { "@type": "vdoc:Property",
    "rdfs:domain": "revdoc:Document",
    "rdfs:range": "rdfs:Literal",
    "rdfs:comment": "The preferred prefix of an ontology document",
  },
  prefixIRI: { "@type": "vdoc:Property",
    "rdfs:domain": "revdoc:Document",
    "rdfs:range": "rdfs:Resource",
    "rdfs:comment": "The IRI associated with the preferred prefix of an ontology",
  },
  package: { "@type": "vdoc:Property",
    "rdfs:domain": "vdoc:Node",
    "rdfs:range": "rdfs:Literal",
    "rdfs:comment": "A package name",
  },
  version: { "@type": "vdoc:Property",
    "rdfs:domain": "vdoc:Node",
    "rdfs:range": "rdfs:Literal",
    "rdfs:comment": "A semver string",
  },
}, {
  extractionRules: {
    example: {
      range: "vdoc:Example", owner: "vdoc:content", body: "vdoc:content", rest: "dc:title",
      comment: "Example node",
    },
    ontology: {
      range: "vdoc:Chapter", owner: "vdoc:content", body: "vdoc:content", rest: "dc:title",
      comment: "Ontology specification chapter",
    },
  },
});
