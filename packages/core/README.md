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

`validateSafe` returns a result instead of throwing. The package also exports the bundled schema and event types. Optional conversions and registration helpers are available from `@openajang/core/adapters`. Validation uses the bundled schema and additional checks described in the specification.

The implementation uses JavaScript `Intl` for time zones. URI, email, and language-tag checks are covered by a shared Python and TypeScript conformance corpus, but full equivalence is still work in progress. JSON numbers use JavaScript numeric precision; large values may lose precision.
