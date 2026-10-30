---
title: Start here
description: Find the OpenAjang guide for what you are doing, whether you publish events, build event software, or build an app or directory.
section: start
order: 1
---

OpenAjang is a small JSON format for publishing public events at a URL. An organizer hosts one event file and links their existing registration form. Compatible apps and directories read the file, show the event, and keep checking it for changes. Registration stays with the organizer's own provider, and there is no central OpenAjang account to join.

These guides are grouped by what you are doing. The format is a `0.1` working draft; [Versioning and stability](/docs/versioning-and-stability/) says what that does and does not promise.

## Pick your path

### You organize events

You have an event page or a community site and a registration form, and you want apps to be able to read your event.

- [Publish your first event](/docs/publish-your-first-event/): write the file, host it, and check it before you share it.
- [Keep an event current](/docs/keep-an-event-current/): what to change when the page moves, the date changes, the event is cancelled, or tickets sell out.
- [Recurring, annual, and multi-day events](/docs/recurring-annual-and-multi-day-events/): monthly meetups, yearly conferences and exhibitions.

### You build event software

Your platform already holds events and you want it to publish them without asking organizers to re-enter anything.

- [Export from your platform](/docs/export-from-your-platform/): map your records, keep ids stable, serve each event's document, and link it from the event page.

### You build an app or a directory

You want to accept an event URL from a person, save the event, and show it faithfully.

- [Resolve and import a URL](/docs/resolve-and-import-a-url/): discovery, redirects, limits and security.
- [Store and refresh events](/docs/store-and-refresh-events/): identity, provenance, and what to do with each refresh result.
- [Display an imported event](/docs/display-an-imported-event/): how to show dates, registration, prices and sources without claiming more than the document says.
- [Follow or run a directory feed](/docs/directory-feeds/): the optional Atom feed profile, from both sides.

### You write code against the format

- [SDKs and tools](/docs/sdks-and-tools/): the optional TypeScript packages, the validator, the Python reference tools and the example files.

### You are deciding whether to use it

- [Why OpenAjang, and how it compares](/docs/why-openajang/): what it prescribes, what it leaves out, and how it relates to other formats.
- [Versioning and stability](/docs/versioning-and-stability/): what `0.1` promises.
- [Extensions](/docs/extensions/): adding structured detail without breaking the core listing.

## How the pieces fit

The organizer's website hosts each event document at a stable URL. A participant gives that URL, or the event page that links to it, to a compatible app. A directory can also collect event links into an Atom feed that apps follow. Whichever way an event arrives, the app keeps refreshing it from the organizer's own site.

For exact rules, the [specification](/spec/) is the source. The [reference page](/docs/reference/) lists everything else: the feed profile, conversion guide, schema, validator, examples and license terms.
