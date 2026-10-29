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
live endpoints. Core event documents remain separate from the feed.

## 5. RSS alternative (informative)

A service may produce RSS 2.0 with stable `guid isPermaLink="false"` equal to the
Event ID, human `<link>`, useful `<description>`, and an Atom-namespaced typed JSON
`atom:link` within each item. This is an OpenAjang convention, not a guarantee of
ordinary RSS-reader behavior. RSS `pubDate` records publication, not event start;
`lastBuildDate` tracks channel changes, not per-item modification time. Do not
rewrite `pubDate` on every event edit or generate a new GUID to force notification.
A dedicated consumer can refresh source documents despite this limitation.

## References

- Atom: https://www.rfc-editor.org/rfc/rfc4287
- Paging/archives: https://www.rfc-editor.org/rfc/rfc5005
- Tombstones: https://www.rfc-editor.org/rfc/rfc6721
- RSS: https://www.rssboard.org/rss-specification
