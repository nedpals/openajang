---
title: Export from your platform
description: Add OpenAjang export to event software. Map your records, keep ids stable, serve each event's document, and link it from the event page.
section: platforms
order: 1
---

Adding OpenAjang export to an event platform gives every hosted event a public, machine-readable document linked directly from its event page. Attendees can paste the page URL into compatible calendar apps or directories, which discover the document and refresh updates automatically.

## What changes in your product

Your platform keeps doing what it does now. Organizers still create and edit events in your dashboard, attendees still register through your forms or checkout, and you still own the attendee list. OpenAjang adds one public output per event: a JSON document at a stable URL, plus a `<link>` in the event page's `<head>` that points to it.

That output is generated from the event record you already store. Organizers do not edit a second copy. When they change the event in your product, the document changes with it. The document points to your registration page; OpenAjang does not submit registrations or read form responses ([spec §3.1](/spec/#31-minimal-example)).

The work is:

1. Map your event record to the document's fields.
2. Give each event a stable id.
3. Set `updated_at` only when the exported event changes.
4. Serve the document over HTTPS with an accepted media type.
5. Add the discovery link to each event page.
6. Handle cancellation, removal and moves.
7. Keep private data out.

## Map your event records

Map your database records to the document's public fields ([spec §3 to §7](/spec/#32-core-properties)). Field names and database columns vary by platform:

| Your record (illustrative) | OpenAjang field | Notes |
| --- | --- | --- |
| Public event page permalink | `url` | Required. The human-facing page. Use the exact URL the page is served at ([§3.2](/spec/#32-core-properties), [§8.2](/spec/#82-html-discovery)). |
| A stored export id (new column) | `id` | Optional in the spec, recommended for most platforms. See [Assign a stable id](#assign-a-stable-id). |
| Event name | `title` | Required. |
| Tagline | `summary` | Optional short description. |
| Event body | `description` | Plain text. If your editor stores HTML or Markdown, convert it to plain text; consumers render these strings as text ([§3](/spec/#3-document-and-authoring-rules)). |
| Published, cancelled, postponed, date-change history | `status`, `status_note`, `previous_starts_at` | See [Map organizer actions to lifecycle changes](#map-organizer-actions-to-lifecycle-changes) ([§5.2](/spec/#52-status), [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). |
| Start and end time, venue time zone | `starts_at`, `ends_at`, `time_zone` | Date-times need an explicit UTC offset; `time_zone` is an IANA zone for context and does not replace the offset ([§4.1](/spec/#41-timed-events)). |
| Event with dates set but hours not yet set | `starts_at`, `ends_at` as `YYYY-MM-DD` | Emit full dates, not midnight. The end date is inclusive, and start and end must use the same precision ([§4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)). |
| Venue name, address, map pin | `location.physical` | `address.country` must be an uppercase ISO 3166-1 alpha-2 code. For an unannounced venue use `status: "to_be_announced"` and leave out `name`; never write `TBA` as a name ([§6.2](/spec/#62-location)). |
| Online event page | `location.virtual` | `url` must be public. It can be a page that explains how to join ([§6.2](/spec/#62-location)). |
| Organizer profile | `organizer` | Required. `name`, plus optional `url` and public contact details only ([§6.1](/spec/#61-party-objects)). |
| Your platform | `publisher` | Optional. The party serving the document ([§2](/spec/#2-terminology)). |
| RSVP or registration settings | `registration` | `required` is a boolean. `status` is `not_yet_open`, `open`, `closed`, `waitlist` or `unknown`. `url` is your registration page ([§7.1](/spec/#71-registration)). |
| Ticket types | `tickets` | Each needs a string `id` that stays stable while the option is the same, and a `name`. `price.amount` is a decimal string, `"0"` for free ([§7.2](/spec/#72-tickets)). |
| Cover image | `image` | `url` required, `alt` recommended ([§6.3](/spec/#63-other-fields)). |
| Topic labels | `tags` | Must be unique after Unicode case folding ([§6.3](/spec/#63-other-fields)). |
| Recurring series the event belongs to | `series` | Groups listings. Each occurrence is still its own document ([§6.3](/spec/#63-other-fields)). |
| Last change to the exported event | `updated_at` | Required. See [Set updated_at only on material change](#set-updated_at-only-on-material-change). |
| Platform-specific fields | `extensions` | Namespaced keys such as `org.example.events:capacity`. The core fields must stay accurate without them ([§3](/spec/#3-document-and-authoring-rules), [§9](/spec/#9-extensions-versions-and-conformance)). |
| Attendee list, check-in codes, organizer account email, internal notes | none | Never exported. See [Keep private data out](#keep-private-data-out). |

Leave out any optional field you have no value for. Do not write `null`, an empty string, an empty array or a placeholder; no core property accepts `null`, and published core arrays must be nonempty ([§3](/spec/#3-document-and-authoring-rules)). The required fields are `$schema`, `type`, `url`, `title`, `status`, `starts_at`, `location`, `organizer` and `updated_at`.

Do not export draft or private events. The format describes one public event listing ([§1](/spec/#1-purpose-and-scope)).

### What a platform might emit

This is an illustrative document for a fictional platform, Example Events, hosting a monthly meetup for a fictional organizer:

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "id": "urn:uuid:3f1c9a52-8e47-4d0b-9b6e-2a7d5c1e8f40",
  "url": "https://events.example.org/example-community/build-night-november-2026",
  "title": "Community Build Night: November 2026",
  "summary": "Bring a project, get help, and show what you built.",
  "description": "An evening of building and short demos. Talks are streamed live; the hands-on help tables are in person only.",
  "language": "en",
  "status": "scheduled",
  "starts_at": "2026-11-14T18:00:00+08:00",
  "ends_at": "2026-11-14T21:00:00+08:00",
  "time_zone": "Asia/Manila",
  "organizer": {
    "name": "Example Community",
    "url": "https://events.example.org/example-community"
  },
  "publisher": {
    "name": "Example Events",
    "url": "https://events.example.org/"
  },
  "location": {
    "type": "hybrid",
    "physical": {
      "name": "Community Hall",
      "address": {
        "street": "123 Example Street",
        "locality": "Davao City",
        "country": "PH"
      },
      "instructions": "Enter through the side door on Example Street."
    },
    "virtual": {
      "url": "https://events.example.org/example-community/build-night-november-2026/stream",
      "platform": "Example Events live stream",
      "instructions": "The stream opens on this page 15 minutes before the start. No sign-in is needed to watch."
    }
  },
  "registration": {
    "required": true,
    "status": "open",
    "url": "https://events.example.org/example-community/build-night-november-2026/register",
    "closes_at": "2026-11-14T12:00:00+08:00"
  },
  "tickets": [
    {
      "id": "general",
      "name": "General admission",
      "price": { "amount": "0", "currency": "PHP" },
      "availability": "limited"
    },
    {
      "id": "supporter",
      "name": "Supporter",
      "description": "Same admission as general, with a contribution toward venue costs.",
      "price": { "amount": "250.00", "currency": "PHP" },
      "availability": "available"
    }
  ],
  "image": {
    "url": "https://events.example.org/media/build-night-november-2026.jpg",
    "alt": "People working on laptops around long tables"
  },
  "tags": ["meetup", "hardware", "software"],
  "series": {
    "id": "https://events.example.org/example-community/series/build-night",
    "title": "Community Build Night",
    "url": "https://events.example.org/example-community/series/build-night"
  },
  "updated_at": "2026-10-29T08:00:00Z"
}
```

The location is `hybrid` because live remote viewing is part of the event, and the description says which part is in person only. A hybrid listing only says that both modes exist somewhere in the event, so limits like this belong in the text ([§1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). The virtual `url` is a public page that explains how to watch, not a personal join link.

## Assign a stable id

Apps track an event by its effective Event ID: `id` if present, otherwise `url` ([§2](/spec/#2-terminology)). That id must identify one occurrence or one overall edition, must survive postponement, rescheduling, venue changes, cancellation, completion and migrations, and must never be reused ([§5.1](/spec/#51-identity)).

An explicit `id` is recommended when `url` is a mutable slug or a page likely to move ([§5.1](/spec/#51-identity)). On most platforms organizers can rename events and change slugs, so set `id` and store it with the event. Choose one of two forms:

- Generate a UUID URN once, when the event is created, and store it. Never regenerate it on export.
- Use an occurrence-specific HTTPS URI in a namespace you control, such as a permanent short link that does not change when the slug does.

Your database's internal numeric key is not an absolute URI, so it cannot be `id` on its own. You can build an HTTPS URI from it if that URI stays stable through migrations.

Give a new occurrence a new id. If your product has a "duplicate event" or "run again next year" action, the copy gets a fresh id. Future annual editions must get new ids even when they reuse a homepage ([§5.1](/spec/#51-identity)). Monthly meetups are separate documents, each with its own id, grouped by `series` ([§6.3](/spec/#63-other-fields)).

If you already exported events without `id` and want to add one, set `id` to the event's previous effective ID (its previous `url`), not a freshly generated UUID. Fresh ids are for new occurrences ([§5.1](/spec/#51-identity)). Once `id` is set, the page URL can change without breaking continuity for people who saved the event.

## Set updated_at only on material change

`updated_at` records when the event data last changed in a meaningful way. A material change must advance it; this includes dates, venue, lifecycle status, registration, ticket prices and availability. Unchanged fetches and rebuilds must not advance it ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).

Platforms often get this wrong by copying a row's generic modified timestamp, which moves when someone views the dashboard, a counter increments or a deploy rebuilds every page. Track the exported content instead. One approach:

1. When an event is saved, build its document without `updated_at`.
2. Compare it with the last document you published for that event (a stored hash works).
3. If it differs, set `updated_at` to the current time and store the new hash. If it is the same, keep the old `updated_at`.

Rendering on each request, rebuilding the site, or changing your cache layer then never moves the timestamp. This approach also advances `updated_at` for small text edits. The spec does not require that, but consumers should warn when content changes without an advancing timestamp ([§8.3](/spec/#83-redirects-caching-and-refresh)), so advancing is the safer side. A contract-only migration that keeps the event's meaning need not advance it ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).

Ticket `availability` is current only as of `updated_at`, and changing it advances that timestamp ([§7.2](/spec/#72-tickets)). If you derive availability from live counts, export the bucket (`available`, `limited`, `sold_out`, `unavailable`) rather than a number, so the timestamp moves when the bucket changes and not on every registration.

## Serve the document

Give each event a document URL, for example the event page URL followed by `/event.openajang.json`. The document URL may differ from `url` ([§2](/spec/#2-terminology)).

The response must be a single UTF-8 JSON object served as `application/vnd.openajang+json` or `application/json`; parameters such as `charset=utf-8` are allowed ([§3](/spec/#3-document-and-authoring-rules)). The spec accepts HTTP and HTTPS URLs; serve over HTTPS and do not redirect from HTTPS to HTTP, since consumers should reject that downgrade ([§8.3](/spec/#83-redirects-caching-and-refresh)).

You should also send HTTP cache controls and `ETag`, `Last-Modified` or both ([§8.3](/spec/#83-redirects-caching-and-refresh)). Apps that store events revalidate with these, and a `304` response keeps their copy. A response might look like this (header values are illustrative):

```http
HTTP/2 200
content-type: application/vnd.openajang+json; charset=utf-8
cache-control: public, max-age=300
etag: "b7e4c1d0"
access-control-allow-origin: *
```

Derive the `ETag` from the bytes you serve, so it changes whenever the document does. HTTP validators and `updated_at` are separate: you must still advance `updated_at` for material changes when you use validators ([§8.3](/spec/#83-redirects-caching-and-refresh)). The `access-control-allow-origin` header only matters for browser-based tools that fetch your document directly; server-side resolvers do not need it ([§10](/spec/#10-security-and-operational-requirements)).

Keep documents small. Resolvers apply byte limits, and the spec recommends a 1 MiB limit for JSON ([§10](/spec/#10-security-and-operational-requirements)).

## Add the discovery link to each event page

Add one alternate link to the `<head>` of each event page, pointing to that event's document ([§8.2](/spec/#82-html-discovery)):

```html
<head>
  <link rel="canonical"
        href="https://events.example.org/example-community/build-night-november-2026">
  <link rel="alternate"
        type="application/vnd.openajang+json"
        href="https://events.example.org/example-community/build-night-november-2026/event.openajang.json">
</head>
```

With that link, a person can paste the event page URL into a compatible app instead of hunting for the JSON URL. The rules that matter for a platform:

- Resolvers fetch HTML without running scripts. If your event pages render on the client, render this link in the server's HTML response.
- Only links in `<head>` count. A relative `href` resolves against the final page URL, and resolvers ignore any `<base>` element. An absolute `href` avoids surprises.
- One event per page. Two links to different documents produce an ambiguity error, so do not put OpenAjang alternates for several events on an organizer profile, calendar or search page.
- The `href` must return JSON directly. Pointing it at another HTML page does not work; recursive discovery is forbidden.
- The document's `url` should equal the page's final URL, or the page's canonical link, after the normalization in §8.2. A mismatch produces a relationship warning. Discovery does not treat `http` and `https` as equal or strip trailing slashes, so emit `url` in exactly the form your pages are served at.

Add discovery links only to pages you control ([PUBLISHING.md](https://github.com/nedpals/openajang/blob/master/PUBLISHING.md)). For a platform, that is the event pages you serve.

## Map organizer actions to lifecycle changes

Each lifecycle action in your dashboard maps to a document change. The id stays the same in every case ([§5.1](/spec/#51-identity)).

| Organizer action in your product | Document change | Spec |
| --- | --- | --- |
| Moves the event to a confirmed new date | `status: "rescheduled"` and the new `starts_at` and `ends_at`. `previous_starts_at` must include at least the immediately previous start; you should keep the full history in the order of the moves | [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation) |
| Delays the event with no new date yet | `status: "postponed"` and keep the last `starts_at`. You should explain the uncertainty in `status_note` | [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation) |
| Adds clock times to an event that had only dates | Change `starts_at` and `ends_at` to date-times; this is an information update, not automatically a reschedule | [§4.3](/spec/#43-precision-changes) |
| Cancels the event | `status: "cancelled"`. The document should keep returning `200 OK` | [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation) |
| Sells out | Ticket `availability: "sold_out"`, or `registration.status` of `closed` or `waitlist`; event `status` does not change | [§5.2](/spec/#52-status), [§7](/spec/#7-registration-and-ticket-discovery) |
| Event date passes | Nothing required; past events may stay `scheduled`, or you may set `completed` | [§5.2](/spec/#52-status) |
| Deletes the event | The document URL should return `410 Gone` | [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation) |

Rescheduling, postponing, cancelling, changing precision, a sell-out and setting `completed` change a document you keep serving; each is a material change, so advance `updated_at` with it. The passage of time alone does not require an update ([§5.2](/spec/#52-status)), and a removal response such as `410` is not a document, so neither advances `updated_at`.

A cancelled event should stay available as a `200 OK` document so people who saved it learn about the cancellation. A cancelled document is not a deletion. You do not need to strip old registration or ticket fields; consumers must stop encouraging registration while an event is cancelled, postponed or completed ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).

When an organizer deletes an event, you should return `410 Gone`. Use `404` only for "currently unavailable", for example while an event is temporarily hidden. Apps do not read `410` as a cancellation ([§8.3](/spec/#83-redirects-caching-and-refresh)), so if the event was called off, publish the cancellation first and keep it up.

If an organizer moves an event off your platform to another host, you should confirm the transfer from your side, for example with a redirect from your document URL to the new one. Matching ids alone do not prove continuity ([§5.1](/spec/#51-identity)).

[Keep an event current](/docs/keep-an-event-current/) covers these changes from the organizer's side.

## Keep private data out

The document is public and anyone can fetch it. Never publish attendee data, private contacts, credentials, personalized ticket links or private access URLs ([§10](/spec/#10-security-and-operational-requirements)). On a platform that means:

- Do not export attendee lists, registrant names, check-in codes or order links.
- Do not copy the organizer's account email or phone into `organizer`. Party contact fields must not contain private information without permission ([§6.1](/spec/#61-party-objects)), so export only contact details the organizer chose to make public.
- For online events, `location.virtual.url` must be a public URL. Private join tokens, passwords and personalized links must not be published ([§6.2](/spec/#62-location)). Link to a public page that explains how registered attendees get access.
- Point `registration.url` and ticket `url` at your public registration or ticket page, not at a per-user checkout session.

## Check the endpoint

You now have a document per event, served at a stable URL and linked from the event page. Check one event on a publicly reachable host:

```sh
# 1. The document URL returns 200 with an accepted media type and cache headers
curl -sI https://events.example.org/example-community/build-night-november-2026/event.openajang.json

# 2. The served document validates (from a clone of the OpenAjang repository)
curl -s https://events.example.org/example-community/build-night-november-2026/event.openajang.json -o event.json
python tools/openajang.py validate event.json

# 3. The event page's served HTML contains the discovery link
curl -s https://events.example.org/example-community/build-night-november-2026 | grep -i 'application/vnd.openajang+json'
```

You can also paste the document into the [browser validator](/validator/). The validator checks the document, not the HTTP response, so keep step 1.

To test discovery the way an app does, resolve the event page URL with `@openajang/resolver` (a release candidate, Node.js 22.18 or newer, installed with `npm install @openajang/resolver@next`):

```ts
import { resolveOpenAjang } from '@openajang/resolver';

const { event, provenance, relationshipWarnings } = await resolveOpenAjang(url);
```

Pass your event page URL as `url`. `provenance.documentUrl` should be your document URL and `provenance.declaredEventUrl` your page. A relationship warning means the document's `url` does not match the page it was discovered from. The resolver blocks private network destinations by default, so run this against a public staging or production host.

Also check one cancelled event (still `200`, `status: "cancelled"`) and one deleted event (`410`).

## Optional: generate Schema.org and JSCalendar from the same record

If your event pages already carry Schema.org markup, or you offer calendar exports, you can generate them from the same OpenAjang document. The [conversion guide](/conversions/) describes the mappings. OpenAjang is the editable source and generated outputs are not separately editable masters. Apps and directories read OpenAjang directly, so you do not need to convert to anything for them, and you should not round-trip through another format back into OpenAjang ([conversion guide](/conversions/)).

`@openajang/core` includes adapters. Each call returns `{ result, diagnostics }` and sets `result` to `null` when it declines a conversion:

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

### Schema.org JSON-LD

Date-only values stay dates, without midnight. Registration becomes a generic `Action` with `identifier: "registration"`, emitted only when registration is open (or labelled `Join waitlist` or `View registration` for those states), and never for cancelled, postponed or completed events. `completed` has no exact Schema.org status, so it is omitted and reported. No `dateModified` is invented, and generated markup does not guarantee search eligibility ([conversion guide §1](/conversions/#1-schemaorg-json-ld)).

JSON-LD in your page does not replace the alternate link. OpenAjang discovery uses the `<link>` in `<head>`; inline data blocks are outside the discovery contract.

### JSCalendar

Timed events convert with the start normalized to UTC and an exact duration computed from the end. The converter reports the loss of civil-time context and of structured ticket, price and registration details ([conversion guide §2](/conversions/#2-jscalendar)).

The converter declines three kinds of valid events:

- Date-only events. Inventing midnight or marking them as all-day would claim hours or all-day attendance the source does not state.
- Timed events without `ends_at`. JSCalendar's default zero duration would not preserve an unknown end, and the adapter does not invent one.
- Postponed events. The retained start is not confirmed attendance time, so a calendar entry would mislead.

Handle `result: null` in your product, for example by hiding the calendar export for that event and showing why. A calendar exporter must not silently turn unknown hours into an all-day block ([§4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)). The reference tools do not generate iCalendar ([conversion guide §3](/conversions/#3-icalendar-and-reminders)).

## Checklist

The spec defines these as separate conformance capabilities ([§9](/spec/#9-extensions-versions-and-conformance)).

Basic Publisher, a stable hosted document with lifecycle and timestamp discipline:

- [ ] Each document is one valid JSON object with the required fields and no `null` or empty placeholders ([§3](/spec/#3-document-and-authoring-rules)).
- [ ] Served as `application/vnd.openajang+json` or `application/json` ([§3](/spec/#3-document-and-authoring-rules)).
- [ ] Each event has a stable effective id that is never reused; new editions and copies get new ids ([§5.1](/spec/#51-identity)).
- [ ] `updated_at` advances on material changes and never on rebuilds or unchanged fetches ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).
- [ ] Postponed, rescheduled and cancelled events use the right `status`; a cancelled event should stay a `200` document and a deleted one should return `410` ([§5.2](/spec/#52-status), [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).
- [ ] Cache controls and `ETag` or `Last-Modified` are sent (should) ([§8.3](/spec/#83-redirects-caching-and-refresh)).
- [ ] No attendee data, private contacts, credentials, personalized links or private access URLs ([§6](/spec/#6-parties-locations-and-ancillary-fields), [§10](/spec/#10-security-and-operational-requirements)).

Discoverable Publisher, all of the above plus:

- [ ] Each event page has one alternate link in the `<head>` of its server-rendered HTML, pointing directly at the JSON ([§8.2](/spec/#82-html-discovery)).
- [ ] The document's `url` matches the page's final URL or canonical link (should) ([§8.2](/spec/#82-html-discovery)).

Converter (optional, reported separately):

- [ ] Schema.org and JSCalendar outputs are generated from the OpenAjang document, never edited or round-tripped back ([conversion guide](/conversions/)).
- [ ] Declined conversions and reported losses are surfaced; no midnight, all-day block or end time is invented ([conversion guide §2](/conversions/#2-jscalendar), [§4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)).

## Next

- [Keep an event current](/docs/keep-an-event-current/)
- [Recurring, annual and multi-day events](/docs/recurring-annual-and-multi-day-events/)
- [Directory feeds](/docs/directory-feeds/)
