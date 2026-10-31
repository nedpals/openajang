# @openajang/core

Optional TypeScript tools for OpenAjang. The standard can be used without this package.

The SDK is a release candidate intended for testing and feedback. Its API and validation behavior may change before `0.1.0`.
The package supports Node.js 22.18 and newer.

```sh
npm install @openajang/core@next
```

```ts
import { parseJsonStrict, validate } from '@openajang/core';

const event = validate(parseJsonStrict(json));
```

`validateSafe` returns a result instead of throwing. The package also exports the bundled schema and event types. Optional conversions (Schema.org, JSCalendar, and single-event iCalendar via `toICalendar`) and registration helpers are available from `@openajang/core/adapters`. Validation uses the bundled schema and additional checks described in the specification.

## Diagnostics

`validateSafe` returns `errors` as `{ code, path, message, params? }`. `path` is a JSON Pointer to the offending value. Every problem is collected rather than stopping at the first, and procedural rules run on any value the schema accepted.

- Schema problems use the JSON Schema keyword as `code` (`required`, `format`, `type`, ...) and pass the validator's `params` through, for example `{ missingProperty: 'title' }`.
- Procedural rules use stable codes: `end-before-start`, `end-precision-mismatch`, `registration-close-before-open`, `ticket-sales-end-before-start`, `ticket-id-duplicate`, `tag-duplicate`, `history-contains-current-start`, `placeholder-venue`.
- JSON syntax and unpaired-surrogate failures use the code `invalid` with an empty path.

Codes are the stable contract; `message` wording may change. Key any user-facing copy on `code`, and fall back to `message` for codes you do not recognize.

The implementation uses JavaScript `Intl` for time zones. URI, email, and language-tag checks are covered by a shared Python and TypeScript conformance corpus, but full equivalence is still work in progress. JSON numbers use JavaScript numeric precision; large values may lose precision.
