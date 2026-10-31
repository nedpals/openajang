# org.example:eligibility-v1

Reference extension profile. It shows the shape described in
[EXTENSIONS.md](../../EXTENSIONS.md) and is not a recommendation to adopt it. The
`org.example` namespace is reserved for documentation and nobody controls it, so
no real publisher should emit this key.

| Element | Value |
| --- | --- |
| Key | `org.example:eligibility-v1` |
| Steward | Documentation example, no real steward |
| Status | `experimental` |
| Value schema | [schema.json](schema.json) |
| Fixtures | [fixtures.json](fixtures.json) |

## Value

An object with at least one of two integer properties:

- `minimum_age`: youngest permitted age in whole years, 0 to 150.
- `maximum_age`: oldest permitted age in whole years, 0 to 150.

Procedural rule: when both are present, `maximum_age` MUST NOT be lower than
`minimum_age`. The schema cannot express this, so a profile validator checks it
separately. A value that fails either check is malformed, and a consumer treats
the extension as absent.

## Scope

Event-wide. The limits apply to every attendee of the whole event. They say nothing
about individual tickets, sessions, or components of a multi-part event.

## Core fallback

Registration `instructions` state the age limits in words, for example
"Open to ages 18 to 26." A core-only consumer can still tell a person who may attend.
It must not infer eligibility from the missing key. An event without this extension
has no age limit only if the core text says so.

## Consumer behavior

A consumer that supports this profile MAY:

- show the limits next to the registration action;
- filter or rank events for an age a person entered themselves.

A consumer MUST NOT:

- treat a missing key as "no age limit";
- block registration, hide an event, or reject an application on the extension
  alone, because the organizer's stated rules in the core text decide eligibility;
- infer a person's age or collect it without their direct input.

## Compatibility

Compatible changes keep `-v1`: adding optional properties that an old consumer can
ignore, editing prose, adding fixtures. Anything listed as breaking in
[EXTENSIONS.md](../../EXTENSIONS.md#breaking-and-compatible-changes) moves to
`org.example:eligibility-v2`.
