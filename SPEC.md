# OpenAjang

## Public event publishing and URL discovery

**Status:** Working Draft  
**Version:** 0.1  
**Audience:** Organizers, publishing tools, directories, and consumer developers

## 1. Purpose and scope

Write one small JSON file, put the registration link in it, publish it at a public
URL, and give that URL to a compatible consumer. The consumer displays the event
and the appropriate registration action. Directories may accept the same URL,
refresh the source, and distribute event links through feeds.

OpenAjang is an independent, human-oriented authoring format. Schema.org and
JSCalendar are generated outputs, not prerequisites for reading OpenAjang.
Existing standards cover much of the same information; OpenAjang prescribes a
small representation and predictable publishing behavior for this workflow.

The core defines one public event listing, URL discovery, stable identity,
registration and ticket metadata, lifecycle, and refresh behavior. It does not
define feeds, checkout, inventory guarantees, attendee data, invitations, private
meetings, recurring occurrence generation, opening-hours expansion, or detailed
conference programs. Atom distribution and conversions are separate companions:
[Atom profile](FEEDS.md), [conversion guide](CONVERSIONS.md).
Neither is required for a Basic Publisher or a direct-import consumer.

The BCP 14 words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED,
MAY, and OPTIONAL express requirements
only when capitalized. This draft uses JSON Schema Draft 2020-12 plus procedural
validation. A JSON parser suffices for decoding, not for full conformance.

### 1.1 Occurrence boundaries and conservative interpretation

One document describes one identified event occurrence or one overall event
edition. A multi-day conference or exhibition may have a single overall listing.
A date range is its outer calendar envelope; it does not assert uninterrupted
activity or activity on every date. A hybrid listing indicates that physical and
virtual attendance exist somewhere in the event; it does not assert both modes
on every date. Publishers MUST put important limits in core descriptions or
instructions even when an extension supplies more structure.

Independently admitted components MAY be listed within the overall edition as
plain-text ticket options. A consumer MUST NOT infer which dates or components a
ticket covers. To expose a component as a separately importable event, publish a
separate document and distinct Event ID; its tickets MUST describe that component.
An overall listing and a component are not duplicates merely because they overlap.
A shared series does not assert admission coverage or a parent-child relationship.
This core deliberately does not compute component, bundle, or ticket coverage.

Publishers MUST NOT depend on extensions to correct a false core assertion.
Consumers MUST NOT infer eligibility, continuous occupancy, universal ticket
coverage, or a final payable price from missing information.

## 2. Terminology

- **Event URL:** the public human-facing HTTP(S) page in `url`.
- **Document URL:** the URL from which the JSON is retrieved; it may equal `url`.
- **Effective Event ID:** `id` if present, otherwise `url`.
- **Organizer:** the party arranging the event.
- **Publisher:** the party serving the representation; not necessarily the organizer.
- **Seller:** the party offering an admission option.
- **Consumer:** software parsing, validating, resolving, displaying, or storing events.
- **Directory:** a consumer indexing events from several publishers.

Control of a host establishes provenance of its assertions, not organizer identity.

## 3. Document and authoring rules

A document MUST be a single UTF-8 JSON object. Arrays, wrappers, executable
JavaScript, and external contexts for core interpretation are not allowed.
Duplicate JSON property names MUST be rejected to prevent parser disagreement.
All strings MUST contain valid Unicode scalar values; unpaired surrogates are
invalid. Property names are case-sensitive and core names use `snake_case`.
Human-readable strings MUST contain a non-whitespace character. Display text is
plain text, not HTML. Do not insert markup and expect formatting; consumers MUST
render it as text. Unknown optional values SHOULD be omitted, not set to `null`,
empty strings, or misleading placeholders. No core property permits `null`.
Published core arrays MUST be nonempty; omit an optional array with no values.

URLs MUST be absolute HTTP or HTTPS URLs without user-info credentials. `id` and
other explicitly designated URI identifiers may use another absolute URI scheme.
Use RFC 3986 URI serialization: percent-encode non-ASCII path characters and use
IDNA hostnames where needed; unencoded IRIs are outside this profile.
A syntactically valid URL still requires retrieval safety checks before fetching.
Consumers MUST ignore unknown properties at every defined object level and unknown
extensions. Publishers MUST put private additions inside `extensions`. The
`schedule` top-level property is reserved and MUST be absent. Describe visiting
hours in explanatory text or a separately documented extension; consumers do not
expand structured schedules as part of this contract.

Documents MUST be served as `application/vnd.openajang+json` or
`application/json`; parameters such as `charset=utf-8` are allowed. The vendor
media type is provisional and unregistered. The schema URL identifies the version.

### 3.1 Minimal example

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "url": "https://example.org/events/build-night-2026",
  "title": "Community Build Night",
  "status": "scheduled",
  "starts_at": "2026-11-14T18:00:00+08:00",
  "organizer": { "name": "Example Community" },
  "location": {
    "type": "physical",
    "physical": { "name": "Community Hall" }
  },
  "registration": {
    "required": true,
    "status": "open",
    "url": "https://docs.google.com/forms/d/e/EXAMPLE/viewform"
  },
  "updated_at": "2026-10-29T08:00:00Z"
}
```

The Google Forms URL above is a placeholder. The JSON points to the form;
OpenAjang does not submit registrations or inspect form responses. A saved local
file can be previewed, but URL import requires public hosting. Static hosting is
sufficient if it serves the accepted media type. Raw repository URLs that serve
`text/plain` are not conforming document endpoints.

### 3.2 Core properties

| Property | Type | Requirement / meaning |
| --- | --- | --- |
| `$schema` | HTTPS URL | Required, exact schema identifier below. |
| `type` | string | Required, `event`. |
| `id` | absolute URI | Optional stable occurrence identifier. |
| `url` | URL | Required canonical human-facing event page. |
| `title` | text | Required event title. |
| `summary` | text | Optional short description. |
| `description` | text | Optional longer description and attendance limitations. |
| `language` | string | Optional BCP 47 language tag for document text, not spoken languages. |
| `status` | enum | Required lifecycle value from section 5. |
| `status_note` | text | Optional explanation. |
| `starts_at` | date or date-time | Required, section 4. |
| `ends_at` | same form as start | Optional, section 4. |
| `time_zone` | IANA zone | Optional civil-time context, not a replacement for the offset. |
| `previous_starts_at` | array of dates/date-times | Required and nonempty when rescheduled. |
| `location` | object | Required, section 6. |
| `organizer` | party | Required, section 6. |
| `publisher` | party | Optional publishing-party assertion. |
| `registration` | object | Optional, section 7. |
| `tickets` | array | Optional admission options, section 7. |
| `image` | object | Optional primary image. |
| `tags` | array of text | Optional free-form labels. |
| `series` | object | Optional related-occurrence collection. |
| `same_as` | array of URLs | Optional duplicate hints, not authority proof. |
| `updated_at` | date-time | Required material event-data modification instant. |
| `extensions` | object | Optional namespaced additions. |

## 4. Dates and time precision

### 4.1 Timed events

Date-times MUST use the RFC 3339 form `YYYY-MM-DDTHH:MM:SS[.fraction](Z|±HH:MM)`.
This contract requires uppercase `T` and `Z`, seconds from `00` through `59`, and a known
offset; leap-second `:60` and unknown-offset `-00:00` are outside this profile.
Calendar dates and clock components MUST be real. An offset-bearing value defines
an authoritative instant. Consumers MUST NOT silently reinterpret it using a
civil timezone. `ends_at`, if present, MUST represent a later instant.

An optional `time_zone` MUST name an IANA Time Zone Database zone. Publishers
SHOULD ensure that local components and offsets agree with that zone at publication.
Consumers MAY warn about mismatches, but MUST preserve the encoded instant. A later
zone-rule change affecting intended attendance requires an explicit publisher update.
Registration and sales timestamps are independent instants, not interpreted through
the event zone. Basic parsing and UTC display do not require schedule expansion.

### 4.2 Calendar dates with unpublished clock times

A full-date value MUST be a real `YYYY-MM-DD` calendar date. If `starts_at` is a
full-date, `ends_at` MUST also be a full-date when present; it is the **inclusive**
last calendar date and MUST be on or after the start. Without an end, only the
start date is described. Dates do not imply midnight, all-day attendance, continuous
occupancy, or activity every day. Consumers SHOULD say that exact hours are not
published. `time_zone` may provide location context but does not turn dates into
instants. Mixed start/end precision is invalid.

This contract defers explicit all-day occupancy, weekly hours, exceptions, and
recurrence. An exhibition may publish its date envelope and describe visiting
hours in text. A calendar exporter MUST NOT silently turn unknown hours into an
all-day block. A user may explicitly create a labelled date reminder; that is a
user-authored reminder, not a faithful conversion of the event.

### 4.3 Precision changes

Announcing a clock time on an unchanged calendar date is an information update,
not automatically a reschedule. Correcting a serialization without changing the
instant is not automatically a reschedule either. A real change of intended
attendance time follows section 5. Previous starts retain their originally
published precision; mixed forms in the history array are allowed.

## 5. Identity and lifecycle

### 5.1 Identity

Consumers MUST use the effective Event ID as the primary lifecycle key. IDs MUST
identify one occurrence or overall edition, MUST survive postponement, rescheduling,
venue changes, cancellation, completion, and migrations, and MUST NOT be reused.
Titles, dates, venues, and matching IDs from unrelated sources are not proof of
identity or continuity. Consumers MUST retain provenance and MUST NOT silently
merge conflicting claims.

For a new listing, generate a UUID URN once or use an occurrence-specific HTTPS
URI in a controlled namespace. An explicit `id` is RECOMMENDED if `url` is a
homepage likely to change editions, a mutable slug, or a third-party page likely
to move. Otherwise publishers MAY omit it and keep `url` permanently stable.
Future annual editions MUST get new IDs, even if a homepage is reused.

An Event URL may change when `id` preserves the existing effective ID. Cross-host
transfers SHOULD be confirmed by a redirect or changed representation controlled
by the previous source. Matching IDs alone are insufficient. When introducing
`id` to a previously published id-less event, set it to its previous effective ID
(the previous URL), not a freshly generated UUID. Fresh IDs are for new occurrences.

### 5.2 Status

| Value | Meaning |
| --- | --- |
| `scheduled` | Expected at the published time. |
| `postponed` | Not at the published time; replacement unconfirmed. |
| `rescheduled` | Replacement time confirmed. |
| `cancelled` | Will not occur. |
| `completed` | Has occurred; historical listing. |

Sold out is a ticket state, not an event state. Past events MAY remain `scheduled`;
publishers need not update solely because time passes. Consumers SHOULD separately
classify past events and MUST NOT present an already-ended event as upcoming merely
because its publisher status remains scheduled. Date-only past classification
SHOULD use event-zone context where available and be conservative near day boundaries.

### 5.3 Updates, postponement, rescheduling, cancellation

A material change MUST advance `updated_at`; unchanged fetches and rebuilds MUST
NOT advance it. Material changes include dates, venue, lifecycle, registration,
ticket prices, and availability. HTTP validators and consumer retrieval time remain
separate. A contract-only migration preserving event meaning need not advance it.

Postponement retains the last scheduled start; consumers MUST NOT treat that start
as confirmed attendance. Publishers SHOULD explain the uncertainty in `status_note`.

Rescheduling preserves identity, changes `status` to `rescheduled`, supplies the
new start/end, and MUST retain at least the immediately previous start in
`previous_starts_at`. History strings MUST be unique; no entry may denote the
current start (compare timed values as instants, dates as dates). Keep original
precision. Publishers SHOULD retain all history in order of successive revisions;
chronological sorting would lose the sequence of moves. History MAY remain after
cancellation or completion.

Cancellation SHOULD remain a `200 OK` document with `status: "cancelled"`.
Consumers SHOULD retain it to inform saved-event users. Registration/purchase
encouragement MUST be suppressed while cancelled, postponed, or completed, even if
older ticket or registration fields remain. A cancelled document is not a deletion.
Intentional removal SHOULD return `410 Gone`; `404` means currently unavailable.

## 6. Parties, locations, and ancillary fields

### 6.1 Party objects

`organizer`, `publisher`, and ticket `seller` share: required `name`; optional
absolute URI `id`, URL `url`, and public contact strings `email`, `phone`. Email
MUST be a syntactically valid public mailbox address. No particular phone format
is required. These fields MUST NOT contain private information without permission.
A single joint-organizer public party may be named; multiple organizer entities
are deferred rather than introducing alternate core shapes.

### 6.2 Location

`location.type` MUST be `physical`, `virtual`, or `hybrid`. Physical requires
`physical` and forbids `virtual`; virtual requires `virtual` and forbids `physical`;
hybrid requires both.

`physical` properties:

| Field | Requirement / meaning |
| --- | --- |
| `status` | Optional `confirmed` (default), `tentative`, `to_be_announced`. |
| `name` | Required unless status is `to_be_announced`; no `TBA` placeholders. |
| `id`, `url` | Optional absolute place URI and public place URL. |
| `address` | Optional text fields `street`, `locality`, `region`, `postal_code`, and `country`. |
| `coordinates` | Optional numeric `latitude` [-90,90] and `longitude` [-180,180], both required together. |
| `instructions` | Optional arrival details and attendance limitations. |

When supplied, `address.country` MUST be an uppercase ISO 3166-1 alpha-2 code.
A known city/country can accompany an unannounced venue. A tentative named venue
MUST be marked tentative. Omitted physical status means confirmed.

`virtual` requires a public URL `url`; optional `platform` and `instructions`
are plain text. The URL may be a safe access-information page. Private join tokens,
passwords, and personalized links MUST NOT be published. A recording alone does
not make an event virtual or hybrid.

### 6.3 Other fields

- `image`: required URL `url`; optional recommended text `alt`, positive integer
  `width` and `height`. Consumers apply image privacy/security policy.
- `tags`: text array, unique after Unicode case folding (MUST). No controlled taxonomy.
- `series`: required absolute URI `id`; optional text `title` and URL `url`.
  It groups listings but does not generate recurrence or establish shared admission.
- `same_as`: unique URLs asserted to describe the same listing. Duplicate hints only.
- `language`: a well-formed BCP 47 tag for human-readable document text. It does not
  assert the event's spoken or presentation languages.

## 7. Registration and ticket discovery

### 7.1 Registration

`registration` requires boolean `required`. Optional fields are URL `url`, status
`not_yet_open`, `open`, `closed`, `waitlist`, or `unknown`, date-times `opens_at`,
`closes_at`, and text `instructions`. End MUST be later than start when both are
present. Omitted status is unknown; omitted registration means information not
published, not that no registration is required. Online registration requires a URL;
offline registration MAY be described through instructions without a URL.
`not_yet_open` is distinct from `closed`.

A consumer MAY show **Register** when a URL exists and status is `open`,
**Join waitlist** for `waitlist`, and **View registration** for unknown or omitted
status. It MUST NOT claim registration is currently open without that assertion.
For `closed` or `not_yet_open`, display that state; a normal source link MAY remain.
Lifecycle and past-event handling in section 5 takes precedence. Registration
opening/closing times SHOULD be checked for contradictory or stale state before
presenting an actionable claim; do not invent a publisher status from a deadline.

The registration link remains authoritative at submission time. A form can close
without the JSON changing. Consumers SHOULD expose freshness and refresh before
time-sensitive claims; OpenAjang does not guarantee live form availability.

### 7.2 Tickets

Each ticket requires stable non-whitespace string `id` unique within the Event ID
and text `name`. Optional: text `description`, URL `url`, party `seller`, `price`,
`availability`, and date-times `sales_start`, `sales_end`. When both sales instants
exist, end MUST be later. IDs remain stable while the admission option is the same.

`availability` is `available`, `limited`, `sold_out`, `unavailable`, or `unknown`.
Omitted availability is unknown. It is current only as of `updated_at`, never an
inventory guarantee. Changing it materially advances that timestamp.

`price` requires a non-negative decimal string `amount` matching
`^(0|[1-9][0-9]*)(\.[0-9]+)?$` and uppercase ISO 4217 `currency`. Use decimal
arithmetic, not binary floating point. Zero explicitly denotes free admission for
that option; omission denotes unknown price. Currency minor-unit enforcement is
not part of this core. Museum admission, eligibility, payment methods, fees,
taxes, discounts, bundles, and date/component coverage may need descriptive text.

Consumers MUST NOT infer that the cheapest listed option is available to everyone,
that an omitted price is zero, that a ticket covers the full date envelope, or
that an advertised amount is the final payable total. Preserve tier descriptions
and source links rather than automatically choosing a ticket for the participant.

## 8. Discovery and retrieval

### 8.1 Inputs and direct JSON

Resolvers accept an absolute HTTP(S) URL and fetch it subject to section 10. An
accepted JSON media type means parse and validate exactly one document. Media type
comparison is case-insensitive and ignores parameters. An invalid JSON document
is an error, not an invitation to scrape or fall back to another representation.

### 8.2 HTML discovery

An HTML Event URL may advertise this link in its `head`:

```html
<link rel="alternate"
      type="application/vnd.openajang+json"
      href="event.openajang.json">
```

Fetch HTML without executing scripts. Match the `alternate` relation token and
vendor media type case-insensitively. Only head links count. Resolve `href` against
the final fetched HTML URL, **ignoring HTML base elements for OpenAjang discovery**.
This deliberate rule avoids discovery disagreement. Absolute and relative hrefs
are allowed. Ignore a link without href. Deduplicate resolved URLs after the
normalization below. Zero candidates means not found; multiple distinct candidates
MUST produce an ambiguity error. A linked endpoint MUST directly return JSON;
recursive HTML discovery is forbidden. A link advertising the vendor type MAY
retrieve `application/json` successfully.

For discovery URL comparisons: lowercase scheme/host, remove default ports,
resolve dot segments, use `/` for an empty HTTP path, remove fragments, preserve
query order and path case. Do not equate HTTP and HTTPS or strip trailing slashes.
Event IDs remain opaque exact strings; this normalization MUST NOT rewrite IDs.

If discovery starts from HTML, the document `url` SHOULD equal the final HTML URL
under those rules or an unambiguous head canonical link resolved by the same
rules. Report a mismatch as a relationship warning; do not silently claim official
endorsement. For direct JSON, `url` is its declared human page and need not equal
the Document URL. Cross-origin JSON is allowed when explicitly linked. Retain
both origins. A direct document's claim to another site does not establish authority.

### 8.3 Redirects, caching, and refresh

Consumers SHOULD follow at most five redirects and SHOULD reject HTTPS-to-HTTP
downgrades unless explicitly configured. Apply retrieval safety to every target.
Publishers SHOULD provide HTTP cache controls and `ETag` and/or `Last-Modified`.
Stored-event consumers MUST use available validators on revalidation, honoring
HTTP precedence rules. A conditional response `304` retains the existing document.

| Refresh response | Required behavior for a storing consumer |
| --- | --- |
| Valid `200`, same ID and verified source continuity | Replace current representation; record retrieval time. |
| Invalid `200` | Retain last valid representation; record failure. |
| `200`, different effective ID | Do not overwrite the old event as an update. |
| `404` at a previously discovered Document URL | Repeat discovery from the original HTML Event URL before removal where that page remains safely retrievable; otherwise record unavailability and apply a documented removal policy. |
| `410` | Apply document-removal policy; this is not evidence the event was cancelled. |
| Network failure or `5xx` | Retain last valid representation and retry with backoff. |

Consumers SHOULD occasionally rediscover retained HTML Event URLs and SHOULD do
so after a document's relationship/provenance changes. If the HTML alternate changes,
require the same ID and source continuity before switching. Do not refresh a new
unrelated origin as authoritative solely because it copied an ID.

Publishers MUST advance `updated_at` for material changes even when using HTTP
validators. Consumers MUST NOT skip fetching solely because a stored timestamp is
recent. A fetched revision with a non-advancing timestamp but changed content
SHOULD produce a publisher-quality warning; HTTP fetch results, provenance, and
local history determine handling, not blind timestamp sorting across publishers.

Polling frequency is consumer policy, not a JSON property. Reduce it after repeated
failures and for ended events. Feed subscriptions discover listings; saved events
SHOULD continue to refresh directly even after leaving a feed window.

## 9. Extensions, versions, and conformance

Extension keys MUST match `namespace:name`, with nonempty ASCII letters/digits,
dots, underscores or hyphens on each side. Third-party namespaces SHOULD use a
reverse domain controlled by the author. The dotless namespace `openajang` is
reserved for extensions the OpenAjang project maintains; the included
[experimental notes](experimental-extensions.md) document the supplied
`-unstable` examples without making them required capabilities.
Extension values are arbitrary valid JSON, including `null`. They MUST NOT alter
core meanings. Core descriptions and instructions must remain useful when all
extensions are removed.

A key that other tools are meant to implement MAY be described by an extension
profile, defined in [EXTENSIONS.md](EXTENSIONS.md). A profile fixes the key, value
schema, scope, core fallback, consumer behavior, fixtures, and lifecycle status. The
name part of the key ends in a `-vN` version or the special version `-unstable`,
which marks an experiment. A breaking change to a `-vN` key MUST use a new key
rather than reuse the old one. Profiles are optional. A publisher, validator, or
consumer is conforming without supporting any profile, and a consumer MUST NOT fetch
a profile schema from a document.

The immutable schema identifier for this contract is:

`https://openajang.nedpals.xyz/schema/0.1/event.json`

The release includes `schema/0.1/event.json`. Publish those exact bytes at that
URL before claiming the public endpoint supports this contract. This package does
not deploy it. Once published, a schema identifier MUST NOT be reused for an
incompatible contract. Unknown schema identifiers MUST NOT be silently treated as
supported; an implementation must explicitly support their contract.
Bundle/cache known schemas; do not fetch arbitrary instance-supplied schemas or
remote references during validation. Temporary schema unavailability does not
invalidate a document checkable against a bundled known copy.

Conformance capabilities are separate:

- **Parser:** UTF-8 JSON decoding with duplicate-name and Unicode checks.
- **Document validator:** schema plus real date/time parsing, ordering, URI/URL
  rules, identifier uniqueness, tag case folding, timezone identifiers, currency
  and country codes, BCP 47 syntax, and rescheduling history comparisons.
- **Basic Publisher:** stable hosted document, lifecycle and timestamp discipline.
- **Discoverable Publisher:** Basic Publisher plus HTML head link.
- **URL Resolver:** discovery, relationship checks, limits, and retrieval security.
- **Storing Consumer:** validator/resolver plus identity, refresh, and provenance.
- **Converter / Atom Service:** optional companion capabilities, reported separately.

Unknown fields are ignored, not grounds for rejection, except explicitly reserved
fields such as `schedule`. Schema validates shape and value patterns;
procedural checks validate relationships and registered-code membership. The
bundled validator reports its limits in README rather than claiming to exercise
real network security. A validator MUST NOT require private extension schemas.

## 10. Security and operational requirements

All data is untrusted. Render text without executing markup or extension values.
Display and navigable URLs must use the allowed schemes; fetched images need
privacy/security policy. Never publish attendee data, private contacts, credentials,
personalized ticket links, or private access URLs.

A network-facing resolver MUST block loopback, private, link-local, multicast, and
other non-public addresses; reject URL credentials; defend against DNS rebinding;
recheck actual connection destinations on redirects and discovered links; omit
ambient cookies/credentials; and isolate retrieval from internal networks. A URL
syntax check alone is not SSRF protection. Configure redirect, timeout, compressed
and decompressed byte limits. A 1 MiB JSON limit is RECOMMENDED; HTML scanning
also needs a bounded limit. Static browser clients may require CORS support or a
server-side resolver. No browser workaround may bypass authorization.

Directories retain supplied URL, final Event URL, Document URL, retrieval time,
source host, and useful redirect/verification history. Apply moderation and rate
limits. Validity is not inclusion, endorsement, organizer verification, or live
inventory. Report freshness where attendance or purchase decisions depend on it.

## 11. References and companion status

Normative foundations: RFC 8259 (JSON), RFC 3986 (URIs), RFC 3339 (date/time),
BCP 47 / RFC 5646 (language tags), RFC 2119 and RFC 8174 (requirements), RFC 9110
and RFC 9111 (HTTP), JSON Schema Draft 2020-12, ISO 4217 and ISO 3166-1 codes,
and IANA Time Zone Database identifiers. RFC 9562 describes UUID generation.

Companions: RFC 4287 (Atom), RFC 5005 (feed paging), RFC 6721 (entry tombstones),
RFC 8984 (JSCalendar), RFC 5545 (iCalendar), and https://schema.org/Event.
The conversion guide is informative; the Atom profile is normative only for
services explicitly claiming that optional profile.
