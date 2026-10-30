---
title: Store and refresh events
description: Save imported OpenAjang events, keep them current with conditional requests, and handle each refresh outcome the way the spec describes.
section: apps
order: 2
---

Applications that retain imported events (such as personal calendars, reminder apps, and event directories) are classified as Storing Consumers under the specification ([§9](/spec/#9-extensions-versions-and-conformance)). Storing an event means maintaining its identity, recording provenance, scheduling conditional refreshes, and handling status updates faithfully ([spec §5.1](/spec/#51-identity), [§8.3](/spec/#83-redirects-caching-and-refresh), [§10](/spec/#10-security-and-operational-requirements)).

If you are resolving a pasted link into a validated document first, see [Resolve and import a URL](/docs/resolve-and-import-a-url/). Once you hold a valid document and decide to keep it, store the event and its provenance as described below.

## What to store

Keep one record per saved event, keyed on the effective Event ID. Alongside it, keep the following.

| Keep | Why |
| --- | --- |
| Effective Event ID | The primary lifecycle key. It is the document's `id` if present, otherwise its `url` ([§2](/spec/#2-terminology), [§5.1](/spec/#51-identity)). It is an opaque exact string, so compare it as one. |
| Provenance | Where the document came from. The spec requires consumers to retain provenance and not silently merge conflicting claims ([§5.1](/spec/#51-identity)). For a directory it lists the supplied URL, final Event URL, Document URL, retrieval time, source host and useful redirect and verification history ([§10](/spec/#10-security-and-operational-requirements)). |
| Retrieval time | When your app last received a valid representation, recorded by your app ([§8.3](/spec/#83-redirects-caching-and-refresh)). |
| Last valid representation | The most recent document that passed validation. Failed refreshes leave it in place. |
| The original HTML Event URL | Needed for rediscovery when the Document URL stops working, if the event was found through an HTML page ([§8.3](/spec/#83-redirects-caching-and-refresh)). |
| Validators from the last response | The `ETag` and `Last-Modified` values, so the next refresh can be conditional. |

The retrieval fields that `@openajang/resolver` returns (`finalFetchedUrl`, `documentUrl` and `declaredEventUrl`) are the raw material for the provenance record. The resolver does not store events, cache responses, perform conditional refresh or verify source continuity between revisions, so your app implements those parts ([`@openajang/resolver` README](https://github.com/nedpals/openajang/blob/master/packages/resolver/README.md)).

Do not use the title, the dates or the venue to decide that two documents are the same event. [Spec §5.1](/spec/#51-identity) says titles, dates, venues and matching IDs from unrelated sources are not proof of identity or continuity.

## Source continuity

The event ID is only half of identity. Spec §5.1 also says matching IDs from unrelated sources are not proof of continuity, and §8.3 says not to refresh a new unrelated origin as authoritative solely because it copied an ID. A copied ID is a claim, and your app decides how much to trust it. Control of a host establishes provenance of its assertions, not organizer identity ([§2](/spec/#2-terminology)).

In practice, a refresh should come back from the source you already follow. Three cases in the spec show where continuity matters.

- A same-ID document appears from a different origin. The matching ID alone is not sufficient evidence of an update, so verify source continuity before treating it as one ([§8.3](/spec/#83-redirects-caching-and-refresh)).
- The Event URL moves to another host. [Spec §5.1](/spec/#51-identity) says a cross-host transfer should be confirmed by a redirect or a changed representation controlled by the previous source.
- The HTML page's alternate link changes to a different JSON address. Require the same ID and source continuity before you switch ([§8.3](/spec/#83-redirects-caching-and-refresh)).

The spec leaves the exact continuity test to the consumer. It names confirmation from the previous source as the signal, and it does not define a specific algorithm. When a source conflicts with something you already hold, the spec requires you to retain provenance and not to merge the conflicting claims silently ([§5.1](/spec/#51-identity)). Keeping both claims, each with its provenance, is one way to meet that.

## Refresh outcomes

Refresh a saved event by requesting its Document URL again. [Spec §8.3](/spec/#83-redirects-caching-and-refresh) sets the required behavior for each response.

| Refresh response | Required behavior for a storing consumer |
| --- | --- |
| Valid `200`, same ID and verified source continuity | Replace the current representation and record the retrieval time. |
| Invalid `200` | Retain the last valid representation and record the failure. |
| `200` with a different effective ID | Do not overwrite the old event as an update. |
| `404` at a previously discovered Document URL | Repeat discovery from the original HTML Event URL before removal where that page remains safely retrievable. Otherwise record unavailability and apply a documented removal policy. |
| `410` | Apply your document-removal policy. This is not evidence the event was cancelled. |
| Network failure or `5xx` | Retain the last valid representation and retry with backoff. |

A conditional response of `304` keeps the existing document ([§8.3](/spec/#83-redirects-caching-and-refresh)).

Three points to carry into your design:

- A cancelled event arrives as a valid `200` with `status: "cancelled"`. Cancellation should stay a `200 OK` document, and consumers should keep it to inform people who saved the event ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). A `410` means the publisher removed the document, which is a different thing.
- A `404` means the document is currently unavailable ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). The table sends you back to the HTML Event URL before you give up on it.
- An invalid `200` is an error, not a reason to scrape or fall back to another representation ([§8.1](/spec/#81-inputs-and-direct-json)). Your last valid copy stays.

The spec does not say how long to retry, what a removal policy contains, or what to do with the old record after a different-ID response. Those are your app's decisions, and the spec asks that the removal policy be documented.

Redirects apply here as they do for first retrieval. Consumers should follow at most five and should reject HTTPS-to-HTTP downgrades unless explicitly configured, and the retrieval safety rules apply to every target ([§8.3](/spec/#83-redirects-caching-and-refresh), [§10](/spec/#10-security-and-operational-requirements)).

## Conditional requests

Publishers should send cache controls and `ETag` or `Last-Modified` ([§8.3](/spec/#83-redirects-caching-and-refresh)). On your side the rule is firmer: a stored-event consumer must use the validators that are available when it revalidates, honoring HTTP precedence rules. Those rules are in RFC 9110 and RFC 9111, which the spec lists as normative foundations ([§11](/spec/#11-references-and-companion-status)).

Concretely, save the `ETag` and `Last-Modified` values from each valid `200`. On the next refresh, send them back as `If-None-Match` and `If-Modified-Since`. If the server answers `304`, keep the stored document. If it answers `200`, validate the body and apply the table above.

Validators and `updated_at` do different jobs. Publishers must advance `updated_at` for material changes even when they serve validators, and consumers must not skip a fetch solely because a stored timestamp is recent ([§8.3](/spec/#83-redirects-caching-and-refresh)).

If a fetched revision has changed content but a timestamp that did not advance, the spec says that should produce a publisher-quality warning. It also says handling comes from HTTP fetch results, provenance and local history, not from blind timestamp sorting across publishers ([§8.3](/spec/#83-redirects-caching-and-refresh)).

## Three clocks

Three different timestamps can show up for one event. They measure different things and are not interchangeable.

| Clock | Set by | Means |
| --- | --- | --- |
| Feed entry `updated` | A directory | The directory's significant modification of its entry. It is not a copy of the organizer's `updated_at`, not a retrieval timestamp, and not a global conflict-resolution clock ([Feeds §1](/feeds/#1-feed-contract)). |
| Document `updated_at` | The publisher | A material change to the event: dates, venue, lifecycle, registration, ticket prices or availability. Unchanged fetches and rebuilds must not advance it ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). |
| Your retrieval time | Your app | When you last received a valid representation. HTTP validators and consumer retrieval time remain separate from `updated_at` ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). |

Store all three when you have them. The spec warns against blind timestamp sorting across publishers ([§8.3](/spec/#83-redirects-caching-and-refresh)), so do not use `updated_at` values from different publishers to decide which source is right.

## Saved events keep refreshing

A feed subscription discovers listings. A saved event is a separate thing, and the spec says saved events should continue to refresh directly even after they leave a feed window ([§8.3](/spec/#83-redirects-caching-and-refresh), [Feeds §2](/feeds/#2-refresh-identity-and-source-provenance)).

<aside class="doc-note" aria-label="Saved events can leave a feed">
<p class="doc-note-title">Saved events can leave a feed</p>

Feeds are bounded. An entry can drop out of a feed before the event is cancelled, and omission from a feed means neither cancellation nor deletion ([Feeds §3](/feeds/#3-changes-cancellation-and-disappearance)). A consumer that only reads a feed must not promise reliable cancellation delivery for saved events ([Feeds §2](/feeds/#2-refresh-identity-and-source-provenance)). The direct refresh of the Document URL is how your app learns about a late cancellation.

</aside>

Following and running directory feeds is covered in [Directory feeds](/docs/directory-feeds/).

## Rediscovery from the HTML Event URL

If an event was found through an HTML page, keep that page's URL. Consumers should occasionally rediscover retained HTML Event URLs, and should also do so after a document's relationship or provenance changes ([§8.3](/spec/#83-redirects-caching-and-refresh)). Rediscovery follows the same rules as first discovery ([§8.2](/spec/#82-html-discovery)).

Rediscovery is also the step the refresh table calls for when a Document URL returns `404`. If the alternate link now points somewhere else, apply the continuity rule from earlier before you switch: the same ID and source continuity are required ([§8.3](/spec/#83-redirects-caching-and-refresh)).

## How often to refresh

Polling frequency is consumer policy and not a JSON property ([§8.3](/spec/#83-redirects-caching-and-refresh)). The spec gives two directions: reduce polling after repeated failures, and reduce it for ended events. It sets no intervals. If your app shows availability or registration, [§10](/spec/#10-security-and-operational-requirements) asks that directories report freshness where attendance or purchase decisions depend on it, so show the retrieval time where a stale copy could mislead someone.

## Storing consumer checklist

The spec defines a Storing Consumer as a validator and resolver plus identity, refresh and provenance handling ([§9](/spec/#9-extensions-versions-and-conformance)). This checklist collects the rules from the sections above. Each item names the section that sets it and keeps that section's strength.

- Validate each document before storing it; reject an invalid JSON document as an error without falling back to scraping or alternate representations ([§9](/spec/#9-extensions-versions-and-conformance), [§8.1](/spec/#81-inputs-and-direct-json)).
- Do not silently treat an unknown schema identifier as supported ([§9](/spec/#9-extensions-versions-and-conformance)).
- Use the effective Event ID as the primary lifecycle key ([§5.1](/spec/#51-identity), a must).
- Do not treat titles, dates, venues or IDs from unrelated sources as proof of identity or continuity ([§5.1](/spec/#51-identity)).
- Retain provenance, and do not silently merge conflicting claims ([§5.1](/spec/#51-identity), a must). For a directory, keep the supplied URL, final Event URL, Document URL, retrieval time, source host and redirect and verification history ([§10](/spec/#10-security-and-operational-requirements)).
- Do not refresh a new unrelated origin as authoritative solely because it copied an ID ([§8.3](/spec/#83-redirects-caching-and-refresh)). Confirm a cross-host transfer through the previous source ([§5.1](/spec/#51-identity), a should).
- Use available `ETag` and `Last-Modified` validators on revalidation ([§8.3](/spec/#83-redirects-caching-and-refresh), a must), and keep the stored document on `304`.
- Do not skip a fetch solely because the stored `updated_at` is recent ([§8.3](/spec/#83-redirects-caching-and-refresh), a must).
- Apply the refresh outcomes in the table above, including keeping the last valid representation on an invalid `200`, a network failure or a `5xx`, and retrying with backoff ([§8.3](/spec/#83-redirects-caching-and-refresh)).
- Do not treat `410` as evidence of cancellation, and retain cancelled representations to inform saved-event users ([§8.3](/spec/#83-redirects-caching-and-refresh), [§5.3](/spec/#53-updates-postponement-rescheduling-cancellation), a should).
- Produce a publisher-quality warning when fetched content changes without a newer `updated_at` ([§8.3](/spec/#83-redirects-caching-and-refresh), a should).
- Follow at most five redirects, reject HTTPS-to-HTTP downgrades unless configured, and apply retrieval safety to every target ([§8.3](/spec/#83-redirects-caching-and-refresh), a should). A network-facing resolver also needs the protections in [§10](/spec/#10-security-and-operational-requirements), a must.
- Keep refreshing saved events directly after they leave a feed ([§8.3](/spec/#83-redirects-caching-and-refresh), [Feeds §2](/feeds/#2-refresh-identity-and-source-provenance), a should).
- Occasionally rediscover retained HTML Event URLs, and do so after a relationship or provenance change ([§8.3](/spec/#83-redirects-caching-and-refresh), a should).
- Set your own polling frequency, lower it after repeated failures and for ended events, and document your removal policy ([§8.3](/spec/#83-redirects-caching-and-refresh)).
- Treat all document data as untrusted ([§10](/spec/#10-security-and-operational-requirements)).

## Next

- [Display an imported event](/docs/display-an-imported-event/)
- [Directory feeds](/docs/directory-feeds/)
- [SDKs and tools](/docs/sdks-and-tools/)
