---
title: Publish your first event
description: Write an OpenAjang event file, host it with an accepted media type, optionally link it from your event page, and check it before you share it.
section: organizers
order: 1
---

This page is for organizers publishing an event in OpenAjang for the first time. By the end you will have an event document at a public URL that compatible apps and directories can import, and, if you control your event page, a link on that page that lets people import the event from its ordinary web address.

You need a text editor and somewhere to host one file. You do not need a server, an account with an OpenAjang service, or any package.

## Write the event document

Create a UTF-8 JSON file holding one JSON object. The name is up to you; this guide uses `event.openajang.json`.

Every document needs these fields ([Spec §3.2](/spec/#32-core-properties)):

| Field | What to put there |
| --- | --- |
| `$schema` | Exactly `https://openajang.nedpals.xyz/schema/0.1/event.json`. It names the version of the format your file follows ([§9](/spec/#9-extensions-versions-and-conformance)). |
| `type` | Always `"event"`. |
| `url` | The public page where people read about the event. |
| `title` | The event's name. |
| `status` | `"scheduled"` for a new event. The other values are for changes later ([§5.2](/spec/#52-status)). |
| `starts_at` | A date and time with its UTC offset, such as `2026-11-14T18:00:00+08:00`, or a date alone (`2026-11-14`) if the hours are not set yet ([§4](/spec/#4-dates-and-time-precision)). |
| `location` | Whether the event is `physical`, `virtual` or `hybrid`, and the matching venue or online details ([§6.2](/spec/#62-location)). |
| `organizer` | An object with at least a `name` ([§6.1](/spec/#61-party-objects)). |
| `updated_at` | The date and time you last made a real change to the event information ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). |

Most organizers also add `registration`, which points to the form or ticket page you already use (Google Forms, a ticketing service, your own page). OpenAjang only links to it; it does not submit registrations or read responses. If you leave `registration` out, apps treat registration details as not published. They do not read it as "no registration needed" ([§7.1](/spec/#71-registration)).

Leave out any optional field you do not know. No core property accepts `null`, and unknown optional values should be omitted instead of filled with empty strings or placeholders such as `"TBA"` ([§3](/spec/#3-document-and-authoring-rules)). Put only public information in the file: no attendee details, private contacts, passwords, personalized ticket links or private meeting links ([§10](/spec/#10-security-and-operational-requirements)).

### The page URL and the file URL can differ

`url` is the human-readable page for the event. It can be your website, a page on an event platform, or a repository README that describes the event. The JSON file itself is served from its own address, called the Document URL, which may be the same as `url` or somewhere else entirely ([§2](/spec/#2-terminology)).

### When to set an `id`

`id` is optional. Apps use it to recognize the same event across updates. Without one, `url` is the event's identity, so that page address has to stay the same for the life of the event ([§5.1](/spec/#51-identity)).

Setting an `id` is recommended when `url` is:

- a homepage that will be reused for next year's event,
- an address that may change, such as a slug you might rename,
- a page on someone else's site that could move.

For a new event, generate a UUID once and write it as a URN, such as `urn:uuid:3f6b2c1e-8d4a-4f7b-9c2e-5a1d7e0b4c93`. Any UUID generator works (for example, `uuidgen` in a macOS or Linux terminal). An occurrence-specific HTTPS address on a domain you control also works. Once published, keep the `id` through every change to the event, and never reuse it for a different event. Next year's edition gets a new one ([§5.1](/spec/#51-identity)).

### A complete example

This example event uses the required fields plus `id`, `summary`, `description`, `ends_at`, `time_zone`, venue details and registration. Replace every value with your own.

```json
{
  "$schema": "https://openajang.nedpals.xyz/schema/0.1/event.json",
  "type": "event",
  "id": "urn:uuid:3f6b2c1e-8d4a-4f7b-9c2e-5a1d7e0b4c93",
  "url": "https://example.org/events/build-night-november",
  "title": "Community Build Night",
  "summary": "An evening of building and sharing small projects.",
  "description": "Bring a laptop and something you are working on. The hall seats 40 people.",
  "status": "scheduled",
  "starts_at": "2026-11-14T18:00:00+08:00",
  "ends_at": "2026-11-14T21:00:00+08:00",
  "time_zone": "Asia/Manila",
  "organizer": {
    "name": "Example Community",
    "url": "https://example.org/"
  },
  "location": {
    "type": "physical",
    "physical": {
      "name": "Example Community Hall",
      "address": {
        "locality": "Davao City",
        "country": "PH"
      },
      "instructions": "Use the side entrance on the ground floor."
    }
  },
  "registration": {
    "required": true,
    "status": "open",
    "url": "https://example.org/events/build-night-november/register",
    "closes_at": "2026-11-13T23:59:00+08:00"
  },
  "updated_at": "2026-10-29T08:00:00Z"
}
```

The `+08:00` offset fixes the exact start time. `time_zone` adds the local zone name for display; it does not replace the offset ([§4.1](/spec/#41-timed-events)).

Paste your file into the [validator](/validator/) and fix anything it reports before you host it.

## Host it

Put the file at a public URL that returns the JSON itself with one of these `Content-Type` values ([§3](/spec/#3-document-and-authoring-rules)):

- `application/vnd.openajang+json`
- `application/json`

Parameters such as `; charset=utf-8` are fine, and apps compare the type without regard to letter case ([§8.1](/spec/#81-inputs-and-direct-json)). Prefer an `https://` address.

Any static host works if it sends one of those types. You do not need to run a program on the server.

### GitHub repositories: the common mistake

Committing the file to a GitHub repository does not by itself give you a working address. The normal file view (`github.com/<owner>/<repo>/blob/...`) is an HTML page, and the "Raw" link serves the file as `text/plain`. Neither is an accepted document endpoint ([§3.1](/spec/#31-minimal-example)).

### GitHub Pages is the easy path

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) publishes files from a repository as a website. When we checked a GitHub Pages site on 2026-10-30, it served a `.json` file as `application/json`; confirm your own address with the `curl -I` check below. For example, a file committed as `build-night/event.openajang.json` in a repository named `events`, published from the repository root, would be at:

```text
https://your-community.github.io/events/build-night/event.openajang.json
```

Replace the owner, repository and path with your own. If you already have a website, putting the file next to your event page works the same way.

### CORS only matters for browser-based tools

Apps and directories that fetch your file from their own servers do not need anything extra. A tool that runs in a visitor's browser on a different site from your file can read it only if your host allows cross-origin reads, using the `Access-Control-Allow-Origin` response header. Tools on the same site as the file do not need it. Static browser tools may require this CORS support or a server-side resolver ([§10](/spec/#10-security-and-operational-requirements)). For a public event document, `Access-Control-Allow-Origin: *` is one option: it lets any site read the file. You can also name specific allowed origins. The GitHub Pages site we checked on 2026-10-30 sent `*`; the `curl -I` check below shows what your host sends.

## Optionally link it from your event page

If you can edit the HTML of the page at `url`, add this inside its `<head>`:

```html
<link
  rel="alternate"
  type="application/vnd.openajang+json"
  href="./event.openajang.json"
/>
```

This assumes the JSON file sits beside the event page. Change `href` if it lives elsewhere; a full `https://` address is fine, including one on a different domain. With the link in place, people can give a compatible app your ordinary event page address, and the app finds the JSON from there.

Apps follow the same discovery rules so they all reach the same answer ([§8.2](/spec/#82-html-discovery)):

- The link has to be in the page's `<head>` in the HTML your server sends. Apps do not run JavaScript, so a link added by a script or a tag manager is not seen. Links in the `<body>` do not count.
- `rel` must include `alternate` and `type` must be `application/vnd.openajang+json`. Letter case does not matter. The file itself may still be served as `application/json`.
- A relative `href` is resolved against the page's final address after any redirects. A `<base>` element on the page is ignored for this purpose.
- A link without `href` is ignored.
- One event page points to one document. Repeated links that resolve to the same address are fine. Links to two different addresses make apps stop with an ambiguity error instead of guessing.
- The linked address must return the JSON directly. Apps will not follow it to another HTML page and look for a second link.
- The document's `url` should match the page's final address, or the page's canonical link. If it does not, apps report the mismatch as a relationship warning.

Only add this link to pages you control. Hosting a document about someone else's event does not make their page discoverable.

## Share the URL and check it

Before you share anything, check what your host actually sends. In a terminal:

```sh
curl -I https://your-community.github.io/events/build-night/event.openajang.json
```

Look for a `200` status and an accepted `content-type` line, for example:

```text
HTTP/2 200
content-type: application/json; charset=utf-8
access-control-allow-origin: *
```

If you added a discovery link, confirm it is in the HTML the server sends, without any scripts running:

```sh
curl -s https://example.org/events/build-night-november | grep -i openajang
```

<aside class="doc-note" aria-label="Validation and hosting">
<p class="doc-note-title">Validation and hosting</p>

The [validator](/validator/) checks the document itself: its fields, values and dates. It does not test your hosted response, your media type or your discovery link, so a file can pass the validator and still fail to import if it is hosted with the wrong type. Use `curl` for the hosting side and the validator for the content. To validate exactly what is online, fetch it with `curl -s <your JSON URL>` and paste the output into the validator.

</aside>

## What happens next

Share one of two addresses:

- your event page URL, if you added the discovery link,
- the JSON file URL, which always works.

Anyone using an app or directory that supports OpenAjang can import the event from either address. The app retrieves the document from your host, displays it with the right registration action, and may check it again later for changes. How often it checks is up to each app ([§8.3](/spec/#83-redirects-caching-and-refresh)).

Publishing the file does not put your event in any directory, create an event page for you, or notify anyone. There is no central OpenAjang registry to join. Directories are run independently and are optional; if one you use accepts OpenAjang URLs, you can submit your URL there. Passing validation does not mean a directory will list the event or that anyone has verified you as the organizer ([§10](/spec/#10-security-and-operational-requirements)).

Once people may have saved your event, keep the file up to date at the same address. [Keep an event current](/docs/keep-an-event-current/) covers changes, postponements and cancellations.

## Troubleshooting

### Wrong media type

`curl -I` shows `text/plain`, `text/html`, `application/octet-stream` or a login page. None of these is an accepted document response ([§3](/spec/#3-document-and-authoring-rules)).

- If the URL is a GitHub file view or "Raw" link, publish through GitHub Pages and use the Pages address.
- Many web servers choose the type from the file extension, so keep the `.json` ending. On your own server, map `.json` to `application/json` or `application/vnd.openajang+json`.
- If you see an HTML login or error page, the file is not public yet. Check the path and your host's visibility settings.

### Discovery link missing or ambiguous

An app accepts your JSON URL but not your event page URL.

- Run the `curl ... | grep -i openajang` check above. If nothing shows up, the link is probably added by JavaScript or sits outside `<head>`.
- Check that `type` is `application/vnd.openajang+json`. A link typed `application/json` is not an OpenAjang discovery link.
- If the app reports an ambiguity error, the page links to more than one distinct document. This often happens when a theme or plugin adds a link and you added another, or when a page that lists several events links each of them. Keep one link per event page, and link each event from its own page.

### Validator errors

Error locations are written as paths such as `/registration/url`, which means the `url` inside `registration`. Some checks stop at the first problem, so fix what is reported and validate again.

Common causes:

- `null` or `""` in an optional field. Remove the field ([§3](/spec/#3-document-and-authoring-rules)).
- A `$schema` value that is not exactly the 0.1 address.
- A date-time without seconds or without an offset, such as `2026-11-14T18:00`. Write `2026-11-14T18:00:00+08:00` ([§4.1](/spec/#41-timed-events)).
- A date-only `starts_at` with a timed `ends_at`, or the reverse. Both must use the same form ([§4.2](/spec/#42-calendar-dates-with-unpublished-clock-times)).
- `ends_at` earlier than `starts_at`.
- A placeholder such as `"TBA"` in the venue name, or a lowercase country code. For a venue not yet announced, set the venue `status` to `to_be_announced` and leave out `name`; write the country as two uppercase letters, such as `PH` ([§6.2](/spec/#62-location)).

### Redirects

Apps follow redirects, within limits: they should follow at most five, and should refuse a redirect from `https://` to `http://` ([§8.3](/spec/#83-redirects-caching-and-refresh)). Keep redirect chains short and on HTTPS. `curl -IL <URL>` shows every hop.

Redirects on your event page also affect discovery, because a relative `href` resolves against the final address. If `https://example.org/events/build-night` redirects to `https://example.org/events/build-night/`, then `href="event.openajang.json"` points into the `build-night/` folder on the final page, not the `events/` folder. A full `https://` address in `href` avoids the problem. For the same reason, write `url` exactly as the final address: apps treat `http` and `https`, or a trailing slash and none, as different addresses when comparing them ([§8.2](/spec/#82-html-discovery)).

If you later move the JSON file, redirect the old address to the new one so apps that saved it can follow, and update your discovery link. Moving the event to a different host should be confirmed by a redirect or an updated document at the old address ([§5.1](/spec/#51-identity)).

## Checklist

The spec defines two publisher roles ([§9](/spec/#9-extensions-versions-and-conformance)). A Basic Publisher keeps a stable hosted document with careful status and timestamp updates. A Discoverable Publisher does all of that and adds the head link.

### Basic Publisher

- The file is one UTF-8 JSON object with every required field and the exact `$schema` value ([§3](/spec/#3-document-and-authoring-rules), [§3.2](/spec/#32-core-properties)).
- Dates, times and values follow the document rules ([§3](/spec/#3-document-and-authoring-rules), [§3.2](/spec/#32-core-properties), [§4](/spec/#4-dates-and-time-precision), [§9](/spec/#9-extensions-versions-and-conformance)). Running it through the [validator](/validator/) is the recommended way to check.
- Unknown optional values should be omitted, and the file contains only public information ([§3](/spec/#3-document-and-authoring-rules), [§10](/spec/#10-security-and-operational-requirements)).
- It is served at a public URL with `application/vnd.openajang+json` or `application/json` ([§3](/spec/#3-document-and-authoring-rules)).
- The identity is stable: either an `id` you will keep, or a `url` that will not change, and never reused for another event ([§5.1](/spec/#51-identity)).
- `updated_at` advances on every real change to the event and stays the same otherwise ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)).
- Changes in status, such as a cancellation, are made in the same document at the same address ([§5.3](/spec/#53-updates-postponement-rescheduling-cancellation)). See [Keep an event current](/docs/keep-an-event-current/).

### Discoverable Publisher

- Everything in the Basic Publisher list.
- The event page you control has at least one `<link rel="alternate" type="application/vnd.openajang+json">` in its `<head>`, present without JavaScript ([§8.2](/spec/#82-html-discovery)).
- All such links resolve to a single distinct document address, and that address returns JSON directly ([§8.2](/spec/#82-html-discovery)).
- The document's `url` should match the page's final address or its canonical link ([§8.2](/spec/#82-html-discovery)).

## Next

- [Keep an event current](/docs/keep-an-event-current/): changes, postponements and cancellations after you publish.
- [Recurring, annual and multi-day events](/docs/recurring-annual-and-multi-day-events/): when to publish one document and when to publish several.
- [Specification](/spec/): the full rules behind this page.
