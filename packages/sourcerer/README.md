# @valos/sourcerer provides ValOS-RAEM stream components

## 1. Introduction

This package is likely the most important package of Valaa Open System.
@valos/sourcerer specifications and components provide the foundation
for event stream and bvob content delivery network. All the rest of the
ValOS infrastructure and by extension of the whole ecosystem build on
top of this fabric.

The dense definition of ValOS ecosystem is:
  1. All content is stored inside *ValOS Resources*, which act as
     nodes inside
  2. a unified, global, immense *valospace* network, which is
     segmented into
  3. smaller, non-divisible but fully cross-connected groups of
     Resources called *Chronicle*s, each of which is owned by
  4. *Authorities*, which also govern, host and serve those chronicles
     to downstream users via
  5. a distributed network of high-level *Sourcerer* nodes, which provide
     the concrete
  6. *Connection* access points which enable users to access
    the upstream chronicles.

With these concepts this specification aims to implement the
distributed event sourcing paradigm between many independent downstream
consumers and many independent upstream authorities comprehensively,
scalably and robustly.

This package also extends the @valos/script schema with Media and
Entity. Media is a file-like content container. Via Sourcerers and
Connections it allows reading, writing and interpreting
the content. Entity in turn provides directory-like hierarchies for
Medias and other Entitys.

This package also extends command/truth event semantics defined in
@valos/raem with the concepts of restricted and universal commands.

This package also provides various Sourcerer component JavaScript
implementations which can be used to implement the full valos
application stream gateway inside a client browser. Some of
the components generalize to non-browser contexts, some are fully
browser specific.

- depends: `@valos/script`, `IndexedDB`, `AWS IoT/S3/DynamoDB`
- exports: `FalseProphet`, `Connection`, `SourcererContentAPI`
- valospace: `SourceredNode`, `Entity`, `Media`, `Relation`,
- concepts: `ACID`, `authorities`, `pub-sub`, `offline readiness`

### 1.1. Note on naming and of the importance of history

This package draws heavily from religious nomenclature, especially
in internal naming. This is not a statement any kind (besides maybe
one*) nor intended as a commentary of any social structures: effort is
made to keep the terminology non-specific.

The justification is to manage complexity (with a tad of vanity).
The progression of ValOS events is a long and complex one; it can start
from an initial user action, go through revisions into a permanent
change event of global state and finally into notification events sent
to other users' screens and devices. This journey sees the events go
through many similar looking shapes and stages which are still
fundamentally distinct. The scriptural naming scheme provides a rich
terminological ground for highlighting these differences in a memorable
fashion and for providing intuitive, existing meanings to guide
understanding.
TODO(iridian): Create and link to the full definitions of the precise
definitions of all these terms in ValOS context.

*If there is a statement, it would be one of knowledge. Understanding
the historical development of texts and stories, their originating
events, knowledge of those told about them, wrote them down, revised
and reformed them, knowledge of those confirmed, purged and rejected
them as truths or falsehoods, all of this is fundamentally valuable.

In choosing this naming scheme @valos/sourcerer unapologetically places
and appreciates the knowledge of history at the front and center.

## 2. Deconstruction of the dense definition

### 2.1. *ValOS Resource*s are the basic building blocks and defined by package schemas

### 2.2. *valospace* contains everything

### 2.3. *Chronicle*s allow loading resources and requesting updates selectively

Event sourcing, for all its expressive power and architectural
simplicity, has a major glaring weakness: loading a single resource
means loading all other resources in the event log. This is fine in
limited contexts like singular projects of a desktop application. But
valospace as a unified, global repository is immense. In order to not
be useless it cannot be a trivial singular event log.

ValOS solves this problem with *Chronicle*s which divide the valospace
into smaller pieces.


#### 2.3.1. Chronicle rules

##### 2.3.1.1. A Chronicle contains a single root Entity

This entity is called *the chronicle root*.


##### 2.3.1.2. All resources owned (even indirectly) by the chronicle root belong to the chronicle

Together with the chronicle root these are called
*the chronicle resources*.


##### 2.3.1.3. Each chronicle has an event log which contains all the events that modify the chronicle resources and no other events

Those events have an incrementing serial number *log.index*. Together
they form *the chronicle event log*.


#### 2.3.2. Low coupling and high cohesion rules even more

##### 2.3.2.1. Low coupling saves network bandwidth and CPU ...

When [chronicles have low coupling in relation to each other](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
(ie. dependencies between chronicles are clear and mostly
one-directional) then bandwidth and computational resources can be
saved. Chronicles which contain information that is auxiliary to
the application don't need to be loaded before needed. For example
a game might have separate areas be in separate chronicles and only
start loading the next area when the player is about to finish
the previous one.


##### 2.3.2.2. ... and high cohesion saves time, spares nerves and minimizes overheads

Loading a chronicle still loads all of its resources. With a sound
chronicle design this is advantageous. As a corollary to the low
coupling above, when [resources inside a chronicle have high cohesion](https://en.wikipedia.org/wiki/Cohesion_(computer_science))
(ie. loading one resource means that it is very likely to load the
others) it is useful to load them all together as it spares the network
latency and overheads of repeated consequtive requests.


### 2.4. *Authority*s implement the infrastructure and authorize new events for their chronicles

### 2.5. *Sourcerer*s are software components which connect to each other and form information streams

### 2.6. *Connection* provides an API for accessing an individual chronicle

Receiving and sending information to a chronicle is done using
a *Connection*. With the the Sourcerer that provided
the connection it manages four types of information streams:
  1. commands sent towards upstream
  2. truths received towards downstream
  3. media content uploaded to upstream
  4. media content downloaded from upstream


## 3. *Media*s and *Entity*s as files and folders

### 3.3. Media interpretation process

Media interpretation is the process of retrieving content and
converting it to a representation that is useful for users. It is split
into three stages: *retrieve* octet stream, *decode* as object
representation and *integrate* in use site context.


#### 3.3.1. Bvob *retrieve* yields an ArrayBuffer via network download, cache hit, etc.

Persisted octet sequences are typically identified by their *contentHash*,
a well-defined content hash of the whole octet sequence (and nothing
else). Their in-memory representation is shared between all consumers
inside the same execution environment.


#### 3.3.2. Content ArrayBuffer is *decoded* into immutable, cacheable object representation based on media type

The octet stream is decoded by decoder spindles associated with
the requested media type into some runtime object representation. This
object representation can range anything from a flat text decoding,
through a complex JavaScript composite object representation into a
full-blown component with rich, asynchronous API's for accessing
the content piece-meal. The requirement is that the resulting dedoded
object must be shareable and reusable between different consumers in
unspecified contexts. This implies that the decoded object should be
immutable or provide an immutable API.


##### 3.3.2.1. decoding "application/valoscript"

The application/valoscript decoder transpiles the octet stream into
a *module program Kuery*. This Kuery contains the rules for setting up
an ES6-like module exports. The kuery can thus be shared between
different integration contexts (different ghosts of the same base media
in different instances, etc.)


#### 3.3.2.2. decoding "application/javascript"

The application/javascript decoder wraps the octet stream text into
a native function. This function accepts a contextual global scope
object as an argument, and when called sets up an ES6-like module
exports based on the octet content interpreted as a JavaScript module.
Like with other interpretations, this outermost native function will be
shared between contexts.


#### 3.3.3. Decoded representation is *integrated* into a specific context

#### 3.3.3.1. integrating "application/valoscript"

When the kuery is valked against a resource and some context the valk
result is an object with ES6-style bindings of the exported symbols as
the object properties.

TODO(iridian): Define this precisely. Consult an
[analysis of CommonJS and ES Modules within NodeJS](https://medium.com/@giltayar/native-es-modules-in-nodejs-status-and-future-directions-part-i-ee5ea3001f71)
[typescript ESM default interop with CJS](https://github.com/Microsoft/TypeScript/issues/2719) and
[neufund default export ban](https://blog.neufund.org/why-we-have-banned-default-exports-and-you-should-do-the-same-d51fdc2cf2ad)
[ES6 exports immutable bindings, not values](https://github.com/rauschma/module-bindings-demo)
for some starting inspiration.


#### 3.3.3.2. integrating  "application/javascript"

The contextual global scope for the integration is a JavaScript global
host object associated with the context resource.


## 4. Only *universal* commands are accepted by the upstream

TODO(iridian): Update outdated documentation
Restricted commands are commands created by downstream components which
contain incomplete information and cannot yet be proclaimed upstream.
An example of such is a cross-chronicle DUPLICATED command which only
contains the source and the target owner resources: the final command
which reaches the target chronicle event log must also contain full
state of the duplicated resource.
The process of adding all necessary information to a command is called
*universalization*. A universalized command can then be handled by any
clients irrespective of their local chronicle availability context.


## 5. Concrete components

### 5.1. The *FalseProphet* extends Corpus in-memory store with full connectivity and transactionality

### 5.2. The *Scribe* provides chronicle content, command queue and event log caching in IndexedDB.

### 5.3. The *Oracle* manages connection information stream routing to authorities and Scribe
