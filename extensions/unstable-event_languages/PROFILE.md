# unstable:event_languages (worked candidate)

A worked example of the [graduation checklist](../../EXTENSIONS.md#graduation-checklist).
It is a candidate, not a standard. The key stays in the reserved `unstable`
namespace, and a graduated profile would take a new versioned key that this
document does not choose.

| Element | Value |
| --- | --- |
| Key | `unstable:event_languages` |
| Steward | OpenAjang repository |
| Status | `experimental` |
| Value schema | [schema.json](schema.json) |
| Fixtures | [fixtures.json](fixtures.json), [fallback-cases.json](fallback-cases.json) |
| Used by | [devfest-belgrade-hackathon-2026](../../examples/devfest-belgrade-hackathon-2026.openajang.json) |

## Value

An object with at least one of two properties, each a nonempty array of unique
BCP 47 language tags:

- `working`: languages the organizers use to run the event and talk with participants.
- `presentations`: languages in which talks, demos, or final presentations are given.

Every tag MUST be well-formed under RFC 5646. The schema cannot check that, so a
profile validator does it separately, with the same rule the core uses for the
document `language` property. A name such as `English (US)` is not a tag. The check
is syntax only, so a bare word like `English` passes it even though it is not a
registered language subtag. Publishers should use registered tags such as `en`.

## Scope

Event-wide. The value says nothing about a single session, ticket, or component.
It also differs from the document `language` property, which is the language of the
document text and not of the event.

## Interpretation

- The lists are not exhaustive. A language that is absent may still be spoken. A
  consumer MUST NOT conclude that an event is unavailable in a language because the
  tag is missing.
- A tag matches only itself, compared case-insensitively. `sr` does not stand for
  `sr-Latn`, and a regional tag does not stand for its base language.
- Order carries no meaning.
- Listing a language says nothing about interpretation services, subtitles, or
  materials unless the core text says so.

## Malformed, omitted, conflicting, and stale data

- Malformed value: treat the extension as absent. The core event stays valid.
- Omitted: no claim at all. Do not guess a language from the document `language` or
  the venue country.
- Conflict with core text: the core text wins. If the description names a language
  the extension leaves out, or the reverse, a consumer shows the core text and may
  report the mismatch.
- Stale: a change to either list is material to someone deciding to attend, so the
  publisher advances `updated_at` even when no core field changed.

## Core fallback

The description states the working and presentation languages in words, as the
Belgrade example does ("Working language is Serbian; presentations are in
English"). A core-only reader then knows which languages the event uses. An event
whose core text omits them has no adequate fallback and must not rely on the
extension. [fallback-cases.json](fallback-cases.json) holds one adequate and one
inadequate case.

## Consumer behavior

A supporting consumer MAY show the languages as labels and offer a language filter
that the person chooses. It MUST NOT:

- hide an event because a language the person prefers is missing;
- claim an event is, or is not, accessible to anyone based on these lists;
- infer interpretation, subtitles, or translated materials.

## Open questions before promotion

- Whether a third list for materials or support channels is needed.
- Whether two independent consumers read the interpretation rules the same way. No
  second implementation exists yet, so the checklist item on independent
  implementations is unmet.
