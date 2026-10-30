---
title: Reference
description: Where to find the OpenAjang specification, feed profile, conversion guide, schema, validator, examples, test report and license terms.
section: evaluate
order: 4
---

This page lists every reference document, tool and sample file in the OpenAjang project, so you can check a rule at its source or look at a working example. It also explains where the example files came from and how the project is licensed.

## Specification and profiles

- [Specification](/spec/): the core rules for event documents, identity, status, discovery and conformance.
- [Atom feed profile](/feeds/): how a directory lists events in an Atom feed that links to publisher-hosted documents.
- [Conversion guide](/conversions/): how an event document maps to Schema.org JSON-LD and JSCalendar, and when a conversion is declined.
- [Experimental extensions](https://github.com/nedpals/openajang/blob/master/experimental-extensions.md): example extension keys that sit outside the core. See [Extensions](/docs/extensions/) for how they work.

## Schema and tools

- [JSON Schema](/schema/0.1/event.json): the schema for version `0.1` event documents.
- [Validator](/validator/): checks a document against the schema and the spec's rules.
- [Repository](https://github.com/nedpals/openajang): the specification sources, the Python reference CLI, the TypeScript packages and the tests. See [SDKs and tools](/docs/sdks-and-tools/) for how to use them.

## Examples and test results

- [Examples](/examples/): the eight example event documents.
- [Example directory feed (Atom)](/examples/directory.atom): a sample directory feed that follows the feed profile.
- [Example directory feed (RSS)](/examples/directory.rss): the same listings as an RSS feed.
- [Conversion diagnostics](/generated/conversion-diagnostics.json): per-file notes from generating Schema.org and JSCalendar output, including the conversions that were declined.
- [Test report](https://github.com/nedpals/openajang/blob/master/TEST-REPORT.md): what the repository's tests cover and how they came out.

## Example provenance

The eight event files and the sample Atom and RSS feeds are illustrative snapshots, built from supplied real-event data for conformance testing. The details below come from the repository's [`PUBLISHING.md`](https://github.com/nedpals/openajang/blob/master/PUBLISHING.md).

- The event names, dates, URLs, prices and availability were not rechecked against live organizer sites.
- The files do not show that any organizer authorized the listing, and they do not show that those sites support OpenAjang. Their Event URLs prove nothing about discovery on the real websites.
- Each file names `Example fixture publisher` and uses the revision instant `2026-10-29T08:00:00Z`. That instant describes these example representations. It does not certify that the source facts are current.
- Feed document URLs use `example.org` placeholders and are not live endpoints.
- Past events keep `status: "scheduled"` on purpose, to test that apps classify a past event by its date and not by its publisher status.
- Five of the eight files use date-only envelopes, and the JSCalendar converter declines them. The reason for each file is in the [conversion diagnostics](/generated/conversion-diagnostics.json).
- Passing the repository's conformance suite verifies local reference behavior only. It is not independent interoperability testing, and it is not certification by a target validator.

## License

- The specification and documentation are under [CC BY 4.0](https://github.com/nedpals/openajang/blob/master/LICENSE-docs).
- The schema, examples, tools and tests are under [Apache-2.0](https://github.com/nedpals/openajang/blob/master/LICENSE).
- Third-party event content, such as descriptions and images published by organizers, keeps its own terms. Publishing an event in OpenAjang format does not license it under either license above.

The README says you can implement the format and publish compatible events without asking permission, and states the naming rule this way: saying a tool or feed is "OpenAjang-compatible" is fine as long as it follows the spec. Please don't present a modified or incompatible format as OpenAjang.

## Related

- [Versioning and stability](/docs/versioning-and-stability/)
- [SDKs and tools](/docs/sdks-and-tools/)
- [Start here](/docs/)
