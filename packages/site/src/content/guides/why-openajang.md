---
title: Why OpenAjang, and how it compares
description: What OpenAjang prescribes, what it leaves out, and how it relates to Schema.org, iCalendar, JSCalendar, Open Evnt and OpenTechEvents.
section: evaluate
order: 1
---

OpenAjang defines a small JSON format for publishing events at independent URLs. Evaluating whether to adopt it involves understanding what the specification prescribes, what boundaries it establishes, and how it compares to existing calendar standards and similar open event formats.

## Why a small prescribed format

[Schema.org Event](https://schema.org/Event), [iCalendar](https://www.rfc-editor.org/rfc/rfc5545) and [JSCalendar](https://www.rfc-editor.org/rfc/rfc8984) already represent most of the information an event listing needs. OpenAjang does not claim they lack capabilities. It makes a fixed set of choices for one workflow: write one small file, put the registration link in it, publish it at a public URL, and let a compatible app or directory read it ([Spec §1](/spec/#1-purpose-and-scope)).

Those choices are:

- One JSON object shape for one public event occurrence, or one overall edition of a multi-day event. There are no alternate shapes for the same information, no wrappers and no external contexts needed to interpret the core ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation), [Spec §3](/spec/#3-document-and-authoring-rules)).
- Explicit registration fields: whether registration is required, where to register, and its state (`not_yet_open`, `open`, `closed`, `waitlist` or `unknown`). Apps choose the registration action they show from those fields ([Spec §7.1](/spec/#71-registration)).
- Strict HTML discovery: an optional `<link rel="alternate">` in the event page `head`, with fixed resolution rules so resolvers agree, and more than one candidate treated as an error ([Spec §8.2](/spec/#82-html-discovery)).
- Strict refresh rules for saved events: what a storing app does on each kind of response, and saved events keep refreshing from their source after they leave a feed ([Spec §8.3](/spec/#83-redirects-caching-and-refresh)).

The registration fields look like this in a document:

```jsonc
// Fragment: the registration object from a complete document
"registration": {
  "required": true,
  "status": "open",
  "url": "https://example.org/events/build-night-2026/register"
}
```

For an organizer, this means one short file with a small set of fields, hosted wherever you already publish, pointing to the registration form you already use. OpenAjang does not submit registrations or read form responses ([Spec §3.1](/spec/#31-minimal-example)).

For a platform or directory, it means one shape to export or import and one URL-import contract to implement. Apps and directories read OpenAjang directly. They do not need to convert it to Schema.org or JSCalendar before importing or distributing it ([Spec §1](/spec/#1-purpose-and-scope)). Publishing tools are meant to generate the event page and the compatibility outputs from the same record, so organizers do not maintain a second copy.

## What OpenAjang deliberately does not do

OpenAjang is a small contract between independent publishers and consumers. Several things that event platforms and calendar suites handle are out of scope.

- **No scraping or platform extraction.** An event is compatible only when its publisher exposes an OpenAjang document. An invalid JSON response is an error, not a reason to scrape the page ([Spec §8.1](/spec/#81-inputs-and-direct-json)).
- **No central account or registry.** Organizers host documents on their own site or a static host. Directories are optional, and several can index the same publisher independently ([Spec §1](/spec/#1-purpose-and-scope)).
- **No checkout, form submission or live inventory.** Documents link to the organizer's registration or ticket page. Ticket availability is current only as of `updated_at`, and a form can close without the JSON changing ([Spec §7](/spec/#7-registration-and-ticket-discovery)).
- **No organizer verification or directory endorsement.** Control of a host establishes where a claim came from, not who the organizer is. Passing validation is not inclusion, endorsement or verification ([Spec §10](/spec/#10-security-and-operational-requirements)).
- **No recurrence, opening hours or session schedules.** One document is one occurrence or one overall edition. The top-level `schedule` property is reserved and must be absent ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation), [Spec §3](/spec/#3-document-and-authoring-rules)).
- **No inline data blocks or executable content.** Discovery uses a `head` link to a standalone JSON URL, and display text is plain text, never rendered as HTML ([Spec §8.2](/spec/#82-html-discovery), [Spec §3](/spec/#3-document-and-authoring-rules)).

## How it relates to Schema.org Event, iCalendar and JSCalendar

OpenAjang is the editable source. Schema.org, JSCalendar and iCalendar outputs are generated from it and are not edited separately. When an output cannot carry a meaning, the converter reports the loss in diagnostics or declines the conversion ([Conversions](/conversions/)).

| Format | Role in an OpenAjang workflow | Trade-offs and conversion limits |
| --- | --- | --- |
| OpenAjang (`event.openajang.json`) | Editable source published at a stable URL for direct import and directory refresh. | One JSON object shape, explicit registration states and occurrence lifecycle rules. Does not model recurrence rules or session schedules ([Spec §1](/spec/#1-purpose-and-scope)). |
| Schema.org Event (JSON-LD) | Generated output for web pages and search indexing ([mapping](/conversions/#1-schemaorg-json-ld)). | Keeps date or date-time precision. Registration maps to a documented `potentialAction` convention, not a universal protocol. `completed` has no exact lifecycle match. Generated markup does not guarantee search eligibility. |
| JSCalendar (RFC 8984) | Generated output for timed calendar events ([mapping](/conversions/#2-jscalendar)). | Normalizes timed instants to UTC and computes exact durations. Declines date-only events, timed events with no `ends_at`, and `postponed` events. |
| iCalendar (`.ics`, RFC 5545) | Generated as a single-event file by the TypeScript SDK ([mapping](/conversions/#3-icalendar-and-reminders)). | Exports exact UTC instants and a stable `UID`. Declines date-only events, timed events with no `ends_at`, and `postponed` events. Rescheduled and completed events become `CONFIRMED` with a note. A user-created reminder for a date-only event is a separate user action and is never a lossless event export. |

The [conversion guide](/conversions/) has the full mapping tables and the list of reported losses.

## How it compares with Open Evnt and OpenTechEvents

<aside class="doc-note" aria-label="As of October 30, 2026">
<p class="doc-note-title">As of October 30, 2026</p>

[Open Evnt](https://github.com/openevnt/evnt) and [OpenTechEvents](https://github.com/OpenTechEvents/opentechevents-spec) are two other open JSON formats for describing events. Both are evolving drafts. The comparison below draws directly from each project's published specification without ranking them.

</aside>

Open Evnt describes itself as "a JSON format for describing one event: what it is, where and when it takes place, and where to find out more", and does not define how events are created, updated, deleted, stored or transmitted ([event spec §1](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md)). OpenTechEvents describes itself as "a minimal specification for describing tech community events and publishing them in a reusable feed" ([v0.4](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/README.md)).

| Aspect | OpenAjang | Open Evnt | OpenTechEvents |
| --- | --- | --- | --- |
| Identity | Optional `id`; the effective Event ID is `id`, otherwise `url`. It must survive postponement, venue changes and cancellation, and must not be reused ([Spec §5.1](/spec/#51-identity)). | Required `id`, an absolute URI. It should be the `https` URL the document is fetched from, or may be a `urn:uuid:`. It must not change or be reused ([event spec §2.2](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md)). | Required `id`, an HTTP(S) IRI under a domain the publisher controls, "minted once, never rewritten". `url` is where the event is described today ([reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)). |
| Dates and time zones | RFC 3339 date-times with a UTC offset, or full dates when clock times are unpublished. Optional IANA `time_zone` adds context ([Spec §4](/spec/#4-dates-and-time-precision)). | Partial dates with an IANA time zone in brackets. UTC offsets and seconds must not be used ([partial date §2](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-partialdate.md)). | `startDate` and `endDate` carry "the time printed on the poster" and never a UTC offset. An IANA `timezone` is always required ([v0.4](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/README.md)). |
| Cancellation | `cancelled` status. The document should stay a `200 OK` response; intentional removal should return `410` ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). | Optional `status` of `uncertain`, `cancelled` or `postponed`. Producers should keep a cancelled or postponed event published at its `id` and should not delete it ([event spec §2.1](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md)). | Statuses include `cancelled`, `postponed`, `rescheduled` and `moved-online`. A cancelled, postponed or moved-online event must stay published ([reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)). |
| Registration and tickets | `registration` with a required flag, URL and state; `tickets` with price and availability ([Spec §7](/spec/#7-registration-and-ticket-discovery)). | No registration or ticket fields. A link component labelled "Get Tickets" appears as an example ([components §2.2](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event-components.md)). | `offers` with `price` and eligibility types (`open`, `members-only`, `approval-required`, `restricted`) ([reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)). |
| Discovery | An optional `<link rel="alternate">` in the event page `head` pointing to the JSON ([Spec §8.2](/spec/#82-html-discovery)). Atom feeds are an optional companion ([Feeds](/feeds/#1-feed-contract)). | An Index HTTP endpoint with `search`, `after`, `before` and `limit` ([index §1](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-index.md)), and a Manifest with an optional well-known location ([manifest §5](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-manifest.md)). HTML link discovery is not stated in its specification. | A feed format alongside the single-event document ([v0.4](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/README.md)). The 0.5.0 changelog adds `feed.alternates`, described as informational with no sync guarantee ([changelog](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/CHANGELOG.md)). |
| Extensions or extra fields | Namespaced keys inside `extensions`, which must not alter core meanings ([Spec §9](/spec/#9-extensions-versions-and-conformance)). | Components with a reverse-domain, versioned `$type`. Consumers may ignore unknown types but must preserve them when modifying a document ([event spec §6](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md)). | A `cfp` field for an open call for proposals ([reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)); the 0.5.0 changelog adds `speakers` ([changelog](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/CHANGELOG.md)). |
| Status | `0.1` working draft ([Spec](/spec/), [versioning](/docs/versioning-and-stability/)). | "Version: 0.2 DRAFT", last updated 2026-10-18 ([event spec](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md)). | Draft and unstable. The specification index names v0.4 as current ([spec index](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/README.md)), while v0.5 is "a deliberately BREAKING release" ([v0.5](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.5/README.md)). |

### Where they overlap

- All three keep a cancelled event published. OpenAjang and Open Evnt say a publisher should; OpenTechEvents says a publisher must ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation), [Open Evnt §2.1](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md), [OpenTechEvents reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)).
- All three treat an event's `id` as permanent once assigned. OpenAjang and Open Evnt also forbid reusing it for another event ([Spec §5.1](/spec/#51-identity), [Open Evnt §2.2](https://github.com/openevnt/evnt/blob/main/docs/spec/open-evnt-event.md), [OpenTechEvents reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)).
- In OpenAjang and OpenTechEvents, an absent price means unknown, and `0` is how you say free ([Spec §7.2](/spec/#72-tickets), [OpenTechEvents reference](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/reference.en.md)).
- In OpenAjang and OpenTechEvents, one document describes one occurrence. OpenTechEvents puts it as "One document = one occurrence. Whoever publishes expands." ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation), [OpenTechEvents v0.4](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/README.md)).
- In OpenAjang and OpenTechEvents, a date-only end date is the inclusive last day. OpenTechEvents states this for all-day events; OpenAjang dates do not imply all-day attendance ([Spec §4.2](/spec/#42-calendar-dates-with-unpublished-clock-times), [OpenTechEvents v0.4](https://github.com/OpenTechEvents/opentechevents-spec/blob/main/spec/v0.4/README.md)).

### Conversion between them

OpenAjang provides no mapping to or from Open Evnt or OpenTechEvents. Whether to write an adapter depends on demonstrated demand, how well the semantics fit, and whether there is capacity to maintain it.

## What has not been shown yet

The specification is implementable, with a validator, examples, and conversion adapters in the repository. Whether OpenAjang makes publishing easier for organizers has not yet been shown in use. You can help test it by [publishing an event](https://github.com/nedpals/openajang#help-test-the-draft) and importing it into an independent tool.

## Related

- [Publish your first event](/docs/publish-your-first-event/)
- [Versioning and stability](/docs/versioning-and-stability/)
- [Reference](/docs/reference/)
