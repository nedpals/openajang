# Publishing and implementation notes

The public entry point is [README.md](README.md). The contract version is declared
in [SPEC.md](SPEC.md); filenames remain stable between releases.

## Repository contents

- [Core specification](SPEC.md)
- [Optional Atom feed profile](FEEDS.md)
- [Informative conversion guide](CONVERSIONS.md)
- [Document schema](schema/0.1/event.json)
- [Experimental example extensions](experimental-extensions.md)
- [Validation and scenario report](TEST-REPORT.md)

`examples/` contains eight event fixtures and illustrative Atom/RSS feeds.
`generated/` contains derived Schema.org and supported JSCalendar outputs, plus
conversion diagnostics. `tools/` and `tests/` contain local reference helpers and
regression tests. These are not a deployed authoring website, directory, or app.

## Example provenance

The real event names, dates, URLs, prices, and availability came from supplied
example data. They have not been rechecked against live organizer sites. The
fixtures identify `Example fixture publisher` and use an illustrative revision
instant of `2026-10-29T08:00:00Z`. That timestamp describes these example
representations; it does not certify that the source facts are current.

Past events intentionally retain their supplied lifecycle status to test the
distinction between publisher status and a consumer's past-event classification.
The examples do not demonstrate organizer authorization or HTML discovery on the
real websites. Their Event URLs do not prove those sites support OpenAjang.
Feed Document URLs use `example.org` placeholders and are not live endpoints.

## Run the local tools

Use Python 3.11 or newer from the repository root:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python tools/openajang.py validate examples/*.openajang.json
python tools/openajang.py generate
python tools/generate_example_feeds.py
python -m unittest discover -s tests -v
```

Generation validates inputs first. Unsupported calendar conversions are declined
explicitly and recorded in `generated/conversion-diagnostics.json`. The example
feed generator uses fixed illustrative timestamps for reproducibility; it is not
a live publisher's timestamp implementation.

## Validation and resolver limits

The schema uses custom `oa-*` format annotations that generic schema tools may
ignore. Full document validation needs the bundled format checker and procedural
checks. The validator uses installed ISO code and timezone data plus language-tag
and URI syntax libraries. It does not fetch remote schemas or make network calls.

The bounded HTML discovery helper uses Python's HTMLParser and explicit `<head>`
links; it is not a complete HTML5 parser. The refresh-decision helper assumes its
caller has checked source continuity and HTTP behavior. Production services need
integration-tested fetching, conditional requests, redirects, caching, SSRF/DNS
rebinding protection, isolation, moderation, and notification behavior.

## Publish the specification

1. Publish the specification as a working draft, keeping the optional feed profile
   and informative conversion guide separate.
2. Deploy `schema/0.1/event.json` at the public HTTPS URL declared in its `$id`.
   The source file has a stable local path; the public URL is versioned. Serve it
   as `application/schema+json` where available. Once published, do not reuse that
   identifier for an incompatible contract.
3. Serve event JSON as `application/json` or the provisional vendor media type.
   Publish fixtures as examples with their provenance notice.
4. Replace placeholder feed URLs before using the sample feeds as working feeds.
   Use genuine service identity and publication/update timestamps.
5. Add discovery links only to pages you control. Hosting a separate document does
   not automatically make another organization's page discoverable.
6. Choose your project's license and ownership notices before public distribution.
   This package does not invent a license or grant rights over source event data.

## Maintaining versions

The schema's `$id` is the runtime source of the supported contract identifier.
The validator loads `schema/0.1/event.json` and derives `SCHEMA_URL` from it; its Python
source has no separately hardcoded release number.

For a new incompatible contract, update the schema `$id`, its matching instance
`$schema` constant, the version declaration in SPEC.md, and the identical schema URL
in documentation examples and event fixtures. Regenerate outputs and rerun tests.
A search for the old **full schema URL** locates contract references without
modifying unrelated dependency or standards versions.

Keep previously published schema contracts available at their original public URLs.
Use repository tags or release archives to preserve historical source snapshots.

## Release the TypeScript packages

The SDK is optional: OpenAjang publishers and consumers do not need an npm package.
The two SDK packages use the same version, independently of the schema version.
Update both package versions together, update the lockfile, and commit the changes.
After checks pass, create a tag on that commit named `sdk-v<version>` (for example,
`sdk-v0.1.0-rc.1`). Manually run **Release SDK** in GitHub Actions and select that tag.
The tag must include the release workflow. Prereleases use npm's `next` tag; stable
versions use `latest`.

The workflow verifies the tag and versions, runs the TypeScript and Python checks,
packs and smoke-tests both packages, and publishes core before resolver. A retry skips
an existing version only if its registry integrity matches the locally built tarball;
a mismatch or registry error stops the release.

Before the first release, ensure the `@openajang` npm scope is controlled by the
publisher. Configure a trusted publisher for each package with GitHub owner `nedpals`,
repository `openajang`, workflow filename `release.yml`, and environment `npm`.
For packages that do
not yet exist, follow npm's package-creation procedure for trusted publishing or its
first-publish instructions. The workflow uses GitHub OIDC, not an npm token. Set up
trust close to the release: unvalidated npm trusted-publisher configurations expire.
Do not run the publishing workflow until the documented validator limitations and
release contents have been reviewed.
