# Static event publisher example

Build a single-event site from an OpenAjang document. The build validates the document and produces a page and discoverable JSON. You need Node.js 22.18+ and npm to build it; the resulting files can be served by a static host. Replace the example event details and URLs before publishing.

1. Copy all files in this directory, including `.github/workflows/publish.yml`, into a new repository's root. The workflow uses the `main` branch; change it if needed.
2. Edit `event.openajang.json`: replace the placeholder details, set `url` to the final HTTPS event page URL including its trailing slash, and generate a fresh permanent ID once with `node -e "console.log('urn:uuid:'+crypto.randomUUID())"`. A GitHub Pages project URL is usually `https://OWNER.github.io/REPOSITORY/`.
3. Run `npm ci` and `npm run build`. Preview with `python3 -m http.server --directory dist 8000` and open `http://localhost:8000/`. Validation errors stop the build.
4. Push to GitHub. In Settings > Pages choose **GitHub Actions**. The workflow builds, deploys, and checks the live site. Pages availability depends on repository visibility and plan; see [GitHub's guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
5. Run `npm run verify -- https://OWNER.github.io/REPOSITORY/` to check the discovery link, JSON media type and validity, and whether the deployed document matches the source. If the deployment is still updating, try again. The check warns about missing CORS headers because browsers need them to read the document from another origin. Server-side consumers do not.

Share the page URL or its `event.openajang.json` URL. A `github.com/.../blob/` file view is HTML, not a document endpoint. Check your host serves JSON as `application/json` or `application/vnd.openajang+json`. Caches may delay updates.

## Updating

Edit the same source, validate and build, then commit and push. Keep the ID and advance `updated_at` on material changes. For a venue change, update `location`; for cancellation set `status` to `cancelled` and optionally add `status_note`. Keep the cancelled document available. A new edition gets a new ID. An unchanged rebuild does not alter `updated_at`. The build does not compare history or advance timestamps automatically; review them before publication. If the page moves, retain the ID and arrange redirects when possible.

The page shows only a few event fields, while the JSON contains the full document. Extend the template if visitors need to see other details. This example publishes one event and no feed. See the optional [publisher feed profile](https://github.com/nedpals/openajang/blob/master/FEEDS.md#6-publisher-feeds) for Atom generation and lifecycle requirements.
