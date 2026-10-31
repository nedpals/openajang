# Extension profiles

An extension profile is a published description of one `extensions` key, so that
independent tools can implement it the same way. Profiles are optional. A Basic
Publisher, a core validator, and a consumer that ignores extensions remain
conforming without reading any profile.

Nothing here adds a registry, a plugin model, or schema fetching. A consumer
bundles the profiles it chooses to support, as [SPEC.md §9](SPEC.md#9-extensions-versions-and-conformance)
already requires for schemas. A reverse-domain namespace shows who wrote a key. It
does not prove they have authority over what the key describes.

The `unstable:*` keys in [experimental-extensions.md](experimental-extensions.md) are
not profiles. They document the included examples and carry no compatibility promise.

## What a profile contains

| Element | Content |
| --- | --- |
| Key | The exact `namespace:name` string, including any version suffix. |
| Steward | Who maintains the profile and where it is published. |
| Status | `experimental`, `published`, or `deprecated`. |
| Value schema | A JSON Schema for the value, plus any rules the schema cannot express. |
| Scope | What the value describes: the whole event, one ticket, one component, or something else. |
| Core fallback | What a core-only consumer can still assert accurately when the extension is removed. |
| Consumer behavior | What a supporting consumer may do with the value, and what it must not do. |
| Fixtures | Valid and invalid example values. |

A profile is one directory or document. Its key and schema are fixed together:
changing either one is a change under the rules below.

## Identity and versioning

Put the major version in the name part of the key, as `-v` and a positive integer
without a leading zero: `org.example:eligibility-v1`. The suffix is a convention.
The schema does not check it, and consumers must treat the whole key as opaque.

A key identifies one meaning. Once a profile reaches `published`, its key MUST NOT
be reused for a different meaning, and a breaking change MUST get a new key.

### Breaking and compatible changes

Breaking changes get a new key, such as `eligibility-v2`:

- removing or renaming a property;
- changing a property's type, unit, or meaning;
- making an optional property required, or rejecting a value that was valid;
- accepting a value that an old consumer would misread;
- widening or narrowing the scope;
- weakening the core fallback.

Compatible changes keep the key:

- adding an optional property that an old consumer can ignore;
- clarifying prose without changing meaning;
- adding fixtures;
- fixing a schema bug so that it matches the prose.

A consumer that supports `-v1` ignores unknown properties inside the value, so
compatible additions do not break it.

### Migration

During a migration a publisher MAY emit both keys in the same document. The old key
keeps its meaning until the profile is deprecated. A consumer that supports both
SHOULD prefer the newer key and MUST NOT merge values from the two.

A deprecated profile stays readable. Its key remains reserved and is never
reassigned.

## Rules for every profile

- The value MUST NOT change the meaning of a core property.
- The core text MUST say everything a person needs. The extension repeats it as
  structure.
- A profile MUST NOT permit an automated action, such as rejecting an application,
  hiding an event, or charging a fee, that rests on the extension alone.
- Consumers treat values as untrusted data ([SPEC.md §10](SPEC.md#10-security-and-operational-requirements)).
- A malformed value means the consumer ignores the extension. The core listing
  stays valid.

## Reference profile

[extensions/org.example-eligibility-v1](extensions/org.example-eligibility-v1/PROFILE.md)
shows each element for event-wide age limits. Its schema and fixtures are checked by
the core test suite, together with a check that core validation accepts every
fixture value in a document.

## Writing a profile

1. Write the core text first, then ask what structure a specific tool needs.
2. Pick a key in a namespace you control and add `-v1`.
3. Write the fallback before the schema. If you cannot state one, the extension
   likely changes core meaning and should not exist.
4. Add valid and invalid fixtures, including a boundary case for each rule.
5. Publish the profile at a stable address and record its status.
