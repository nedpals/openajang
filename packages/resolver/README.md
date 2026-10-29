# @openajang/resolver

Optional Node.js URL discovery and retrieval for OpenAjang. The standard does not require this package.

```ts
import { resolveOpenAjang } from '@openajang/resolver';

const { event, provenance, relationshipWarnings } = await resolveOpenAjang(url);
```

The resolver restricts destinations, follows bounded redirects, and limits response size and retrieval time. `allowPrivateIps` permits private destinations and should only be used in trusted environments. Browser clients need their own retrieval and CORS policy.
