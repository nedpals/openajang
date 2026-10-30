---
title: Display an imported event
description: Show an imported OpenAjang event without claiming hours, prices, availability or authority that the document does not state.
section: apps
order: 3
---

Displaying an imported OpenAjang event faithfully means showing what the organizer published without filling gaps with assumptions. Under the specification's conservative interpretation rule, consumers must not infer eligibility, continuous occupancy, universal ticket coverage, or a final payable price from missing information ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).

When a field is absent or partial, your interface should reflect what is known rather than inventing details.

## Render every string as plain text

Every human-readable string in a document is plain text, and consumers must render it as text ([Spec §3](/spec/#3-document-and-authoring-rules)). All data is untrusted: render text without executing markup or extension values ([Spec §10](/spec/#10-security-and-operational-requirements)). This covers `title`, `summary`, `description`, `status_note`, every `instructions` field, ticket names and descriptions, and party names.

If a publisher writes markup into a description, show the characters they wrote. A description of `Bring a laptop. <b>Doors at 6</b>` reaches the page escaped:

```html
<p>Bring a laptop. &lt;b&gt;Doors at 6&lt;/b&gt;</p>
```

Do not pass these strings through an HTML or Markdown renderer, and do not display extension values as markup. Display and navigable URLs must use the allowed schemes ([Spec §10](/spec/#10-security-and-operational-requirements)), which for `url` fields are absolute HTTP or HTTPS ([Spec §3](/spec/#3-document-and-authoring-rules)). `id` is different: it may be another absolute URI scheme such as a `urn:uuid:` value, so do not render it as a link. Fetched images need your own privacy and security policy ([Spec §6.3](/spec/#63-other-fields)). As a display recommendation, use `image.alt` as the alternative text when it is present; the spec defines the field but not how to render it.

## Date-only events

The document gives calendar dates with no clock time:

```jsonc
{
  "starts_at": "2026-11-14",
  "ends_at": "2026-11-16"
}
```

Show the dates as written and say that exact hours are not published, which the spec says consumers should do ([Spec §4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)). `ends_at` is the inclusive last calendar date, so this example covers 14, 15 and 16 November. Without `ends_at`, only the start date is described.

```html
<p>
  <time datetime="2026-11-14">14</time> to
  <time datetime="2026-11-16">16 November 2026</time>
</p>
<p>Exact hours are not published. Check the event page for times.</p>
```

Visiting hours and daily schedules, when the publisher has them, live in `description` or `location.physical.instructions`, so keep those visible near the dates.

What not to do:

- Do not show `00:00` or any other clock time. Dates do not imply midnight, all-day attendance, continuous occupancy, or activity every day.
- Do not convert the dates through a time zone. `time_zone` may give location context, but it does not turn dates into instants.
- Do not offer an "Add to calendar" export that turns the dates into an all-day busy block. A calendar exporter must not silently turn unknown hours into an all-day block. A user may explicitly create a labelled date reminder; present it as their reminder, not as an export of the event ([Conversions §3](/conversions/#3-icalendar-and-reminders)).
- Do not describe a range as "daily" or "every day". A date range is the outer calendar envelope of the event ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).

## Timed events, offsets and time zones

The document gives date-times with an offset, and optionally an IANA zone:

```jsonc
{
  "starts_at": "2026-11-14T18:00:00+08:00",
  "ends_at": "2026-11-14T21:00:00+08:00",
  "time_zone": "Asia/Manila"
}
```

The offset defines the instant, and that instant is authoritative ([Spec §4.1](/spec/#41-timed-events)). Show the time in the event's local terms, using `time_zone` as context, and convert to the viewer's zone if your product does that:

```html
<time datetime="2026-11-14T18:00:00+08:00">14 November 2026, 18:00 to 21:00 (Asia/Manila)</time>
```

Without `time_zone`, you can show the time with the offset as published, for example `18:00 (UTC+08:00)`.

Sometimes the offset and the zone disagree. Asia/Manila is `+08:00`, so a document with `"starts_at": "2026-11-14T18:00:00+09:00"` and `"time_zone": "Asia/Manila"` describes the instant `09:00Z`, which is 17:00 in Manila. Consumers may warn about the mismatch but must preserve the encoded instant. Show 17:00 Manila time (or 18:00 at `+09:00`) and, if you like, a note that the published time zone and offset do not agree.

What not to do:

- Do not read `18:00` as 18:00 in Asia/Manila. That moves the event by an hour, and consumers must not silently reinterpret an offset-bearing value using a civil time zone.
- Do not interpret `registration.opens_at`, `closes_at`, or ticket `sales_start` and `sales_end` through the event zone. They are independent instants.
- Do not invent an end time when `ends_at` is absent. Show the start only ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).

## Past events still marked scheduled

The document says `"status": "scheduled"`, but its dates are in the past. Publishers need not update a listing just because time passed ([Spec §5.2](/spec/#52-status)).

Classify the event as past from its dates, separately from its status, which the spec says consumers should do. Consumers must not present an already-ended event as upcoming merely because the status still says `scheduled`. In practice, move it out of upcoming lists and label it as ended.

- For a timed event with `ends_at`, it has ended once that instant passes.
- For a date-only event, the inclusive last date has to be over. The spec says this classification should use the event's zone context where available and be conservative near day boundaries, so do not mark it past while the last date may still be under way at the venue.
- Without `ends_at`, the spec does not say when the event ends. Once the start has passed, do not present it as upcoming; a label such as "Started 14 November 2026" avoids claiming more.

We suggest hiding the Register action on an event you classified as past, even if `registration.status` still says `open`. The spec says past-event handling in section 5 takes precedence over registration state ([Spec §7.1](/spec/#71-registration)), but its mandatory suppression covers only `cancelled`, `postponed` and `completed` events, so this is a display recommendation.

What not to do:

- Do not relabel the status as "Completed". Your label describes your classification by date; the publisher's status is still `scheduled`.

## Registration actions

The document has a `registration` object with a required `required` boolean and an optional `url`, `status`, `opens_at`, `closes_at` and `instructions` ([Spec §7.1](/spec/#71-registration)):

```jsonc
{
  "registration": {
    "required": true,
    "status": "waitlist",
    "url": "https://example.org/events/build-night-2026/register"
  }
}
```

Pick the action from `status` and the presence of `url`:

| `registration.status` | What to show |
| --- | --- |
| `open`, with `url` | A Register action. |
| `waitlist`, with `url` | A Join waitlist action. |
| `unknown` or omitted, with `url` | A View registration link. |
| `closed` | The state, for example "Registration closed". A plain link to the source may remain. |
| `not_yet_open` | The state, for example "Registration not yet open", with `opens_at` if published. A plain link to the source may remain. |

The spec permits the first three labels; it does not require them. `not_yet_open` and `closed` are different states, so do not merge them into one "unavailable" label.

Without a `url`, registration may be offline. Show `instructions` as text and no action. When `registration` is omitted entirely, the information is not published; it does not mean registration is not required. When `required` is `false`, the document says registration is not required, and you can say so.

The event's lifecycle comes first. Registration and purchase encouragement must be suppressed while the event is `cancelled`, `postponed`, or `completed`, even if older registration or ticket fields remain ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). For an event you classified as past by date, we suggest hiding the actions too (see [Past events still marked scheduled](#past-events-still-marked-scheduled)).

The spec says opening and closing times should be checked for contradictory or stale state before you present an actionable claim. If `status` is `open` but `closes_at` has passed, you should refresh the document first. If the contradiction remains, one suggested approach is to drop the Register action and show a View registration link with the published closing time.

What not to do:

- Do not claim registration is currently open unless the document says `open`.
- Do not invent a publisher status from a deadline. A passed `closes_at` does not let you print "Registration closed".

## Tickets and prices

The document lists admission options. Each has an `id` and `name`, and may have `description`, `price`, `availability`, `seller`, `url` and sales instants ([Spec §7.2](/spec/#72-tickets)):

```jsonc
{
  "tickets": [
    {
      "id": "member",
      "name": "Member",
      "description": "For Example Community members. Bring your member card.",
      "price": { "amount": "0", "currency": "PHP" },
      "availability": "available"
    },
    {
      "id": "standard",
      "name": "Standard",
      "price": { "amount": "750.00", "currency": "PHP" },
      "availability": "limited"
    },
    {
      "id": "workshop",
      "name": "Workshop add-on",
      "description": "Covers the 15 November workshop only. Price to be announced."
    }
  ]
}
```

Show every option with its name, description, price and availability:

| Ticket | Price to show | Availability to show |
| --- | --- | --- |
| Member | Free, with the description beside it | Available |
| Standard | PHP 750.00 | Limited |
| Workshop add-on | Price not published | Not published |

An amount of `"0"` explicitly means free admission for that option. An omitted price means the price is unknown. Omitted availability means unknown. Keep amounts as decimal strings and use decimal arithmetic if you format or compare them, not binary floating point. Sold out is a ticket state, not an event state ([Spec §5.2](/spec/#52-status)), so a `sold_out` ticket gets the label, not the whole event.

Preserve tier descriptions and source links, and let the participant choose. The spec says not to choose a ticket automatically for them.

What not to do:

- Do not show a headline such as "Free" or "From PHP 0". Consumers must not infer that the cheapest listed option is available to everyone; the free tier above is for members.
- Do not treat an omitted price as zero.
- Do not claim a ticket covers the full date range or every component of the event. A consumer must not infer which dates or components a ticket covers ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).
- Do not present an amount as the final payable total. Fees, taxes, discounts and eligibility may be described only in text.

## Unannounced and tentative venues

The document marks the venue as not yet announced and may still give a city or country:

```jsonc
{
  "location": {
    "type": "physical",
    "physical": {
      "status": "to_be_announced",
      "address": { "locality": "Quezon City", "country": "PH" }
    }
  }
}
```

Show that the venue is to be announced, with whatever area is known: "Venue to be announced, Quezon City, Philippines" ([Spec §6.2](/spec/#62-location)). `address.country` is an ISO 3166-1 alpha-2 code, so map it to a country name if you display one.

Show a named venue with `"status": "tentative"` as tentative, for example "Example Hall (tentative)". An omitted physical status means confirmed.

What not to do:

- Do not put a placeholder such as "TBA" or "Venue TBD" in the venue name slot. The document has no venue name in this case, and the spec forbids publishers from writing such placeholders into `name`. Your screen should not add one back.
- As a display recommendation, avoid geocoding the city and presenting the result as the venue's location. The spec allows city and country context with an unannounced venue but gives no venue coordinates, and it does not prescribe how to map them.

## Hybrid and virtual events

The document sets `location.type` to `virtual` or `hybrid`. A virtual location has a public `url` and optional `platform` and `instructions`; a hybrid location has both a physical and a virtual part ([Spec §6.2](/spec/#62-location)):

```jsonc
{
  "location": {
    "type": "hybrid",
    "physical": {
      "name": "Example Hall",
      "instructions": "In-person attendance on 14 November only."
    },
    "virtual": {
      "url": "https://example.org/events/devday/online",
      "platform": "Livestream",
      "instructions": "Sessions on 14 and 15 November are streamed."
    }
  }
}
```

Show both parts, each with its `instructions` text. The virtual `url` may be an access-information page rather than a join link, so a neutral label such as "Online access details" fits it better than "Join now".

What not to do:

- Do not say "In person and online, every day". A hybrid listing says that both modes exist somewhere in the event, not on every date ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). The limits are in the text fields, so show them.
- Do not label a physical event as online because its description mentions recordings. A recording alone does not make an event virtual or hybrid ([Spec §6.2](/spec/#62-location)).

## Show how fresh the data is

The document carries `updated_at`, the instant of the publisher's last material change. Your app separately knows when it last retrieved the document. Ticket availability is current only as of `updated_at` and is never an inventory guarantee ([Spec §7.2](/spec/#72-tickets)). The registration link stays authoritative at submission time, and a form can close without the JSON changing ([Spec §7.1](/spec/#71-registration)).

Wherever someone decides to attend or buy, show how fresh the information is ([Spec §10](/spec/#10-security-and-operational-requirements)). The spec says consumers should expose freshness and refresh before time-sensitive claims. Keep the two clocks apart:

```html
<p>Organizer last updated this listing on 29 October 2026.</p>
<p>Checked 2 hours ago.</p>
```

Your app should refresh before it shows a Register action or a "Limited" label prominently. If the last refresh failed, keep showing the last valid version with the time it was checked ([Spec §8.3](/spec/#83-redirects-caching-and-refresh)). How to schedule refreshes is covered in [Store and refresh events](/docs/store-and-refresh-events/).

What not to do:

- Do not say "Seats available now" or "Registration is open right now". OpenAjang does not guarantee live form availability.
- Do not show `updated_at` as "Last checked". It is when the publisher changed the event, not when you fetched it.

## Cancelled, postponed and rescheduled events

The document's `status` is one of `scheduled`, `postponed`, `rescheduled`, `cancelled` or `completed`, often with a `status_note` explaining it ([Spec §5.2](/spec/#52-status)). Use the status to choose a banner, how to show the dates, and whether to show actions:

| `status` | Banner | Dates | Registration and purchase actions |
| --- | --- | --- | --- |
| `scheduled` | None | As published | By registration state |
| `postponed` | "Postponed", plus `status_note` | Last scheduled start, labelled as no longer confirmed | Suppressed |
| `rescheduled` | "Rescheduled", plus `status_note` | New dates, with the earlier start from `previous_starts_at` | By registration state |
| `cancelled` | "Cancelled", plus `status_note` | Kept for reference | Suppressed |
| `completed` | None, or a past-event label | Kept for reference | Suppressed |

The spec requires suppressing registration and purchase encouragement for these three statuses ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). Informational ticket details, such as tier names, descriptions and prices, can remain visible as long as they carry no action to register or buy.

A postponed document keeps the last scheduled start, and consumers must not treat that start as confirmed attendance ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). Write it as "Was planned for 14 November 2026" rather than as the event date. For a rescheduled event, `previous_starts_at` keeps the earlier starts in the order the publisher moved them; show them as written and do not re-sort them.

A cancelled document stays a normal listing. The spec says consumers should retain it to inform people who saved the event, so keep the page reachable with the banner on top.

What not to do:

- Do not show a Cancelled banner because the document returned `410 Gone` or `404`. `410` is not evidence the event was cancelled, and `404` means currently unavailable ([Spec §8.3](/spec/#83-redirects-caching-and-refresh)).
- Do not show a Cancelled banner because the event dropped out of a directory feed. Omission from a feed means neither cancellation nor deletion ([Feeds §3](/feeds/#3-changes-cancellation-and-disappearance)).

## Source attribution

Provenance comes from where you retrieved the document. Control of a host establishes provenance of its assertions, not organizer identity ([Spec §2](/spec/#2-terminology)). `organizer` and `publisher` are claims made by the document.

Show the source host, the host of the Document URL your app retrieved. If the event reached you through a directory feed, show the directory as a separate line, because directory provenance is kept separate from source provenance ([Feeds §2](/feeds/#2-refresh-identity-and-source-provenance)):

```html
<p>Source: events.example.org</p>
<p>Found via directory.example.net</p>
```

Sometimes the document's `url` points to a page on another host and that page does not link back to the document, as with a direct JSON import or a link from a third-party feed. A direct document's claim to another site does not establish authority ([Spec §8.2](/spec/#82-html-discovery)), and a third-party feed's link or a copied ID does not prove organizer authority. Say that the link between the listing and the event page is unverified, for example "The link between this listing and example.org has not been verified." The same applies when HTML discovery reported a relationship warning. If you use `@openajang/resolver`, its provenance separates `documentUrl` from `declaredEventUrl` for this purpose.

What not to do:

- Do not show "Official" or "Verified" because a document passed validation. Validity is not inclusion, endorsement, organizer verification, or live inventory ([Spec §10](/spec/#10-security-and-operational-requirements)).
- Do not treat `organizer.name` or a matching `id` as proof of who published the event ([Spec §5.1](/spec/#51-identity)).

## Related

- [Store and refresh events](/docs/store-and-refresh-events/)
- [Resolve and import a URL](/docs/resolve-and-import-a-url/)
- [Directory feeds](/docs/directory-feeds/)
