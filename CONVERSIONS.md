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

A future adapter may produce ICS using the same instant-preservation principles.
It must define UID, lifecycle mapping, timezone strategy, end/date-boundary rules,
escaping/folding, and update behavior. This release does not implement or certify
an ICS converter. A user-created reminder for a date-only event is a separate,
explicit action; never advertise it as a lossless event export.

## 4. Generation and testing

`python tools/openajang.py generate` validates all included event fixtures, writes
Schema.org outputs and supported JSCalendar outputs under `generated/`, and records
diagnostics including declined conversions. These outputs are derived snapshot
fixtures, not new assertions from the real organizers. Validator conformance and
target-output certification are different: the tests check specified mappings and
important failure cases, not every external client's behavior.

References: https://schema.org/Event, https://schema.org/Action,
https://schema.org/previousStartDate, https://www.rfc-editor.org/rfc/rfc8984.
