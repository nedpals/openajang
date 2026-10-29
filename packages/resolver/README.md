# @openajang/resolver

Optional Node.js URL discovery and retrieval for OpenAjang. The standard does not require this package.

The SDK is a release candidate intended for testing and feedback. Its API may change before `0.1.0`, and additional security testing is planned for network retrieval.
The package supports Node.js 22.18 and newer.

```sh
npm install @openajang/resolver@next
```

```ts
import { resolveOpenAjang } from '@openajang/resolver';

const { event, provenance, relationshipWarnings } = await resolveOpenAjang(url);
```

The resolver restricts destinations, follows bounded redirects, and limits response size and retrieval time. `allowPrivateIps` permits private destinations and should only be used in trusted environments. Browser clients need their own retrieval and CORS policy.

Each call is a one-shot retrieval. The resolver does not store events, cache responses, perform conditional refresh, or verify source continuity between revisions. Applications that save events must implement those responsibilities and the lifecycle and removal policies in the specification.
