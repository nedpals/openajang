---
title: Extensions
description: How the extensions object works, the rule that keeps core listings complete without it, and the five experimental keys used by the included examples.
section: evaluate
order: 3
---

This page is for publishers and tool builders who want to carry structured data that the core format does not define. It explains how extension keys are named, the rule that limits what an extension may do, and what to do on each side of a document that uses one.

## What the extensions object is

`extensions` is an optional top-level object in an OpenAjang document ([spec §3.2](/spec/#32-core-properties)). It is the place for private or experimental additions. Publishers must put private additions there rather than adding new top-level properties ([spec §3](/spec/#3-document-and-authoring-rules)).

Every key has the form `namespace:name`. Each side must be nonempty and use only ASCII letters, digits, dots, underscores or hyphens ([spec §9](/spec/#9-extensions-versions-and-conformance)). The schema enforces the same pattern on the key names. The values are arbitrary JSON, including `null`. The no-`null` rule for core properties does not apply inside `extensions`.

Two naming rules apply to the namespace:

- Third-party namespaces should use a reverse domain that the author controls, such as `org.example:streaming`.
- `unstable` is reserved for documented OpenAjang experiments. Do not use it for your own keys.

Here is a complete document with one third-party extension. The core fields already say everything a reader needs, including the limit on the livestream.

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "url": "https://example.org/events/open-source-talks",
  "title": "Open Source Talks",
  "description": "An evening of short talks. The livestream covers the main room only; workshop rooms are not streamed.",
  "status": "scheduled",
  "starts_at": "2026-11-14T18:00:00+08:00",
  "organizer": { "name": "Example Community" },
  "location": {
    "type": "hybrid",
    "physical": { "name": "Community Hall" },
    "virtual": { "url": "https://example.org/events/open-source-talks/live" }
  },
  "updated_at": "2026-10-29T08:00:00Z",
  "extensions": {
    "org.example:streaming": {
      "main_room_only": true,
      "chat_enabled": false
    }
  }
}
```

A tool that understands `org.example:streaming` can read the two flags directly. Every other tool still sees a hybrid event and a description that states the limit.

## The rule that governs every extension

If you strip every extension from a document, what remains must be an accurate and useful listing. Automation may lose detail, but the listing cannot become wrong or unusable. Four consequences follow from [spec §9](/spec/#9-extensions-versions-and-conformance) and [spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation):

- An extension must not alter the meaning of a core field. It adds detail beside the core, not instead of it.
- Publishers must not depend on an extension to correct a false core assertion. If the core says something misleading, fix the core.
- Publishers must put important limits in the core `description` or in registration or venue `instructions`, even when an extension supplies the same limit as structure.
- Core descriptions and instructions must remain useful when all extensions are removed.

[Spec §3](/spec/#3-document-and-authoring-rules) adds one related note: describe visiting hours in explanatory text or in a separately documented extension. Consumers do not expand structured schedules as part of the core contract, and the top-level `schedule` property is reserved and must be absent.

## What consumers and validators do with extensions

Consumers must ignore unknown extensions ([spec §3](/spec/#3-document-and-authoring-rules)). An extension a consumer does not recognize is not grounds for rejecting the document, and a consumer that does recognize a key remains free to ignore it.

A validator must not require private extension schemas ([spec §9](/spec/#9-extensions-versions-and-conformance)). The experimental notes go a step further and say no generic validator may require support for specific extension keys. The schema checks only that `extensions` is an object and that each key matches the `namespace:name` pattern.

An extension that many tools should implement needs more than a key name. The experimental notes say broad implementation requires a separately reviewed extension contract and schema. Until one exists, a key is a private agreement between a publisher and the tools that chose to read it.

## The five experimental keys

The `unstable:` keys below are documented in [`experimental-extensions.md`](https://github.com/nedpals/openajang/blob/master/experimental-extensions.md) only for the included [examples](/examples/). They are not core requirements, and they are not an API for programs, eligibility or admission selection. Shapes are illustrative.

| Key | Illustrative shape | Core fallback |
| --- | --- | --- |
| `unstable:components` | Array of objects with `name`, `starts_at` and a location-shaped `location`. Dates keep their original precision. | The overall description and the registration or venue instructions say which days have which attendance modes. No ticket coverage is inferred. |
| `unstable:eligibility` | Object with integer `minimum_age` and `maximum_age`. | The registration instructions state the age range. |
| `unstable:participation` | Object with integer `minimum_team_size` and `maximum_team_size`, boolean `individual_matching_available` and text `prerequisite`. | The registration instructions state team sizes, individual matching and the prerequisite. |
| `unstable:event_languages` | Object with arrays `working` and `presentations` of language tags. | The description names the spoken and presentation languages. The document `language` field stays the language of the document text, not of the event. |
| `unstable:broadcast` | Object with URL `recordings_url` and boolean `counts_as_attendance`. | The description says recordings remain available. The core `location` stays physical. |

In each row the core fallback carries the full meaning. The extension only repeats it as structure. A recording alone does not make an event virtual or hybrid ([spec §6.2](/spec/#62-location)), which is why `unstable:broadcast` leaves the core location alone.

## Guidance for publishers

1. Write the core text first. Fill in the required fields, then use `description` and the registration or venue `instructions` for anything a person must know before attending: limits, restrictions, which days use which mode.
2. Add an extension only if a specific tool you know of needs structure that the core does not give it.
3. Put the key in a namespace you control: you should use a reverse domain you control. Do not use `unstable:`.
4. Check the result by stripping the extension in your head, or in a copy of the file. If the listing is now wrong or missing something a person needs, move that information into the core text.
5. Do not use an extension to patch a mistake in a core field. Correct the core field.

## Guidance for tool builders

- Ignore any extension key you do not recognize. Do not reject a document because of one.
- Never depend on an extension for correctness. Anything you need to show a person accurately must come from core fields. Treat an extension as a hint that refines presentation or automation.
- If you read a key you do recognize, handle a missing key, a malformed value and a `null` value without rejecting the core listing. The spec allows any valid JSON as a value ([spec §9](/spec/#9-extensions-versions-and-conformance)). A separately reviewed extension contract that you adopt may add its own validation for its keys.
- Do not infer eligibility, continuous occupancy, universal ticket coverage or a final payable price from missing information ([spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation)). Important limits must appear in core descriptions or instructions, so look there first ([spec §1.1](/spec/#11-occurrence-boundaries-and-conservative-interpretation), [spec §9](/spec/#9-extensions-versions-and-conformance)).
- Treat extension values as untrusted data. Render text without executing markup or extension values ([spec §10](/spec/#10-security-and-operational-requirements)).
- If you want other tools to adopt a key, publish it as a separately reviewed contract with a schema. Do not expect a generic validator to enforce it.

## Related

- [Versioning and stability](/docs/versioning-and-stability/)
- [Display an imported event](/docs/display-an-imported-event/)
- [Reference](/docs/reference/)
