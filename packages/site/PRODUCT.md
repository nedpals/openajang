# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Event organizers and developers are equally important audiences. Organizers publish event information where they already work and choose their own registration provider. Developers build compatible apps and directories that discover, read, and follow event information.

## Product Purpose

OpenAjang is a small JSON format for publishing public events at a URL. It aims to make event information usable across compatible tools without requiring organizers to maintain another listing or join a central service.

## Positioning

Publishers host their own event documents using ordinary web infrastructure. Consumers can import a URL directly or discover events through optional directory feeds, and registration remains with the organizer's chosen provider.

## Capabilities and Constraints

- The format and specification are a version 0.1 working draft.
- The site provides the specification, examples, feed guidance, and a browser-based validator. Validation runs locally without uploading the event file.
- An optional TypeScript SDK is available as `@openajang/core`.
- Compatibility requires publishers to expose compatible data; the format does not automatically extract events from existing platforms.
- Further durable product constraints are undecided.

## Brand Commitments

The name OpenAjang draws on the Indonesian word *ajang*, meaning an event, occasion, or gathering place.

## Evidence on Hand

The repository contains the specification, schema, publishing guidance, and event examples. Example event dates and details have not been rechecked against organizer sites; see `PUBLISHING.md` at the repository root for provenance.

## Product Principles

- Support organizers and developers as equally important audiences.
- Keep publishing independent and compatible with ordinary web infrastructure.
- Let organizers retain control of registration and published event information.
- Make the format's capabilities and current working-draft status clear.
