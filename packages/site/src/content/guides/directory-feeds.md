---
title: Follow or run a directory feed
description: How an app follows an OpenAjang Atom directory feed safely, and what a directory puts in each entry, how entries change, and how long they stay.
section: apps
order: 4
---

An OpenAjang directory collects event links into an Atom feed so calendar apps and readers can discover events in bulk. Feed entries distribute links to publisher-hosted event documents; they do not replace the documents themselves or require organizers to maintain feeds ([FEEDS.md](/feeds/)).

Whether you are subscribing to a directory feed or publishing one, you keep the feed layer and the event documents separate.

The example feeds in the repository, `examples/directory.atom` and `examples/directory.rss`, use `example.org` placeholder URLs for their document links. They are not live endpoints, so you cannot subscribe to them ([§4 Example](/feeds/#4-example)).

## Following a feed

A feed entry points at a publisher-hosted event document. Your app fetches the feed with ordinary HTTP, including conditional requests, and may show the entry summaries right away. An OpenAjang-aware app then resolves each entry's typed JSON link and validates the document it gets back ([§2 Refresh, identity, and source provenance](/feeds/#2-refresh-identity-and-source-provenance)).

Apply the same network safety checks to links taken from a feed as you would to any other fetched URL. Relative links in a feed follow Atom and XML Base rules, which differ from the restricted HTML discovery rules in the core spec. Do not execute XML external entities or fetch external DTDs ([§1 Feed contract](/feeds/#1-feed-contract), [spec §10](/spec/#10-security-and-operational-requirements)). The resolver side of this is covered in [Resolve and import a URL](/docs/resolve-and-import-a-url/).

### Check that the entry id matches the document

The document's [effective Event ID](/spec/#2-terminology) is its `id` if it has one, otherwise its `url`. After you fetch and validate the linked document, its effective Event ID must exactly equal the entry's Atom `id`. If they differ, that is a profile error. Do not attach the document to the saved event as an update ([§2](/feeds/#2-refresh-identity-and-source-provenance), [spec §8.3](/spec/#83-redirects-caching-and-refresh)).

### Keep directory provenance separate

Record that an event reached you through this directory, and record separately where the document was retrieved from. A directory's link, or an ID copied into its feed, does not prove the organizer authorized the listing. If the Event URL does not establish the document link, report the authority as unverified according to your own policy. A conflicting source must not silently overwrite an event you already know ([§2](/feeds/#2-refresh-identity-and-source-provenance), [spec §5.1](/spec/#51-identity)).

### Take structured facts from the document

The summary is plain text written for readers and for ordinary feed readers. Dates, attendance and registration come from the validated document. Do not parse them out of the summary, and do not show the summary in place of the document's fields ([§1](/feeds/#1-feed-contract), [§2](/feeds/#2-refresh-identity-and-source-provenance)).

### Treat a missing entry as unknown

A feed is a bounded discovery list. It is not a complete snapshot of the directory and not a lossless change log. An event that disappears from the feed has not been cancelled or deleted ([§3 Changes, cancellation, and disappearance](/feeds/#3-changes-cancellation-and-disappearance)). Keep the saved event and keep refreshing its Document URL directly.

The profile says a consumer should refresh saved events directly, independent of whether the event is still in the feed. The core spec says the same ([§2](/feeds/#2-refresh-identity-and-source-provenance), [spec §8.3](/spec/#83-redirects-caching-and-refresh)). The reason is practical: a bounded feed can drop an entry before the app ever sees it marked cancelled. An app that only reads the feed must not promise reliable cancellation delivery for saved events. The refresh outcomes for a stored Document URL are in [Store and refresh events](/docs/store-and-refresh-events/).

### Keep three clocks apart

Three timestamps can look alike and measure different things.

| Timestamp | What it records | Set by |
| --- | --- | --- |
| Atom entry `updated` | The directory's significant modification of that entry | The directory |
| Document `updated_at` | The organizer's material change to the event | The organizer |
| Retrieval time | When your app last fetched the document | Your app |

Entry `updated` is not a copy of `updated_at`, not a retrieval timestamp, and not a clock for resolving conflicts between sources ([§1](/feeds/#1-feed-contract), [spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). Keep each in its own field.

## Running a feed

A directory that claims this profile must follow its requirements and RFC 4287. The profile says a service should offer Atom for interoperable OpenAjang subscriptions, and may offer RSS or another interface as well. No new XML vocabulary and no JSON wrapper is introduced ([FEEDS.md](/feeds/)).

### The feed itself

Serve UTF-8 Atom as `application/atom+xml`. Include:

- a permanent feed `id`
- a `title`
- `updated`
- a feed `author` that identifies your service
- a `self` link
- a human-facing HTML `alternate` link, when you have one

The feed author does not claim that your service organized the events. Feed `updated` tracks significant changes to the feed, including entries changing or being removed. It must not advance when you rebuild the feed and nothing changed. You should emit absolute links ([§1 Feed contract](/feeds/#1-feed-contract)).

### What each entry contains

Each entry describes one event and must include:

- an `id` equal to the document's effective Event ID, kept the same across revisions
- a `title`
- a plain-text `summary` that is useful without OpenAjang support
- `updated`, the instant of your significant modification of the entry
- exactly one distinct `alternate` link of type `application/vnd.openajang+json`, pointing to a direct JSON Document URL
- an `alternate` link of type `text/html` to the canonical human-facing Event URL

Repeating the same JSON link counts as one candidate. Two different JSON link targets are ambiguous, and consumers must not guess between them. The typed JSON link may return the core's `application/json` fallback, and the core's provisional media-type status applies ([§1](/feeds/#1-feed-contract)).

An illustrative entry for a fictional event:

```xml
<entry>
  <id>https://events.example.org/community-meetup-nov-2026</id>
  <title>Example Community Meetup, November 2026</title>
  <published>2026-10-01T09:00:00Z</published>
  <updated>2026-10-01T09:00:00Z</updated>
  <link rel="alternate" type="text/html" href="https://events.example.org/community-meetup-nov-2026" />
  <link rel="alternate" type="application/vnd.openajang+json" href="https://events.example.org/community-meetup-nov-2026.openajang.json" />
  <summary type="text">2026-11-12, 18:30 to 21:00 (Asia/Manila). In person at Example Hall. Registration is open.</summary>
</entry>
```

### What the summary says

The summary should include the event date, the timezone where it matters, the place or attendance mode, the registration situation, and any cancellation or postponement. Take these facts from the validated document. The summary does not stand in for the document's structured fields ([§1](/feeds/#1-feed-contract)).

If your directory edits a title or summary, that edit must not be written back to the organizer's event without the organizer's authorization ([§1](/feeds/#1-feed-contract)).

`published`, when you include it, is when your service first published the entry. It is not the event start ([§1](/feeds/#1-feed-contract)).

### When entry `updated` changes

Entry `updated` changes when your service incorporates a material event revision, or when you make a significant editorial change. It is not a copy of the organizer's `updated_at` and not a retrieval timestamp. Keep the organizer's timestamp in the event document. An event update keeps the entry `id` and advances entry `updated` ([§1](/feeds/#1-feed-contract), [§3](/feeds/#3-changes-cancellation-and-disappearance)).

Before you claim a new change at a source, refresh that source under your own documented freshness policy ([§2](/feeds/#2-refresh-identity-and-source-provenance)).

### Cancellation is an update

Treat a cancellation as an ordinary entry update: keep the `id`, advance `updated`, keep the entry in the feed where practical, label the cancellation visibly, and link to the cancelled JSON document. A feed tombstone must not represent cancellation ([§3](/feeds/#3-changes-cancellation-and-disappearance)). Organizers should keep serving a `200 OK` document with `status: "cancelled"` ([spec §5.3](/spec/#53-updates-postponement-rescheduling-cancellation)), described in [Keep an event current](/docs/keep-an-event-current/).

```xml
<entry>
  <id>https://events.example.org/community-meetup-nov-2026</id>
  <title>Cancelled: Example Community Meetup, November 2026</title>
  <published>2026-10-01T09:00:00Z</published>
  <updated>2026-11-03T14:20:00Z</updated>
  <link rel="alternate" type="text/html" href="https://events.example.org/community-meetup-nov-2026" />
  <link rel="alternate" type="application/vnd.openajang+json" href="https://events.example.org/community-meetup-nov-2026.openajang.json" />
  <summary type="text">Cancelled. Was planned for 2026-11-12 in person at Example Hall. Registration is closed.</summary>
</entry>
```

### Feed size and retention

Your feed is a bounded discovery list, not a full snapshot, so omission from it means neither cancellation nor deletion. You should order entries by most recent significant update, keep recently changed and cancelled entries available long enough for the polling audience you intend to serve, and document the feed size and retention period. No finite retention guarantees that a consumer who was away for longer than that period will see a change ([§3](/feeds/#3-changes-cancellation-and-disappearance)).

The profile defers two optional capabilities: RFC 6721 tombstones and RFC 5005 paging and archives. If you adopt tombstones later, a tombstone only removes your directory's entry. It does not set the organizer's event status and does not authorize anyone to delete copies from other sources ([§3](/feeds/#3-changes-cancellation-and-disappearance)).

### An RSS alternative

The profile describes an RSS 2.0 form as informative. Use a stable `guid` with `isPermaLink="false"` equal to the Event ID, a human `<link>`, a useful `<description>`, and an Atom-namespaced typed JSON `atom:link` in each item. This is an OpenAjang convention, and ordinary RSS readers are not guaranteed to treat it any particular way. `pubDate` records publication, not the event start, and `lastBuildDate` tracks channel changes, not per-item modification. Do not rewrite `pubDate` on every edit, and do not create a new GUID to force a notification ([§5 RSS alternative](/feeds/#5-rss-alternative-informative)).

## Atom Service checklist

Atom Service is one of the optional companion capabilities, reported separately from the core roles ([spec §9](/spec/#9-extensions-versions-and-conformance)). The Atom profile is normative only for services that explicitly claim it ([spec §11](/spec/#11-references-and-companion-status)). The items below restate the profile's requirements, except those marked as recommended, which the profile words as "should".

| Check | Source |
| --- | --- |
| Feed is UTF-8 Atom served as `application/atom+xml`, with permanent `id`, `title`, `updated`, service `author` and `self` link | [§1](/feeds/#1-feed-contract) |
| Feed `updated` does not advance on unchanged rebuilds | [§1](/feeds/#1-feed-contract) |
| Every entry `id` equals the effective Event ID and stays the same across revisions | [§1](/feeds/#1-feed-contract) |
| Every entry has a title, a plain-text summary, `updated`, one typed JSON `alternate` link and a `text/html` `alternate` link | [§1](/feeds/#1-feed-contract) |
| Summary facts come from the validated document, and directory edits are not written back without authorization | [§1](/feeds/#1-feed-contract) |
| Sources are refreshed under a documented freshness policy before a new change is claimed | [§2](/feeds/#2-refresh-identity-and-source-provenance) |
| Event updates keep the entry `id` and advance entry `updated` | [§3](/feeds/#3-changes-cancellation-and-disappearance) |
| Cancellation is an update with a visible label and a link to the cancelled JSON, and no tombstone stands for it | [§3](/feeds/#3-changes-cancellation-and-disappearance) |
| Recommended: entries are ordered by most recent significant update | [§3](/feeds/#3-changes-cancellation-and-disappearance) |
| Recommended: recently changed and cancelled entries stay available long enough for the intended polling audience | [§3](/feeds/#3-changes-cancellation-and-disappearance) |
| Recommended: feed size and retention are documented | [§3](/feeds/#3-changes-cancellation-and-disappearance) |

## Next

- [Store and refresh events](/docs/store-and-refresh-events/)
- [Resolve and import a URL](/docs/resolve-and-import-a-url/)
- [Reference](/docs/reference/)
