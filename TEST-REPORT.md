# Validation and scenario report

**Run date:** 29 October 2026.  
**Result:** 33 automated test methods passed, including multiple per-example and
negative subcases. All eight event fixtures passed the bundled Draft
2020-12 schema and procedural validator. This is local regression evidence, not
an independent certification or proof of live interoperability.

## Outputs

| Result | Count |
| --- | ---: |
| Event fixtures validated | 8 |
| Schema.org JSON-LD outputs generated | 8 |
| JSCalendar outputs generated | 3 |
| JSCalendar conversions explicitly declined for unpublished clock times | 5 |
| Atom example entries parsed and checked | 8 |
| RSS example items parsed and checked | 8 |

JSCalendar generated: Belgrade hackathon, DevFest Kuala Lumpur, WebDavao.
JSCalendar declined: React Summit, PyCon Davao, FOSDEM, Chasing Clouds, Devcon India.
The museum listing uses a date envelope with text visiting hours; its clock times
are not represented as one exact attendance interval.
Per-example conversion losses are recorded in `generated/conversion-diagnostics.json`.

## Organizer, participant, and developer scenarios

| Scenario | Expected outcome | Evidence |
| --- | --- | --- |
| Organizer provides one minimal event and a registration link | Valid document; Register action for explicit open state | Minimal spec example validation and registration-policy test |
| Venue changes | Same effective identity can replace stored representation | Refresh matrix |
| Cancellation with old registration URL still present | Preserve cancellation; suppress registration encouragement | Action-policy and both converter lifecycle tests |
| Postponement retains old time | Old start not exported as confirmed calendar attendance | JSCalendar conversion explicitly declined |
| Date-only event moved to a timed date | Preserve literal earlier date in mixed-precision history | Rescheduling precision test |
| Earlier timestamp uses a different offset but same current instant | Reject as current start in history | Instant-comparison test |
| Registration open, waitlist, unknown, not-yet-open, closed | Distinct conservative actions; no false open assertion | Registration-policy and output tests |
| Organizer publishes a new edition at an old homepage | New ID cannot overwrite saved event as a revision | Identity-conflict refresh test; new-edition guidance |
| Unrelated source copies an Event ID | Matching ID alone cannot authorize overwrite | Unverified-source conflict test |
| Publisher returns invalid data or a server error | Retain last valid event; back off on failure | Refresh-decision matrix |
| Discovered JSON file disappears | Rediscover original HTML before removal policy | 404 refresh-decision test; network retrieval not executed |
| Two different discovery links | Reject ambiguity | HTML discovery tests |
| Duplicate links, ignored base element, cross-origin alternate | Deterministic discovery under the core rules | Local explicit-head parser tests |
| Free/unknown/eligibility-dependent ticket prices | Preserve published tiers; no fabricated zero or lowest-price aggregate | Price and generated-output tests |
| Timezone offset changes across a timed event | Preserve UTC instants and correct elapsed duration | DST-transition conversion test |
| Invalid or overly precise time values | Reject invalid core values; decline adapter precision loss | Invalid-date, submicrosecond-order, and adapter-precision tests |
| Extension-unaware consumer | All eight documents remain valid without extensions | Extension-free validation; useful prose was manually reviewed |
| Ordinary feed reader | Valid XML summaries and human links remain available | Atom/RSS XML parsing and ID/link checks; no external reader integration |

## Schema and procedural checks

The schema itself passes `Draft202012Validator.check_schema`. Actual validation
uses the bundled custom format checker, not annotation-only format handling.
Negative tests cover required fields, wrong types/status/version, blank text,
invalid real calendar dates, missing/unknown offsets, leap-second exclusion,
invalid timezones/language tags/country/currency codes, mixed start/end precision,
invalid end ordering, duplicate JSON names, non-JSON constants, Unicode surrogates,
duplicate ticket IDs, Unicode-casefold duplicate tags, venue placeholders,
location-mode contradictions, negative/ambiguous price syntax, registration/sales
window ordering, unsupported schedule data, malformed extension names, URL credentials,
unsafe link schemes, and bounded HTML discovery input.

## Revisions made during testing/review

- Preserve stable identity across updates. A source change alone does not establish
  identity continuity or organizer authority.
- Do not export an unpublished timed end as JSCalendar's default zero duration;
  explicitly decline it, just as date-only precision cannot become all-day time.
- Normalize timed outputs to UTC and compute duration from instants, including
  offset transitions. Preserve supported fractional precision; decline greater
  precision rather than truncate.
- Do not invent Person/Organization kind from the core party object. Map public
  `phone` to Schema.org `telephone` and keep unspecified party type unspecified.
- Give edited fixtures their own publisher and revision timestamp, with an explicit
  notice that the source facts and availability are not newly verified.
- Keep the feed's modification clock separate from the publisher's event timestamp.

## Not tested or claimed

No live organizer sites or registration forms were checked. No schema URL was
deployed, and no HTTP fetching, conditional requests, caching, redirection, DNS
rebinding defense, server-side request isolation, browser CORS, user notifications,
or independent app interoperability was integration-tested. The explicit-head
HTMLParser helper is not a full HTML5 parser. Atom is checked for generated XML,
required profile fields and link/ID consistency, not all RFC constraints by an
independent Atom validator. Schema.org and JSCalendar outputs are checked against
selected mappings and important semantic-loss cases, not independently certified
against every target constraint or consumer implementation.

Examples remain illustrative snapshots. Before a production service claims
conformance, add network integration, security, and independent-consumer tests.
Run the commands in README to reproduce the local checks.
