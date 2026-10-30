# Restructure the OpenAjang site docs into role-based guides

Date: 2026-10-30. Branch: `feat/project-page`. Site package: `packages/site`.

## Intent and why

The site has one `/docs/` page (`packages/site/src/pages/docs.astro`, about 760 lines).
It mixes publishing steps, feed and refresh rules for app developers, occurrence
boundaries, a conservative-interpretation table, evaluation material ("why another
format", "what it does not do"), extensions, SDKs and an FAQ. It reads as a pitch for the
protocol idea to three audiences at once.

The maintainer wants each reader to finish an article able to picture how OpenAjang
fits their own workflow or platform, and wants the docs to stop treating the format as
an experiment. The spec is real and implementable. It is still a `0.1` working draft, and
adoption and ease of use for organizers are still unproven; the docs say so once, plainly,
and otherwise teach.

Audiences (from `packages/site/PRODUCT.md`): organizers and developers are equally
important. "Developers" splits into platform developers (event software that exports
events) and app and directory builders (software that imports, stores, displays and
follows events). The README and spec §9 already name these roles.

## Goals

1. Replace the single docs page with 14 pages (listed below), grouped by reader role,
   each organized around a task with a visible outcome.
2. Keep every existing claim that was verified against the spec. Move it to the page
   where its reader needs it; do not restate it in several places. Shared rules live on
   one canonical page and other pages link to it.
3. Add the new content the restructure calls for (listed per page), all derived from
   `SPEC.md`, `FEEDS.md`, `CONVERSIONS.md`, `README.md`, `PUBLISHING.md`, the schema and
   the fixtures. Nothing is invented.
4. Keep the site's existing links working: the homepage, validator page, examples page
   and footer currently link to `/docs/#...` anchors.
5. A second model (GPT-6.1 Sol through T3 delegation) reviews every page before it is
   merged, in addition to a mechanical check (build, typecheck, link and anchor check,
   JSON-sample validation).

## Non-goals and anti-goals

- No change to `SPEC.md`, `FEEDS.md`, `CONVERSIONS.md`, the schema, the examples, the
  validator or the SDK packages. If a page exposes a spec ambiguity, record it in a list
  for the maintainer; do not "fix" it in the docs by inventing a rule.
- No new converters or mappings to Open Evnt or OpenTechEvents. The comparison with
  them is descriptive only.
- No search, versioned docs, i18n, comments, analytics or a redesign of the site. Only
  the layout additions listed under "Site changes".
- Failure even if it builds: a page that states a requirement the spec does not state,
  loosens a MUST into advice without saying so, or hardens a SHOULD into a MUST; a JSON
  sample that fails validation; a broken internal link; an unflagged unverified claim
  about a third-party project; marketing language or unexplained jargon aimed at
  organizers.

## Page list

Slugs are flat under `/docs/`. Source material is the current `docs.astro` section
unless noted. "New" means content that does not exist yet.

**Start**

1. `/docs/` Start here. Routes by role (organizer, platform developer, app or directory
   builder, evaluator), states the `0.1` working-draft status and what that means,
   one short "what this is". Replaces the current page. Includes the legacy-anchor
   redirect (see Site changes).

**Organizers**

2. `/docs/publish-your-first-event/` Write the document (required fields, optional
   `id`), host it (accepted media types, GitHub file-view and `text/plain` pitfall,
   CORS only matters for browser-based tools), optionally link it from the event page
   (HTML discovery rules), share the URL and check it (`curl -I`; the validator checks
   the document, not the hosted response), and a handoff: what to share and what
   happens next, without implying a distribution network exists. Ends with
   troubleshooting (wrong media type, ambiguous discovery links, validator errors) and
   a Basic Publisher / Discoverable Publisher checklist. Source: the current
   publishing section plus README "Publish your first event" and spec §3, §8.2, §9.
3. `/docs/keep-an-event-current/` Identity stays stable, moving an id-less event,
   postponed vs rescheduled, cancelled vs removed (`200` vs `410`), sold out is a
   ticket or registration state, advancing `updated_at`. Source: current step 4, FAQ
   sold-out answer, spec §5.
4. `/docs/recurring-annual-and-multi-day-events/` One document is one occurrence or
   one overall edition. Monthly meetups as separate documents grouped by `series`
   (spec §6.3: groups listings, does not generate recurrence or imply shared
   admission), new `id` for each annual edition, an overall conference vs separately
   importable workshops, hybrid and recordings. Source: current "Occurrence
   boundaries", spec §1.1, §5.1, §6.3. New: worked examples.

**Platform developers**

5. `/docs/export-from-your-platform/` Map event records to an OpenAjang document,
   assign stable ids, set `updated_at` only on material change, serve the endpoint,
   add the discovery link to the platform's event pages, keep the platform's own
   management features. Ends with a working discoverable endpoint. Optional last step:
   generate Schema.org JSON-LD and JSCalendar from the same record, including that
   JSCalendar declines date-only, no-`ends_at` and postponed events. Ends with a
   checklist. Source: README table, spec §3 to §8, `CONVERSIONS.md`, current
   conversions table and FAQ. New: the walkthrough.

**App and directory builders**

6. `/docs/resolve-and-import-a-url/` Accept a URL, retrieve it, discover from HTML,
   redirects and limits, security (spec §10), provenance fields, relationship
   warnings. URL Resolver checklist. Source: current provenance section, spec §8, §10,
   `PUBLISHING.md` resolver limits.
7. `/docs/store-and-refresh-events/` Identity and source continuity, the refresh
   outcome table, `updated_at` vs HTTP validators vs retrieval time, saved events keep
   refreshing after leaving a feed, rediscovery. Storing Consumer checklist. Source:
   current refresh table, spec §5, §8.3.
8. `/docs/display-an-imported-event/` The conservative-interpretation table turned into
   concrete display cases: unknown hours (date-only), timezone offsets, past events
   that are still `scheduled`, postponed attendance, registration actions by status,
   ticket and price display, stale availability, TBA venues, source attribution.
   Source: current table, spec §1.1, §4, §5.2, §7. New: display examples. Examples
   are described in prose or small markup; no screenshots or invented UI.
9. `/docs/directory-feeds/` Following a directory feed (verify entry id equals
   document id, separate provenance, direct refresh, omission is not cancellation, the
   three clocks) and running one (feed contract, entry summary, retention, Atom
   service checklist). Source: current feed section, `FEEDS.md`.

**Developers**

10. `/docs/sdks-and-tools/` `@openajang/core` and `@openajang/resolver` install and
    usage, known limits, the Python reference CLI, and how to read the examples
    (provenance, past events, declined conversions). Source: current SDK and
    provenance sections, `PUBLISHING.md`. Uses only APIs already shown in the current
    docs page or the package READMEs.

**Evaluate and reference**

11. `/docs/why-openajang/` Why another format, what OpenAjang does not do, how it
    relates to Schema.org, iCalendar and JSCalendar (the current table), and a dated
    "as of October 2026" descriptive comparison with Open Evnt and OpenTechEvents.
    Contains one sentence of honest caveat that organizer ease of use is unproven.
    Source: current sections, README "Why another format?". New: peer comparison; see
    "Peer-format comparison".
12. `/docs/versioning-and-stability/` What `0.1` promises: the schema identifier is
    immutable once published, unknown schema ids are not silently accepted, how a
    breaking contract is introduced, SDK versions are separate from the schema version,
    media type is provisional. Source: spec §9, `PUBLISHING.md` "Maintaining versions".
    New page; states only what those sources state.
13. `/docs/extensions/` Namespaced keys, `unstable:` reserved, the stripping rule,
    the five experimental keys and their core fallbacks. Source: current extensions
    section, `experimental-extensions.md`, spec §9.
14. `/docs/reference/` Hub: spec, feed profile, conversion guide, schema, validator,
    examples, example provenance, test report, license note. The example-provenance
    text moves here. Source: current provenance section, README "Documentation" and
    "License".

## Peer-format comparison (page 11)

Descriptive only, dated, each fact linked to the peer's primary source, no ranking and
no claim of superiority. Facts known so far (fetched 2026-10-30; the maintainer should
re-verify before publishing, and some OpenTechEvents details came from automated page
summaries and must be re-read from the repo):

- Open Evnt (github.com/openevnt/evnt, v0.2 draft): single-event JSON document, media
  type `application/vnd.evnt+json`, `id` is the URL the document is fetched from,
  statuses `uncertain`, `cancelled`, `postponed`, extension "components" with
  reverse-DNS `$type`, per-field translations, an Index and a Manifest protocol for
  discovery, no registration or ticket fields (a link component), no defined update
  protocol beyond index `updatedAt` and `etag`.
- OpenTechEvents (github.com/OpenTechEvents/opentechevents-spec): early-stage, root
  READMEs say v0.4 is current while a v0.5 "deliberately BREAKING" draft exists;
  feed-oriented with a Git-repo template and CI that regenerates `.ics`, RSS and JSON
  feeds; wall-clock dates plus a timezone field; `offers` with numeric price and
  "absent means UNKNOWN, never free"; first-class CFP, speakers and eligibility;
  cancelled and postponed events must stay published; recurrence not modelled;
  media type undecided; discovery proposes `<link rel="alternate">` and a well-known
  path.
- Reasoning on conversion: not "they are drafts" (OpenAjang is one too). Decisions on
  adapters depend on demonstrated demand, semantic fit and maintenance capacity.

## Constraints

- Voice: plain and direct. Second person for organizers. Developer pages say what to do
  and cite the spec section. No em or en dashes, no stock AI phrasing, sentence-case
  headings, no bold-label bullets unless scanning is the point (tables of rules).
  Match the homepage and README tone. Non-normative pages say "should" or cite the
  spec section; they do not use capitalized RFC keywords as if normative.
- Every page cites the spec (or `FEEDS.md`, `CONVERSIONS.md`) section for each rule it
  restates, as a link to the site anchor.
- Every JSON sample is a complete valid document, or an explicitly labelled fragment.
  Complete samples validate with `python tools/openajang.py validate`.
- Internal links and anchors must all resolve in the built site.
- Existing site look and layout rules (`packages/site/DESIGN.md`, which is gitignored
  but present locally): flat surfaces, light and dark schemes, centered reading column,
  no new shadows.
- Commits use conventional commits with no trailers (maintainer preference).

## Site changes (the how, decided by me, not by the maintainer)

- Content: a new `guides` content collection of Markdown files under
  `packages/site/src/content/guides/`, frontmatter `title`, `description`, `section`,
  `order`. Routes via `src/pages/docs/[...slug].astro`. `docs.astro` is removed and
  `/docs/` is the Start page (a guide entry or a dedicated page).
- Layout: extend `Document.astro` (or a sibling layout) so a docs page has a left
  sidebar with grouped navigation (Start, Organizers, Platform developers, App and
  directory builders, Developers, Evaluate and reference) with the current page marked,
  and the page's own `h2` list below it as "On this page". Previous and next links at
  the foot are optional; the builder decides.
- Legacy anchors: the current page's anchors are linked from the homepage, validator,
  examples page and possibly outside the site. Update in-repo links to the new URLs. On
  `/docs/` add a small inline script that maps the old hashes to the new pages:
  `#publish-your-first-event`, `#refresh-and-provenance`, `#occurrence-boundaries`,
  `#conservative-interpretation`, `#what-openajang-does-not-do`, `#why-another-format`,
  `#extensions`, `#sdk-and-local-tools`, `#example-provenance-and-testing`, `#faq`.
  The FAQ's answers move to the pages whose topic they belong to.
- Navigation: header "Docs" link unchanged. Footer "Documentation" link unchanged.
  Homepage links to `/docs/#...` are updated. The homepage "For organizers" and "For
  developers" links point at the role's first guide.

## Process

1. Build the layout and collection first and alone (one worker), then ship the Start page
   and a trivial second page to prove navigation, anchors and the build.
2. Draft the remaining pages in parallel with subagents, one page (or tightly related
   pair) per subagent, each with the page's brief from this document and the list of
   source files. Each subagent writes only its own file.
3. Every page is reviewed by GPT-6.1 Sol (a separate delegated task per page, with the
   page, its sources and the constraints in this document; the reviewer checks facts
   against the spec, voice and flow, and reports problems without editing). Findings go
   back to the drafting subagent; a page merges only after the review round is clean or
   the remaining objections are recorded as the maintainer's call.
4. After merge: full build, typecheck, internal link and anchor check, JSON-sample
   validation, em-dash search, then a last Sol review of the Start page, the nav and the
   cross-page consistency.
5. Commits per logical unit with conventional commit messages and no trailers.

## Clarifications (settled after the builder check)

- **New examples are allowed.** "Nothing is invented" applies to claims about the spec,
  feeds, SDKs and third-party projects. Illustrative content is fine: new sample
  documents, a generic example platform and example records. Samples use `example.org`
  URLs and invented organizers, are labelled as examples, and complete documents must
  validate. Organizer-facing pages do not name or reuse the real events behind the eight
  fixtures; only the examples and provenance pages do.
- **Peer comparison (page 11).** The first step of drafting page 11 is a research pass
  that re-reads both projects' primary sources (spec files, not summaries) and links
  every fact. Describe OpenTechEvents' v0.4 and v0.5 state as it actually appears. The
  page carries an "as of" date. The final handoff lists it as "re-read from primary
  sources on <date>" so the maintainer can spot-check. It is not held back.
- **"Merges" means committed to `feat/project-page`** after its review is clean. If Sol
  cannot be reached, stop and tell the maintainer; never skip the second review
  silently. Cap each page at two review rounds; remaining disagreements are recorded as
  maintainer decisions.
- **Where the status statements go.** The `0.1` working-draft status is stated on the
  Start page, on page 12 and in the SDK release-candidate warning, because each is a
  factual statement of status in its context. The caveat that organizer ease of use is
  unproven appears only on page 11. No other page repeats either.
- **Page 12 (open question, see handoff).** Until the maintainer answers, page 12
  states only what the spec and `PUBLISHING.md` state, plus an explicit line that no
  further stability promise is made while `0.1` is a working draft.

## Left to the builder

Exact slugs if a better one reads more naturally, page length and section order inside
a page, whether pages are Markdown or Astro, sidebar visual details, whether to add
previous and next links, the wording of checklists (items must come from the spec's
requirements and cite their sections), how the Start page lays out the role routes.

## Calls I made that the maintainer should check

- The 14-page list and slugs, taken from the agreed list.
- Keeping one sentence of caveat about organizer ease of use on page 11 (the maintainer
  did not say whether to keep it; the second reviewer favored keeping honest
  uncertainty).
- The legacy-anchor script on `/docs/`.
- Moving FAQ answers into topic pages instead of keeping an FAQ page.
- The peer-format facts above, which need a maintainer re-check before publishing.
