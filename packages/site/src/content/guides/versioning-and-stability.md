---
title: Versioning and stability
description: What the OpenAjang 0.1 working draft promises about schema identifiers, new contracts, media types and SDK versions.
section: evaluate
order: 2
---

OpenAjang `0.1` is an active working draft. Deciding whether to adopt the format requires understanding what the project currently guarantees across schema identifiers, compatibility rules, media types, and SDK packages, as well as what remains open to revision.

## Current status

The [specification](/spec/) is a working draft, version `0.1`. The [Atom feed profile](/feeds/) is an optional companion, also a working draft. While `0.1` is a working draft, the project makes no further stability promise than the ones listed on this page.

## How a version is identified

Every event document names its contract in the required `$schema` property ([Spec §3.2](/spec/#32-core-properties)). For `0.1` the value is exactly:

```jsonc
// Fragment: required in every 0.1 document
"$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json"
```

The schema URL identifies the version ([Spec §3](/spec/#3-document-and-authoring-rules)). The media type does not.

## What the spec promises

These rules come from [Spec §9](/spec/#9-extensions-versions-and-conformance).

- The schema identifier for `0.1` is immutable. Once published, a schema identifier must not be reused for an incompatible contract. A document that carries the `0.1` URL will not later be read against an incompatible contract under that same URL.
- Unknown schema identifiers must not be silently treated as supported. An implementation has to support a contract explicitly before it accepts documents that name it.
- Bundle or cache the schemas you know. Do not fetch arbitrary schemas or remote references supplied by a document during validation. If the public schema URL is temporarily unavailable, that does not make a document invalid when it can be checked against a bundled copy.

## The media type is provisional

Documents must be served as `application/vnd.openajang+json` or `application/json`. The vendor media type is provisional and unregistered ([Spec §3](/spec/#3-document-and-authoring-rules)). The feed profile uses the same type in its JSON links, and the core's provisional status applies there too ([Feeds §1](/feeds/#1-feed-contract)).

## How an incompatible contract would be introduced

The repository's [`PUBLISHING.md`](https://github.com/nedpals/openajang/blob/master/PUBLISHING.md) describes how the maintainer introduces a new incompatible contract:

1. The schema gets a new `$id`.
2. The `$schema` constant that documents must carry changes to match it.
3. The version declaration in the specification is updated.
4. The schema URL in documentation examples and event fixtures is updated to the new one.

A new incompatible contract therefore requires a new schema URL. Previously published schema contracts stay available at their original public URLs, and repository tags or release archives preserve the source as it was.

## SDK versions are separate

The TypeScript packages `@openajang/core` and `@openajang/resolver` are optional. You can publish and consume OpenAjang documents without them. The two packages share one version number, and that number is independent of the schema version ([`PUBLISHING.md`](https://github.com/nedpals/openajang/blob/master/PUBLISHING.md)). An SDK release is not a new contract.

Both packages are currently release candidates for testing and feedback. Their APIs may change before `0.1.0`, the core package's validation behavior may change too ([core README](https://github.com/nedpals/openajang/blob/master/packages/core/README.md)), and further security testing is planned for the resolver's network retrieval ([resolver README](https://github.com/nedpals/openajang/blob/master/packages/resolver/README.md)). Prereleases are published under npm's `next` tag, so you install them like this:

```sh
npm install @openajang/core@next @openajang/resolver@next
```

## What to do as a publisher

- Use the exact `$schema` URL for the contract you follow, character for character ([Spec §3.2](/spec/#32-core-properties)). Do not derive it or shorten it.
- Serve documents as `application/vnd.openajang+json` or `application/json` ([Spec §3](/spec/#3-document-and-authoring-rules)). Both are allowed, and neither carries the version.
- Expect to republish if a new contract appears and you decide to move to it. Your documents would carry its new `$schema` URL and follow its rules. Documents you leave on `0.1` keep pointing at the `0.1` schema, which stays available at its URL.

## What to do as a consumer

- Decide which contracts you support and list them. Today that is the `0.1` schema URL.
- Check `$schema` against that list. When a document names a schema you do not support, reject it explicitly or report it as unsupported. Do not guess that it is close enough to `0.1` ([Spec §9](/spec/#9-extensions-versions-and-conformance)).
- Bundle or cache the schemas you know and validate against those copies. Do not fetch arbitrary schemas a document supplies ([Spec §9](/spec/#9-extensions-versions-and-conformance)).

## Related

- [Specification](/spec/)
- [SDKs and tools](/docs/sdks-and-tools/)
- [Extensions](/docs/extensions/)
