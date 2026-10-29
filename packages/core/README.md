# @openajang/core

Optional TypeScript tools for OpenAjang. The standard can be used without this package.

The SDK is a release candidate intended for testing and feedback. Its API and validation behavior may change before `0.1.0`.

```sh
npm install @openajang/core@next
```

```ts
import { parseJsonStrict, validate } from '@openajang/core';

const event = validate(parseJsonStrict(json));
```

`validateSafe` returns a result instead of throwing. The package also exports the bundled schema and event types. Optional conversions and registration helpers are available from `@openajang/core/adapters`. Validation uses the bundled schema and additional checks described in the specification.

The current implementation uses JavaScript `Intl` for language tags and time zones, and its URI and email checks do not cover every valid form accepted by the specification. JSON numbers use JavaScript numeric precision. Treat full document-validator conformance as work in progress.
