# OpenAjang Atom Feed Profile

**Status:** Optional companion Working Draft.

This profile distributes event links. It does not replace the core document or
require organizers to publish feeds. A service SHOULD offer Atom for interoperable
OpenAjang subscriptions; RSS or another interface MAY be offered additionally.
A service claiming this profile MUST follow the requirements here and RFC 4287.
No new XML vocabulary or event-JSON wrapper is introduced.

## 1. Feed contract

Serve UTF-8 Atom as `application/atom+xml`. Include a permanent feed `id`, `title`,
`updated`, feed `author` identifying the service, and a `self` link. The feed author
is not an assertion that the service organized the events. Include a human HTML
alternate link when available. Feed `updated` tracks significant feed changes,
including entry changes or removals; it MUST NOT advance on unchanged rebuilds.

Each entry describes one event and MUST include:

- `id` equal to the effective OpenAjang Event ID; preserve it across revisions;
- `title` and a plain-text `summary` useful without OpenAjang support;
- `updated`, the directory's significant entry-modification instant;
- exactly one distinct `alternate` link with type
  `application/vnd.openajang+json` to a direct JSON Document URL;
- an `alternate` `text/html` link to the canonical human-facing Event URL.

Repeated identical JSON links are one candidate. Different JSON link targets are
ambiguous and MUST NOT be guessed between. Typed JSON links MAY return the core's
`application/json` fallback. The core's provisional media-type status applies.

The entry summary SHOULD include the event date, timezone where relevant, place
or attendance mode, registration situation, and any cancellation or postponement.
Event information comes from the validated document. Summary text is not a
substitute for structured facts. A title or summary edited by the directory MUST
NOT be written back to the organizer's event without authorization.

`published`, when present, is when this service first published the entry. It is
not the event start. Entry `updated` changes when the service incorporates a
material event revision or makes a significant editorial change. It is not a copy
of organizer `updated_at`, not a retrieval timestamp, and not a global conflict
resolution clock. Keep the organizer timestamp in the event document.

Relative Atom links, if consumed, follow RFC 4287/XML Base rules; this differs
from the deliberately restricted HTML discovery rules in the core. Producers
SHOULD emit absolute links. Consumers MUST apply network safety checks to resolved
feed links. Do not execute XML external entities or fetch external DTDs.

## 2. Refresh, identity, and source provenance

Consumers fetch and conditionally refresh the feed using HTTP. They may display
its summaries immediately. An OpenAjang-aware consumer resolves the typed JSON
link, validates it, and MUST verify that its effective Event ID exactly equals
the entry ID. An ID mismatch is a profile error; do not attach it as an update.
The event document, not the summary, supplies structured attendance and registration.

A third-party feed's link or a copied ID does not prove organizer authority.
Retain directory provenance separately from source provenance. If a document link
is not established by the Event URL, report its authority as unverified according
to consumer policy. A conflicting source MUST NOT silently overwrite a known event.

A directory MUST refresh a source according to its own documented freshness policy
before claiming a new source change. A consumer SHOULD refresh saved events directly
independently of future feed membership. A consumer that only reads this feed must
not promise reliable saved-event cancellation delivery: bounded feeds can drop items.

## 3. Changes, cancellation, and disappearance

An event update keeps the entry ID and advances entry `updated`. Cancellation is
an update: retain the entry where practical, visibly label cancellation, and link
to the cancelled JSON. A feed tombstone MUST NOT represent cancellation.

This profile is a bounded discovery feed, not a complete directory snapshot or a
lossless change log. Omission means neither cancellation nor deletion. A directory
SHOULD keep recent changed/cancelled entries available long enough for its intended
polling audience and SHOULD order entries by most recent significant update. It
SHOULD document feed size and retention. No finite retention guarantees delivery
to consumers absent longer than that period.

RFC 6721 tombstones and RFC 5005 paging/archives are deferred optional capabilities.
If later adopted, a tombstone removes this directory's entry; it does not establish
the organizer's event status or authorize deleting copies from other sources.

## 4. Example

The package includes `examples/directory.atom` and `examples/directory.rss`.
Their `example.org` Document URLs illustrate future public hosting and are not
live endpoints. Core event documents remain separate from the feed. Section 6
describes `examples/publisher/`, a static-hosted publisher feed.

## 5. RSS alternative (informative)

A service may produce RSS 2.0 with stable `guid isPermaLink="false"` equal to the
Event ID, human `<link>`, useful `<description>`, and an Atom-namespaced typed JSON
`atom:link` within each item. This is an OpenAjang convention, not a guarantee of
ordinary RSS-reader behavior. RSS `pubDate` records publication, not event start;
`lastBuildDate` tracks channel changes, not per-item modification time. Do not
rewrite `pubDate` on every event edit or generate a new GUID to force notification.
A dedicated consumer can refresh source documents despite this limitation.

## 6. Publisher feeds

An organizer or platform MAY publish its own Atom feed, conventionally at
`/events.atom`, using this profile. Submitting an Event URL or JSON Document URL
remains valid without one, and a static host such as GitHub Pages can serve both
the feed and the documents it links. An indexer uses the feed to learn that a new
event exists or that an event changed. The event documents stay the authority for
dates, location, registration, and status.

A publisher feed and a directory feed share the entry contract in section 1 and
differ in role. A publisher feed lists one publisher's events, and a document
reached through it is as authoritative as that publisher's own site establishes.
A directory feed aggregates many publishers and carries directory provenance
(section 2). A consumer SHOULD record which kind of feed it learned an event from.

### 6.1 Discovery

A publisher-controlled HTML page SHOULD advertise the feed with standard
autodiscovery:

```html
<link rel="alternate" type="application/atom+xml" href="/events.atom" title="Events">
```

An indexer MAY also accept a feed URL registered manually. A feed found on a page
is established only for that page's origin and gives it no authority over other
organizations' events. This is separate from the core's OpenAjang JSON link, which
is how a page points to its own event document.

### 6.2 Indexer behavior

An indexer subscribing to a publisher feed:

1. Polls with conditional requests (`ETag`, `Last-Modified`) and honors HTTP
   caching and backoff.
2. Fetches the typed JSON link of each new or changed entry, validates the
   document, and verifies that its effective Event ID equals the entry `id`
   (section 2).
3. Keeps the Event ID and source provenance on an update. A copied ID is no proof
   of authority.
4. Treats cancellation as an update to `status: "cancelled"` and never as removal
   of an entry (section 3).
5. Revalidates saved events at their source, even after they leave the feed window.
   Absence from the feed means neither cancellation nor deletion.

### 6.3 Publisher behavior

Feed `updated` and entry `updated` advance only on significant changes. An
unchanged rebuild, common with static site generators, MUST NOT advance them, and
SHOULD produce identical output where practical so conditional requests succeed. A
publisher SHOULD keep recently changed and cancelled events listed for its intended
polling audience and document that window.

### 6.4 Limits

The feed is bounded. An indexer offline for longer than the retention window can
miss new events and changes, and the feed gives it no way to notice. It is a
discovery and change-notification surface. It cannot serve as a complete
inventory, a lossless change log, or a queryable index. To recover, read the
publisher's event pages or documents again.

### 6.5 Example

`examples/publisher/` holds `events.atom`, three event documents, an `index.html`
with autodiscovery, and `events-before.atom`, the same feed at an earlier poll.
Comparing the two shows a new event, a venue change, and a cancellation. Each
keeps its entry `id` and Event ID, and only the changed entries advance `updated`.
The `example.org` URLs are illustrative.

## References

- Atom: https://www.rfc-editor.org/rfc/rfc4287
- Feed autodiscovery: https://www.rssboard.org/rss-autodiscovery
- Paging/archives: https://www.rfc-editor.org/rfc/rfc5005
- Tombstones: https://www.rfc-editor.org/rfc/rfc6721
- RSS: https://www.rssboard.org/rss-specification
