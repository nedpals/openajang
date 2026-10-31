---
title: SDKs and tools
description: Optional TypeScript packages, the browser validator, the Python reference CLI, and how to read the example fixtures, with the known limits of each.
section: developers
order: 1
---

OpenAjang maintains libraries and tools for parsing, resolving, validating, and converting event documents.

<aside class="doc-note" aria-label="Packages are optional">
<p class="doc-note-title">Packages are optional</p>

You do not need a specialized library to publish or read OpenAjang events. Any strict JSON parser, schema validator, and HTTP client that follows the [specification](/spec/#9-extensions-versions-and-conformance) works with the format. The TypeScript packages, browser validator, and Python reference tools are helpers for development, testing, and format conversion.

</aside>

## TypeScript packages

`@openajang/core` and `@openajang/resolver` are release candidates published for testing and feedback. Their APIs and validation behavior may change before `0.1.0`. Both packages support Node.js 22.18 or newer. The repository's `package.json` files currently say `0.1.0-rc.2`; release candidates are published under the `next` tag.

```sh
npm install @openajang/core@next @openajang/resolver@next
```

The two packages share a version number, and that number is separate from the schema version (see [PUBLISHING.md](https://github.com/nedpals/openajang/blob/master/PUBLISHING.md) for the release process).

### @openajang/core

[`@openajang/core`](https://github.com/nedpals/openajang/tree/master/packages/core) covers the parser and document validator capabilities in [spec section 9](/spec/#9-extensions-versions-and-conformance):

- Strict JSON parsing, which rejects duplicate property names and invalid Unicode as [spec section 3](/spec/#3-document-and-authoring-rules) requires.
- Schema validation plus the procedural checks the specification describes, using the bundled schema.
- Optional Schema.org, JSCalendar and single-event iCalendar adapters, imported from `@openajang/core/adapters`.

`validate` throws on an invalid document. `validateSafe` returns a result instead:

```ts
import { parseJsonStrict, validate } from '@openajang/core';

const event = validate(parseJsonStrict(json));
```

Adapter calls return `{ result, diagnostics }`. When a conversion is declined, `result` is `null` and `diagnostics` says why:

```ts
import { parseJsonStrict, validateSafe } from '@openajang/core';
import { toSchemaOrg, toJSCalendar } from '@openajang/core/adapters';

const parsed = parseJsonStrict(rawJsonText);
const validation = validateSafe(parsed);
if (validation.valid && validation.event) {
  const schemaOrg = toSchemaOrg(validation.event);
  const jsCalendar = toJSCalendar(validation.event);
  if (jsCalendar.result === null) {
    console.warn('JSCalendar conversion declined:', jsCalendar.diagnostics);
  }
}
```

JSCalendar declines date-only events, timed events without `ends_at`, and `postponed` events, because converting them would mean inventing clock hours, durations or active dates. The rules are in the [JSCalendar conversion guide](/conversions/#2-jscalendar); the [Schema.org mapping](/conversions/#1-schemaorg-json-ld) is in the same document. `toICalendar` follows the same rules, returns `.ics` text, and accepts an optional `{ sequence }` for stateful exporters ([iCalendar profile](/conversions/#3-icalendar-and-reminders)). The package also exports the bundled schema and the event types.

### @openajang/resolver

[`@openajang/resolver`](https://github.com/nedpals/openajang/tree/master/packages/resolver) is a Node.js URL resolver. Give it a direct JSON URL or an event page URL and it fetches the document, following the HTML discovery link when the URL is a page:

```ts
import { resolveOpenAjang } from '@openajang/resolver';

const { event, provenance, relationshipWarnings } = await resolveOpenAjang(
  'https://example.org/events/build-night-2026'
);
```

What the README says about its limits:

- It restricts destinations, so private-IP destinations are blocked by default. The `allowPrivateIps` option permits them, and the README says to use it only in trusted environments.
- It follows bounded redirects, and it limits response size and retrieval time. The README gives no numbers. Read the option names and defaults in the package's type declarations before you depend on a particular limit. The specification's network rules, including its recommended 1 MiB JSON limit, are in [section 10](/spec/#10-security-and-operational-requirements).
- Browser clients need their own retrieval and CORS policy. The resolver is a Node.js package.
- The package says additional security testing is planned for network retrieval. Treat it as a starting point, and test your own deployment's network isolation.

Provenance keeps three URLs apart. `finalFetchedUrl` is the supplied URL after redirects. `documentUrl` is the retrieved JSON endpoint. `declaredEventUrl` is the event page URL the document claims. For direct JSON the first two are the same. A declared URL does not by itself establish authority or endorsement.

Each call is a one-shot retrieval. The resolver does not store events, cache responses, perform conditional refresh, or verify source continuity between revisions. If your application saves events, you implement those parts and the lifecycle and removal policies in the specification. The [resolve and import guide](/docs/resolve-and-import-a-url/) and the [store and refresh guide](/docs/store-and-refresh-events/) cover them.

## Known limits

These limits apply to the SDK and to anyone checking documents with other tools:

- The schema uses custom `oa-*` format annotations. Generic JSON Schema tools ignore them unless you add the procedural checks, so a pass from a generic validator is not a full document check.
- Time-zone checks in `@openajang/core` use the JavaScript runtime's standard [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) API.
- JSON numbers use IEEE 754 precision, so very large values may lose precision.
- Validation equivalence between the Python reference validator and the TypeScript SDK is still in progress. URI, email and language-tag checks share a conformance corpus, but the two are not yet proven equivalent.
- `@openajang/resolver` is one-shot and is not a storing consumer.

## Browser validator

The [validator](/validator/) takes pasted JSON, a local file or one of the example fixtures. It runs in your browser and does not upload the document. It accepts up to 1 MiB.

It checks:

- Strict JSON: syntax, duplicate property names and invalid Unicode.
- Document shape: the supported schema identifier, required fields, types and allowed values.
- Values and relationships: date and time precision and ordering, rescheduling history, duplicate ticket ids and tags, and the other checks `@openajang/core` implements.

It uses the bundled 0.1 schema and does not fetch schemas from URLs. Unknown fields are generally ignored, with exceptions such as the reserved `schedule` field. Procedural checks may stop at the first error, so fix what it reports and validate again. Time-zone checks use your browser's `Intl` support.

<aside class="doc-note" aria-label="What a validation pass means">
<p class="doc-note-title">What a validation pass means</p>

A pass means the document meets this implementation's checks. It does not test your hosted endpoint, the media type it is served with, the HTML discovery link or network retrieval security. It also does not verify the organizer, guarantee directory inclusion or confirm that registration is open. Check the hosted response yourself, for example with `curl -I`.

</aside>

## Python reference CLI

The repository ships a Python reference validator, converter and offline regression suite. They need Python 3.11 or newer and a clone of the [OpenAjang repository](https://github.com/nedpals/openajang). From the repository root:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python tools/openajang.py validate examples/*.openajang.json
python tools/openajang.py generate
python tools/generate_example_feeds.py
python -m unittest discover -s tests -v
```

- `validate` checks the documents you name.
- `generate` validates the fixtures first, then writes the derived Schema.org and supported JSCalendar outputs under `generated/` and records declined conversions in `generated/conversion-diagnostics.json` ([conversion guide, generation and testing](/conversions/#4-generation-and-testing)).
- `pnpm run generate:ics` (repository root) writes the iCalendar fixtures to `generated/*.ics` and their diagnostics to `generated/icalendar-diagnostics.json`.
- `generate_example_feeds.py` regenerates the sample Atom and RSS feeds with fixed illustrative timestamps. It is not a live publisher's timestamp implementation.
- `unittest` runs the offline regression suite.

The validator does not fetch remote schemas or make network calls. The bounded HTML discovery helper is not a complete HTML5 parser, and the local tools are not a production network resolver. [PUBLISHING.md](https://github.com/nedpals/openajang/blob/master/PUBLISHING.md) lists the operational limits.

## Reading the examples

The eight documents on the [examples page](/examples/) and the sample feeds are illustrative fixtures for conformance testing. Four things to know before you build against them:

- The event facts in them have not been rechecked against live organizer sites, and they do not show that any organizer authorized the listing or supports OpenAjang discovery. The real-event provenance is on the [reference page](/docs/reference/).
- Each fixture names `Example fixture publisher` and uses a fixed revision instant, so treat the timestamps as properties of the fixture. Feed document URLs use `example.org` placeholders and are not live endpoints.
- Past events keep `status: "scheduled"` on purpose. They test that an app classifies a past event by its dates, separately from the status the publisher set (see [conservative interpretation](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).
- Five of the eight fixtures use date-only dates, and the JSCalendar converter declines them. The per-file notes are in [`generated/conversion-diagnostics.json`](/generated/conversion-diagnostics.json).

Passing the repository's conformance suite verifies local reference behavior. It is not independent interoperability testing or certification by a target validator. [TEST-REPORT.md](https://github.com/nedpals/openajang/blob/master/TEST-REPORT.md) has the results.

## Next

- [Resolve and import a URL](/docs/resolve-and-import-a-url/)
- [Store and refresh events](/docs/store-and-refresh-events/)
- [Reference](/docs/reference/)
