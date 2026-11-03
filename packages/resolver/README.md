# @openajang/resolver

Optional URL discovery and retrieval for OpenAjang. The standard does not require this package.

The SDK is a release candidate intended for testing and feedback. Its API may change before `0.1.0`, and additional security testing is planned for network retrieval.

```sh
npm install @openajang/resolver@next
```

```ts
import { resolveOpenAjang } from '@openajang/resolver';

const { event, provenance, relationshipWarnings } = await resolveOpenAjang(url);
```

The package runs in Node.js 22 and newer, Deno, Bun, Cloudflare Workers, and browsers. It has no runtime `node:*` imports in its portable entry. Node resolves the default import to a hardened entry that keeps the existing DNS-pinning and socket-destination checks. Bun and Deno select the Fetch entry through their package conditions.

## Entry points

- `@openajang/resolver` uses the Node transport in Node and the Fetch transport everywhere else.
- `@openajang/resolver/node` always uses the Node transport.
- `@openajang/resolver/fetch` always uses the Fetch transport.

```ts
import { resolveOpenAjang, createNodeTransport } from '@openajang/resolver/node';
import { createFetchTransport } from '@openajang/resolver/fetch';
```

Both transports accept an optional `dnsLookup` for pre-flight checks. `ResolverOptions.transport` replaces the transport entirely, and `ResolverOptions.validateRedirect` adds a caller check to every redirect.

## SSRF protection differs by runtime

The resolver checks URL syntax, credentials, forbidden protocols, private hostnames, and private IP literals on every hop.

The Node transport also resolves DNS, rejects every non-public answer, pins the connection to the checked addresses, and verifies the actual socket destination against rebinding. This is the strongest mode and is the default in Node.

The Fetch transport cannot inspect the connected address or pin DNS. When you pass a `dnsLookup`, it checks every answer before the request, but a time-of-check/time-of-use window remains. On runtimes with platform egress controls, such as Cloudflare Workers, the platform is responsible for blocking private network access. Do not treat the Fetch transport as equivalent to the Node transport for untrusted destinations.

Network failures are not normalized across transports. Node passes through its native error, while the Fetch transport throws `ResolverDiscoveryError` for connection and stream failures.

`allowPrivateIps` permits private destinations and should only be used in trusted environments. Browser clients also need the remote host to allow cross-origin reads, and browsers cannot follow redirects with `redirect: 'manual'`. A redirect in a browser context returns a clear error, so resolve those URLs on a server.

The resolver follows bounded redirects, rejects HTTPS-to-HTTP downgrades, and limits response size and retrieval time. Defaults are a 1 MiB document limit, five redirects, and a 10-second deadline covering DNS, redirects, and the response body.

## Provenance and lifecycle

Each call is a one-shot retrieval. The resolver does not store events, cache responses, perform conditional refresh, or verify source continuity between revisions. Applications that save events must implement those responsibilities and the lifecycle and removal policies in the specification.

Provenance distinguishes `finalFetchedUrl` (the supplied URL after redirects), `documentUrl` (the retrieved JSON endpoint), and `declaredEventUrl` (the event page URL claimed by the document). For direct JSON, the first two are the same. A declared URL does not by itself establish authority or endorsement.
