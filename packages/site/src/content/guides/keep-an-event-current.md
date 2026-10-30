---
title: Keep an event current
description: Update a published OpenAjang event when the page moves, the date changes, the event is cancelled, or tickets sell out, without breaking saved copies.
section: organizers
order: 2
---

This page is for organizers who already have a published event document and need to change it. After reading it you will know which fields to edit for each kind of change, when to advance `updated_at`, and how to signal a cancellation or a removal. If you have not published an event yet, start with [Publish your first event](/docs/publish-your-first-event/).

## Why identity stays stable

Apps and directories that saved your event track it by its Effective Event ID: the `id` field if you set one, otherwise `url` ([Spec §2](/spec/#2-terminology)). When you edit the document, they use that ID to decide that the new version is the same event as the one they already hold, not a second event.

The spec requires an ID to identify one occurrence or overall edition, to survive postponement, rescheduling, venue changes, cancellation, completion and migrations, and never to be reused ([Spec §5.1](/spec/#51-identity)). Two consequences follow for you:

- If you leave `id` out, `url` is the identity, so the event page address must never change.
- If you set `id`, `url` is free to change later, because the identity no longer depends on it. The spec recommends an explicit `id` when `url` is a homepage that may change editions, a mutable slug, or a third-party page that may move.

A title, date or venue is not an identity. Apps do not match events on those, so editing them never creates a new event.

## Move the event page

If you published without an `id` and the event page is moving, add an `id` whose value is the previous `url`, then put the new address in `url`. Do not generate a fresh UUID: a new ID reads as a different event, and everyone who saved the old one stops receiving your updates ([Spec §5.1](/spec/#51-identity)).

```jsonc
// Before: no id, so the Effective Event ID is the url
{
  "url": "https://example.org/events/build-night-2026"
}

// After: id keeps the old identity, url points to the new page
{
  "id": "https://example.org/events/build-night-2026",
  "url": "https://example.org/community/build-night"
}
```

Fresh IDs are for new occurrences. A new annual edition gets a new ID even if you reuse the same homepage; see [Recurring, annual and multi-day events](/docs/recurring-annual-and-multi-day-events/).

If the new page is on a different host, the spec says the transfer should be confirmed by a redirect or a changed representation controlled by the previous source. Matching IDs alone are not enough for an app to follow the move ([Spec §5.1](/spec/#51-identity)). A redirect from the old address is the usual way to do that.

## When updated_at must advance

`updated_at` records when the event information last changed in a way that matters to someone reading it. The spec sets two rules ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)):

- A material change must advance it. Material changes include dates, venue, lifecycle status, registration, ticket prices and availability.
- Unchanged fetches and rebuilds must not advance it. If your site generator rewrites the file on every build, make sure it keeps the old `updated_at` until the event data actually changes.

A contract-only migration that preserves the meaning of the event need not advance it. HTTP validators such as `ETag` and the time an app last fetched your file are separate clocks. They do not replace `updated_at`, and using them does not excuse you from advancing it ([Spec §8.3](/spec/#83-redirects-caching-and-refresh)). An app that fetches a changed document whose `updated_at` did not move can flag it as a publisher quality problem.

```jsonc
// A venue change, a price change, or a cancellation each need a newer value
{
  "updated_at": "2026-10-30T08:00:00Z"
}
```

Announcing a clock time on a date that did not change, or correcting how a value is written without changing the instant, is an information update and not automatically a reschedule ([Spec §4.3](/spec/#43-precision-changes)). The rule for `updated_at` still applies: advance it when the change is material.

## Postponed or rescheduled

Use `postponed` when the event will not happen at the published time and you do not have a replacement yet. Use `rescheduled` once the new time is confirmed ([Spec §5.2](/spec/#52-status)).

When you postpone, keep the last scheduled `starts_at`, and you should explain the uncertainty in `status_note`. Apps will not treat that start as confirmed attendance ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).

```jsonc
{
  "status": "postponed",
  "status_note": "The hall is closed for repairs. A new date will be announced.",
  "starts_at": "2026-11-14T18:00:00+08:00",
  "updated_at": "2026-10-30T08:00:00Z"
}
```

When the new time is confirmed, change `status` to `rescheduled`, write the new `starts_at` and `ends_at`, and add the replaced start to `previous_starts_at`. The array is required and must be nonempty when the status is `rescheduled`. The spec requires at least the immediately previous start, and recommends keeping all earlier starts in the order the changes happened. Do not repeat an entry, and do not list the current start in it. Keep each value in the form you first published it ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation), [Spec §3.2](/spec/#32-core-properties)).

```jsonc
{
  "status": "rescheduled",
  "starts_at": "2026-12-05T18:00:00+08:00",
  "ends_at": "2026-12-05T21:00:00+08:00",
  "previous_starts_at": ["2026-11-14T18:00:00+08:00"],
  "updated_at": "2026-11-05T08:00:00Z"
}
```

If the event moves a second time, you should append the start you are replacing to the end of the array, so the full history stays in order. Do not sort the array by date, because the order records the sequence of moves.

You do not need to delete `registration` or `tickets` while an event is postponed or cancelled. The spec tells apps to suppress registration and purchase prompts while an event is cancelled, postponed or completed, even if those fields remain ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).

## Cancelled or removed

A cancelled event and a removed document are different signals.

| What happened | What to serve |
| --- | --- |
| The event will not take place | Keep the document live. It should stay a `200 OK` response with `status: "cancelled"` and a newer `updated_at`. |
| You deliberately removed the document | It should return `410 Gone`. |
| The document is currently unavailable | A `404` says that, and nothing more. |

For a cancellation, the spec says the document should stay a `200 OK` response with `status: "cancelled"`, so that people who saved the event can see what happened. A cancelled document is not a deletion ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).

```jsonc
{
  "status": "cancelled",
  "status_note": "The venue could not be secured. Registrants will be emailed.",
  "updated_at": "2026-11-25T08:00:00Z"
}
```

For an intentional removal, the spec says the endpoint should return `410 Gone`. Apps that receive a `410` apply their own removal policy, and the spec states plainly that it is not evidence the event was cancelled ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation), [Spec §8.3](/spec/#83-redirects-caching-and-refresh)). If people should learn that the event is off, publish the cancelled document and do not remove it.

## Sold out is not an event status

Do not change `status` when tickets run out. The event is still `scheduled` (or `rescheduled`). The spec says sold out is a ticket state, not an event state ([Spec §5.2](/spec/#52-status)). Record it where the sales state lives, then advance `updated_at`:

- Set the ticket's `availability` to `sold_out` ([Spec §7.2](/spec/#72-tickets)).
- If you run a waiting list or have shut registration, set `registration.status` to `waitlist` or `closed` ([Spec §7.1](/spec/#71-registration)).

```jsonc
{
  "registration": { "status": "waitlist" },
  "tickets": [
    { "id": "general", "name": "General admission", "availability": "sold_out" }
  ],
  "updated_at": "2026-11-20T08:00:00Z"
}
```

Availability is only current as of `updated_at`, so it is a snapshot and not an inventory guarantee. The registration link stays the authority at the moment someone submits, and a form can close without your JSON changing.

## A complete document after a move, a reschedule and a sellout

This document combines three of the changes above: the event page moved (so `id` holds the old `url`), the event was rescheduled, and tickets sold out afterward. Its `updated_at` is the latest of the revisions shown, because the sellout was the last material change. It passes the [validator](/validator/).

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "id": "https://example.org/events/build-night-2026",
  "url": "https://example.org/community/build-night",
  "title": "Community Build Night",
  "status": "rescheduled",
  "status_note": "Moved to a later date because the hall is closed for repairs.",
  "starts_at": "2026-12-05T18:00:00+08:00",
  "ends_at": "2026-12-05T21:00:00+08:00",
  "previous_starts_at": ["2026-11-14T18:00:00+08:00"],
  "organizer": { "name": "Example Community" },
  "location": {
    "type": "physical",
    "physical": { "name": "Community Hall" }
  },
  "registration": {
    "required": true,
    "status": "waitlist",
    "url": "https://example.org/community/build-night/register"
  },
  "tickets": [
    {
      "id": "general",
      "name": "General admission",
      "availability": "sold_out",
      "price": { "amount": "0", "currency": "PHP" }
    }
  ],
  "updated_at": "2026-11-20T08:00:00Z"
}
```

## Next

- [Recurring, annual and multi-day events](/docs/recurring-annual-and-multi-day-events/) covers when a new edition needs a new `id`.
- [Publish your first event](/docs/publish-your-first-event/) covers writing, hosting and checking the document.
- [Spec §5](/spec/#5-identity-and-lifecycle) has the full identity and lifecycle rules.
