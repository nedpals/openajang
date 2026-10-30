---
title: Recurring, annual, and multi-day events
description: Publish monthly meetups, yearly conferences, multi-day events, and exhibitions with one document per occurrence or edition.
section: organizers
order: 3
---

Events that repeat monthly, return every year, or span several days follow a consistent rule in OpenAjang: each document describes one concrete occurrence or one overall edition ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).

Publishers produce individual documents for each date or edition rather than relying on complex recurrence rules, keeping event identity clear and calendar synchronizations reliable.

## What one document describes

Each OpenAjang document describes one event occurrence, such as a single meetup night, or one overall edition, such as a whole three-day conference or a four-month exhibition ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).

What the format supports:

- One document per meeting of a repeating event, each with its own identity.
- One overall document for a multi-day edition. Its dates are the outer envelope of the edition. They do not claim that something happens every day or around the clock ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).
- A `series` object that groups related listings under one identifier. It does not generate dates, and it does not say that a ticket for one listing admits you to another ([Spec §6.3](/spec/#63-other-fields)).

What it leaves out:

- Repeat rules ("every second Thursday") that expand into dates, weekly opening hours, exceptions to those hours, and session-by-session programs are outside the core ([Spec §1](/spec/#1-purpose-and-scope), [§4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)). The top-level `schedule` property is reserved and must be absent ([Spec §3](/spec/#3-document-and-authoring-rules)). Describe hours and daily schedules in `description` or `instructions` instead.

In practice, you or the tool you publish with write a document for each meeting or edition. OpenAjang does not include a tool that turns a repeat rule into documents. You can copy last month's file and change the fields for the next meeting, as the first example shows.

## A monthly meetup

Publish each meeting as its own document at its own address, and give every one the same `series.id` so apps know they belong together.

Here is the January meeting of an invented community group. Each meeting has its own permanent page, so the page address in `url` is the meeting's identity and `id` is left out ([Spec §5.1](/spec/#51-identity)). If your meeting pages might be renamed or reused, add an `id` as the annual conference example below does.

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "url": "https://example.org/riverside-python/meetups/2027-01",
  "title": "Riverside Python Meetup: January 2027",
  "summary": "Two short talks and open project time.",
  "status": "scheduled",
  "starts_at": "2027-01-14T18:30:00+08:00",
  "ends_at": "2027-01-14T21:00:00+08:00",
  "time_zone": "Asia/Manila",
  "organizer": {
    "name": "Riverside Python Community",
    "url": "https://example.org/riverside-python/"
  },
  "location": {
    "type": "physical",
    "physical": {
      "name": "Riverside Public Library, Room 2"
    }
  },
  "registration": {
    "required": false,
    "instructions": "Walk-ins are welcome. No sign-up needed."
  },
  "series": {
    "id": "https://example.org/riverside-python/meetups/",
    "title": "Riverside Python Meetup",
    "url": "https://example.org/riverside-python/meetups/"
  },
  "updated_at": "2026-12-20T09:00:00Z"
}
```

For February, copy the file and change only what is different about that meeting. This fragment shows the fields that changed; everything else, including `series`, stays the same:

```jsonc
{
  // A new page and a new document address for this meeting
  "url": "https://example.org/riverside-python/meetups/2027-02",
  "title": "Riverside Python Meetup: February 2027",
  "starts_at": "2027-02-11T18:30:00+08:00",
  "ends_at": "2027-02-11T21:00:00+08:00",
  // A new document, so this is when its event data was last materially changed;
  // later rebuilds that change nothing leave it alone
  "updated_at": "2027-01-18T09:00:00Z",
  // Unchanged: same series, so apps can group the meetings
  "series": {
    "id": "https://example.org/riverside-python/meetups/",
    "title": "Riverside Python Meetup",
    "url": "https://example.org/riverside-python/meetups/"
  }
}
```

A few things to keep in mind:

- Each meeting keeps its own lifecycle. If the February meeting is cancelled or moved, you change only February's document and advance its `updated_at` ([Spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). The other meetings are untouched. [Keep an event current](/docs/keep-an-event-current/) covers those changes.
- Put the discovery link on each meeting's own page. Resolvers only look at links in the page head that have `rel="alternate"` and the OpenAjang media type (`application/vnd.openajang+json`). They resolve and normalize those links' addresses, drop duplicates, and report an ambiguity error if more than one distinct target remains. For example, a group page whose head links to both the January and February documents cannot be resolved. Ordinary links in the page body do not count ([Spec §8.2](/spec/#82-html-discovery)).
- Pick a `series.id` once and keep it. It must be an absolute URI ([Spec §6.3](/spec/#63-other-fields)). The group's meetup listing page is a natural choice.

## An annual conference that reuses its homepage

Give each year's edition its own permanent `id`, even when every edition uses the same homepage as `url`.

Future annual editions must get new IDs, even if the homepage is reused, and an explicit `id` is recommended whenever `url` is a homepage that changes from edition to edition ([Spec §5.1](/spec/#51-identity)). Without one, the effective identity of each edition is the homepage URL, so apps would treat next year's document as an update to last year's event and overwrite it as if it had been rescheduled.

Here is how two editions of an invented conference differ. Both share `url` and `series`; the `id` is what tells them apart:

```jsonc
// 2026 edition, served at https://example.org/conf/2026.openajang.json
{
  "id": "https://example.org/conf/2026",
  "url": "https://example.org/conf/",
  "title": "Example Conf 2026",
  "starts_at": "2026-03-19T09:00:00+08:00",
  "series": { "id": "https://example.org/conf/", "title": "Example Conf" }
}

// 2027 edition, served at https://example.org/conf/2027.openajang.json
{
  "id": "https://example.org/conf/2027",
  "url": "https://example.org/conf/",
  "title": "Example Conf 2027",
  "starts_at": "2027-03-18T09:00:00+08:00",
  "series": { "id": "https://example.org/conf/", "title": "Example Conf" }
}
```

The `id` can be a year-specific URI in a namespace you control, as here, or a UUID URN you generate once (`urn:uuid:...`). Either way, never reuse it ([Spec §5.1](/spec/#51-identity)).

When you announce the new edition:

- Point the homepage's discovery link at the new edition's document, and keep only one such link in the page head ([Spec §8.2](/spec/#82-html-discovery)).
- Keep last year's document at its own address. Apps that saved it should keep refreshing it there directly, and if they rediscover from the homepage, they should not switch to a document with a different ID ([Spec §8.3](/spec/#83-redirects-caching-and-refresh)). You can set its `status` to `completed`, though past events may also stay `scheduled` ([Spec §5.2](/spec/#52-status)).
- If last year's document had no `id`, its identity is already the homepage URL. Leave it, or add an `id` set to that same URL, never a fresh UUID ([Spec §5.1](/spec/#51-identity)). The fresh `id` goes on the new edition.

## A multi-day conference or exhibition

Publish one overall document whose start and end bracket the whole edition, and describe the actual hours in text.

The date range is the edition's outer calendar envelope. It does not assert continuous activity or activity on every date ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). Readers learn the real hours from your `description` or location `instructions`, so state them there plainly.

### A conference with known times

If you know the start of the first day and the end of the last, use timed values. Example Conf 2027 runs talks on two days and workshops on a third. The `starts_at` and `ends_at` values span all three days, and the description says when things actually happen:

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "id": "https://example.org/conf/2027",
  "url": "https://example.org/conf/",
  "title": "Example Conf 2027",
  "summary": "Two days of talks and one day of hands-on workshops.",
  "description": "Talks run on 18 and 19 March from 09:00 to 17:30. Workshops run on 20 March from 09:00 to 16:00 and need a workshop day ticket. The venue is closed in the evenings.",
  "status": "scheduled",
  "starts_at": "2027-03-18T09:00:00+08:00",
  "ends_at": "2027-03-20T16:00:00+08:00",
  "time_zone": "Asia/Manila",
  "organizer": {
    "name": "Example Conf Organizing Team",
    "url": "https://example.org/conf/"
  },
  "location": {
    "type": "physical",
    "physical": {
      "name": "Example Convention Center",
      "address": {
        "locality": "Example City",
        "country": "PH"
      }
    }
  },
  "registration": {
    "required": true,
    "status": "open",
    "url": "https://example.org/conf/tickets"
  },
  "tickets": [
    {
      "id": "conference-pass",
      "name": "Conference pass",
      "description": "Talks on 18 and 19 March. Does not include the workshop day.",
      "url": "https://example.org/conf/tickets",
      "price": { "amount": "4500.00", "currency": "PHP" },
      "availability": "available"
    },
    {
      "id": "workshop-day",
      "name": "Workshop day",
      "description": "Workshops on 20 March only. You choose one morning and one afternoon workshop after you register.",
      "url": "https://example.org/conf/tickets",
      "price": { "amount": "2500.00", "currency": "PHP" },
      "availability": "limited"
    }
  ],
  "series": {
    "id": "https://example.org/conf/",
    "title": "Example Conf",
    "url": "https://example.org/conf/"
  },
  "updated_at": "2026-10-29T08:00:00Z"
}
```

### An exhibition with visiting hours

If the hours vary by weekday, or you do not want to commit to clock times, use calendar dates. With dates, `ends_at` is the inclusive last day, and the dates do not imply midnight, all-day access, or opening every day ([Spec §4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)). Apps should tell readers that exact hours are not published, which is your cue to put them in text:

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "id": "urn:uuid:53c9f145-559a-4543-8e30-dc578f015360",
  "url": "https://example.org/museum/exhibitions/river-maps",
  "title": "River Maps: Two Centuries of Charting",
  "summary": "Hand-drawn and printed maps of the river and its towns, from the city archive.",
  "description": "Open Tuesday to Sunday, 10:00 to 18:00, last entry at 17:30. Closed on Mondays and on 9 April.",
  "status": "scheduled",
  "starts_at": "2027-02-06",
  "ends_at": "2027-05-30",
  "time_zone": "Asia/Manila",
  "organizer": {
    "name": "Example City Museum",
    "url": "https://example.org/museum/"
  },
  "location": {
    "type": "physical",
    "physical": {
      "name": "Example City Museum, East Gallery",
      "instructions": "Enter through the main museum lobby. The East Gallery is on the second floor."
    }
  },
  "registration": {
    "required": false,
    "instructions": "No booking needed. Buy tickets at the museum entrance."
  },
  "tickets": [
    {
      "id": "general-admission",
      "name": "General admission",
      "description": "Museum entry on any one open day, including this exhibition.",
      "price": { "amount": "200", "currency": "PHP" }
    }
  ],
  "updated_at": "2026-10-29T08:00:00Z"
}
```

Mixed precision is invalid: if `starts_at` is a date, `ends_at` must be a date too ([Spec §4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)). A calendar exporter must not silently turn unknown hours into an all-day block ([Spec §4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)).

## Workshops and side events inside a larger edition

Decide, for each workshop, hackathon, or side event, whether people should be able to import it on its own. That choice decides how you publish it ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)).

### As ticket options on the overall listing

If the workshops are part of the conference and nobody needs to save one by itself, list them as ticket options on the overall document, as the `workshop-day` ticket above does. Say in each ticket's `description` which days or parts it covers. Apps must not infer which dates or components a ticket covers, or assume a ticket covers the whole date envelope ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation), [§7.2](/spec/#72-tickets)), so the text is the only place that information lives.

### As separate documents

If you want a workshop to be importable as its own event, publish a separate document with its own `id`. Its tickets must describe that workshop ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)):

```jsonc
{
  "id": "https://example.org/conf/2027/workshops/testing-web-apps",
  "url": "https://example.org/conf/workshops/testing-web-apps",
  "title": "Testing Web Apps: an Example Conf 2027 workshop",
  "description": "A three-hour hands-on workshop on the Example Conf workshop day. Bring a laptop.",
  "starts_at": "2027-03-20T09:00:00+08:00",
  "ends_at": "2027-03-20T12:00:00+08:00",
  "tickets": [
    {
      "id": "testing-web-apps-seat",
      "name": "Workshop seat",
      "description": "This workshop only, 20 March, 09:00 to 12:00. Does not include the conference talks.",
      "price": { "amount": "1200.00", "currency": "PHP" }
    }
  ],
  // Optional: groups it with the conference listings
  "series": { "id": "https://example.org/conf/", "title": "Example Conf" }
}
```

The workshop and the overall conference listing overlap in time. That does not make them duplicates ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). Sharing a `series` does not say that a conference pass admits you to the workshop, and it does not make the workshop a child of the conference ([Spec §6.3](/spec/#63-other-fields)). If those relationships matter to attendees, write them in the text, as the ticket description above does.

You can do both: keep a plain-text workshop day ticket on the overall listing and publish the individual workshops as separate documents.

## Hybrid events and recordings

Set `location.type` to `hybrid` when people can attend in person and remotely somewhere in the event, and say in text which parts offer which mode.

A hybrid listing means both modes exist somewhere in the event. It does not claim that both modes are available on every date ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). For workshops and tickets, the coverage rules from the previous section apply. Apps must not infer which dates or components a ticket covers, so say in each ticket's description which parts it includes and whether they can be joined remotely. A workshop can also be published as a separate document, with its own `location` and tickets that describe that workshop ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). A hybrid location needs both a `physical` and a `virtual` object ([Spec §6.2](/spec/#62-location)). If Example Conf streamed its talks but kept workshops in person, the location might look like this:

```jsonc
{
  "location": {
    "type": "hybrid",
    "physical": {
      "name": "Example Convention Center",
      "instructions": "Workshops on 20 March are in person only."
    },
    "virtual": {
      "url": "https://example.org/conf/stream",
      "platform": "Example Stream",
      "instructions": "Talks on 18 and 19 March are streamed live. The workshops are not streamed."
    }
  }
}
```

Publishers must put important limits like these in core descriptions or instructions, even if an extension adds more structure ([Spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). The virtual `url` must be public: it can be a page that explains how to join, but never a private join link, password, or personalized link ([Spec §6.2](/spec/#62-location)).

Recordings are a different case. An in-person event that posts recordings afterward stays `physical`, because a recording alone does not make an event virtual or hybrid ([Spec §6.2](/spec/#62-location)). Mention the recordings in `description`, for example "Talk recordings are posted at https://example.org/conf/videos within two weeks." Use `hybrid` only when live remote participation is part of the event.

## Next

- [Keep an event current](/docs/keep-an-event-current/): postponing, rescheduling, or cancelling one meeting or edition.
- [Publish your first event](/docs/publish-your-first-event/): hosting each document and adding the discovery link.
- [Extensions](/docs/extensions/): adding structure on top of the core text without changing what it says.
