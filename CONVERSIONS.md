# OpenAjang conversion guide

**Status:** Informative companion.

OpenAjang is the editable source. Generated outputs are not independently editable
masters. Conversion is not required for direct consumption or feeds. The bundled
converter produces an output plus diagnostics, or explicitly declines a conversion.
No output should claim full fidelity when target semantics differ. Do not round-trip
through another format as the directory's ingestion or storage requirement.

## 1. Schema.org JSON-LD

| OpenAjang | Schema.org Event |
| --- | --- |
| Effective Event ID | `@id` |
| `url`, `title` | `url`, `name` |
| `description` or `summary` | `description` |
| `starts_at`, `ends_at` | `startDate`, `endDate` preserving precision |
| `scheduled`, `postponed`, `rescheduled`, `cancelled` | Corresponding `eventStatus` enumeration |
| `completed` | No exact lifecycle equivalent; omit status and report it |
| `previous_starts_at` | `previousStartDate`, preserving each value's precision |
| `organizer` | Public party fields, without inventing Person/Organization type |
| Physical/virtual/hybrid | `eventAttendanceMode` plus Place/VirtualLocation |
| Tickets | `Offer` objects, preserving optional price and descriptions |
| `image.url`, `tags`, `same_as` | `image`, `keywords`, `sameAs` |
| Registration URL | A labelled generic `potentialAction`, as described below |

Schema.org supports Date and DateTime values for event dates; preserve a full-date
as a full-date without introducing midnight. This does not guarantee how every
search engine or other consumer displays it. Include a diagnostic explaining that
unknown hours and date envelopes require conservative interpretation. Never expand
a date envelope to a continuous busy interval or claim all-day occupancy.

The generated registration action is `Action` with `identifier: "registration"`,
`name: "Register"`, and its URL as `target`. It is a documented output convention,
not a universally understood registration protocol. Do not misuse `RegisterAction`
(which describes registering as a user of a service) or invent zero-price Offers
because a registration URL exists. Emit the action for open registration only;
for waitlist use name `Join waitlist`, and for unknown state use `View registration`.
Do not emit an encouraging action for closed/not-yet-open registration or cancelled,
postponed, or completed events. Omit offline registration actions without a URL.

Report omitted registration-required/state semantics, publisher provenance,
`updated_at`, unannounced/tentative venue certainty, unsupported series relationships,
and unknown extensions. Do not invent a Schema.org Event `dateModified` property
or imply generated markup guarantees search eligibility. A TBA physical venue can
retain known address context, but no placeholder name is fabricated.

Ticket IDs are event-scoped: emit `identifier`, not an unqualified global `@id`.
Seller, price currency, URL, sales validity instants, and descriptions map where
supported. Map available/limited/sold_out/unavailable to InStock/LimitedAvailability/
SoldOut/OutOfStock. Unknown availability is omitted, not guessed. A missing price
stays absent. Do not compute an unrestricted lowest price or final total.

## 2. JSCalendar

| OpenAjang | JSCalendar Event |
| --- | --- |
| Effective Event ID | `uid` |
| Title, description | `title`, `description` |
| Timed start | UTC-normalized `start`, without trailing Z, `timeZone: "Etc/UTC"` |
| Timed end | Exact elapsed `duration` computed after UTC normalization |
| `updated_at` | UTC-normalized `updated` |
| Physical place | `locations` Location object |
| Virtual attendance information | `virtualLocations` VirtualLocation object |
| Event, registration, ticket URLs | `links` Link objects |
| Scheduled/rescheduled/completed | `confirmed` with lifecycle-loss diagnostic where needed |
| Cancelled | `cancelled` |

The supplied converter deliberately uses UTC even if an IANA zone is present,
preserving the authoritative instants and avoiding timezone drift in the output.
It reports loss of civil-time context. It does not convert arbitrary weekly hours.
Offset transitions are handled by subtracting instants, not local clock values.

A date-only event with unpublished hours is **declined**. Inventing midnight or
setting `showWithoutTime` would imply precision or all-day semantics absent in the
source. A postponed event is also declined: its old start is not confirmed active
time, and a generic JSCalendar event would risk misleading attendance. A timed
event with an unpublished end is also declined: JSCalendar's zero-duration default
does not preserve an unknown end. The adapter does not invent an end or duration.

Organizer name and contact/source information can be retained descriptively or
as labelled links; do not assert calendar ownership, chair roles, or invitations
solely because a party organizes the event. A safe public information URL is not
necessarily a direct join URL; describe that distinction in VirtualLocation text.
Registration link keys are adapter conventions; generic clients may show them as
ordinary links. Retain closed/cancelled states in descriptive text without an active
registration link. Ticket links/descriptions do not preserve structured price,
registration requirements, eligibility, component coverage, or inventory semantics.
Emit diagnostics for these losses. Fractional instants are represented without
rounding in UTC start/duration strings; the reference adapter preserves up to six
fractional digits and declines greater precision rather than silently truncating.

## 3. iCalendar and reminders

The TypeScript SDK exports `toICalendar(event, options?)` from `@openajang/core/adapters`.
It produces a single-event RFC 5545 `VCALENDAR` with one `VEVENT`, plus diagnostics,
or declines. It is an optional derived export. It adds no OpenAjang properties and
the `.ics` file is never an editable master or a round-trip source. The profile
below is informative, and external calendar clients are not certified.

| OpenAjang | iCalendar |
| --- | --- |
| Effective Event ID | `UID`, verbatim (text-escaped) |
| `starts_at`, `ends_at` | UTC `DTSTART`, `DTEND` (`YYYYMMDDTHHMMSSZ`) |
| `updated_at` | `DTSTAMP` and `LAST-MODIFIED`, UTC |
| `title` | `SUMMARY` |
| `url` | `URL` |
| Physical name and address | `LOCATION` (comma-joined text) |
| Venue coordinates | `GEO` |
| `tags` | `CATEGORIES` |
| `scheduled`, `rescheduled`, `completed` | `STATUS:CONFIRMED` |
| `cancelled` | `STATUS:CANCELLED` |
| Description, organizer, status note, venue instructions, virtual attendance, registration, tickets | Text in `DESCRIPTION` |

Output has `VERSION:2.0`, `CALSCALE:GREGORIAN`, CRLF line endings, and lines folded
at 75 octets without splitting a UTF-8 sequence. `TEXT` values escape backslash,
semicolon, comma, and newlines. Control characters other than tab are removed with
a diagnostic.

### Identity

`UID` is the effective Event ID, the same value the JSCalendar adapter uses for
`uid`. It does not change when an event is rescheduled, so calendar clients treat
a reschedule as an update. Event IDs are URIs and are not rewritten or case-folded.
Two publishers cannot collide unless they reuse an ID. If an event's URL changes
and it has no explicit `id`, its effective ID changes and clients will see a new
event. Publishers who expect to move should set `id` from the start.

### Dates

Every start and end is converted to an exact UTC instant by subtracting offsets,
so offset changes and DST transitions are preserved. The adapter does not
reinterpret the offset using `time_zone`; the exporter reports that civil-time
context was dropped. Calendar apps display the event in the viewer's zone.

### Revisions

`DTSTAMP` and `LAST-MODIFIED` come from `updated_at`, which advances on material
changes, so exports are deterministic and do not depend on fetch time. Sub-second
digits are truncated in those two fields, with a diagnostic.

`updated_at` is an instant, not a revision counter, and is not converted into
`SEQUENCE`. The exporter omits `SEQUENCE` unless the caller passes
`{ sequence }`. A stateful exporter that stores the last emitted value per
`UID` can increment it whenever start, end, status, or location changes. Without
that state there is no reliable revision order, and the exporter does not invent
one. Some clients compare `SEQUENCE` before applying an update to an imported
event, so a reschedule may not replace an existing entry unless it is supplied.

### Declined conversions

The exporter returns `null` and a `Declined:` diagnostic when fidelity would be lost:

- A date-only start or end (unpublished hours). No midnight is invented and no
  all-day event is created.
- A `postponed` event. Its old start is not confirmed attendance and no
  replacement is known.
- An unknown end. The adapter writes no zero-length event and no assumed duration.
- Start or end with non-zero fractional seconds. `DATE-TIME` cannot hold them and
  the adapter does not truncate an instant.
- An end that is not later than the start.

### Intentional loss

`rescheduled` and `completed` are exported as `CONFIRMED` with the original status
added to the description, since iCalendar has no equivalent. `previous_starts_at`
is not retained. Registration and ticket details are descriptive text only, with
no price, availability, or registration semantics. Registration URLs appear only
when registration is open or on a waitlist and the event is active. Organizers are
described in text. No `ORGANIZER`, `ATTENDEE`, or `METHOD` property is written, so the file
is a calendar entry and not an invitation. Virtual attendance is text in the
description. The page may not be a direct join link. Publisher, series,
`same_as`, image, language, and extensions are omitted with diagnostics.

### Example

`2026-11-14T18:00:00+08:00` to `2026-11-14T20:00:00+08:00` becomes
`DTSTART:20261114T100000Z` and `DTEND:20261114T120000Z`. If the event moves to
the following week, `UID` stays the same and the times change.

### Subscriptions (optional)

A feed is a static `text/calendar` file (for example `events.ics`) that a
publisher generates at build time and serves from any static host. It needs no
OpenAjang-operated server and no new canonical document. The exporter handles one
event per file; a collection feed would place several `VEVENT` components in one
`VCALENDAR`, which this release does not generate.

- A one-time import is a snapshot and does not stay in sync.
- A subscribed calendar may refresh on the client's own schedule, from minutes to
  days. This is not a real-time notification.
- Keep `UID` stable across updates and reschedules.
- Keep a `STATUS:CANCELLED` entry in the feed for a reasonable period. Removing an
  event from the feed does not reliably remove it from a subscriber's calendar.
  Clients that drop it may keep a stale copy, and the right retention window
  depends on the audience.
- A cancelled event with an unknown end is declined, so it cannot appear in the
  feed as a cancellation. A publisher needing to retract such an event must
  supply its own handling.
- A feed does not implement iTIP (RFC 5546). `METHOD:CANCEL` and `METHOD:REQUEST`
  messages carry attendee and delivery semantics that a static file cannot honor.
- A time-window feed omits old events. A subscriber who was offline may miss a
  cancellation published and expired in between.

A user-created reminder for a date-only event is a separate, explicit action.
Never advertise it as a lossless event export.

## 4. Generation and testing

`python tools/openajang.py generate` validates all included event fixtures, writes
Schema.org outputs and supported JSCalendar outputs under `generated/`, and records
diagnostics including declined conversions. `pnpm run generate:ics` writes the iCalendar
fixtures (`generated/*.ics`) and `generated/icalendar-diagnostics.json` from the same
examples; a test compares them with the exporter's output and parses them with the
independent `ical.js` parser. That parser checks RFC 5545 syntax and values, but
Google Calendar, Apple Calendar, and Outlook were not tested, and their import and
refresh behavior may differ. These outputs are derived snapshot
fixtures, not new assertions from the real organizers. Validator conformance and
target-output certification are different: the tests check specified mappings and
important failure cases, not every external client's behavior.

References: https://www.rfc-editor.org/rfc/rfc5545, https://www.rfc-editor.org/rfc/rfc5546,
https://schema.org/Event, https://schema.org/Action,
https://schema.org/previousStartDate, https://www.rfc-editor.org/rfc/rfc8984.
