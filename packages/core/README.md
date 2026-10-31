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

`validateSafe` returns `errors` as `{ code, path, message, params? }`, where `path` is a JSON Pointer to the offending value. All problems are collected, and rule checks run on every value the schema accepted.

- Schema problems use the JSON Schema keyword as `code` (`required`, `format`, `type`) and pass the validator's `params` through, such as `{ missingProperty: 'title' }`.
- Rule checks have stable codes: `end-before-start`, `end-precision-mismatch`, `registration-close-before-open`, `ticket-sales-end-before-start`, `ticket-id-duplicate`, `tag-duplicate`, `history-contains-current-start`, `placeholder-venue`.
- JSON syntax and unpaired-surrogate failures use `invalid` with an empty path.

Codes are the stable contract and `message` wording may change, so key any user-facing text on `code`.

The implementation uses JavaScript `Intl` for time zones. URI, email, and language-tag checks are covered by a shared Python and TypeScript conformance corpus, but full equivalence is still work in progress. JSON numbers use JavaScript numeric precision; large values may lose precision.
