function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(fn, name, message) {
  try {
    await fn();
  } catch (err) {
    assert(err && err.name === name, `${message}: expected ${name}, got ${err && err.name}`);
    return;
  }
  throw new Error(`${message}: expected ${name}, but the promise resolved`);
}

/**
 * Runtime-neutral checks. The caller passes the bundle from
 * build-runtime-bundle.mjs, so this module has no imports.
 */
export async function runSmoke({ core, resolver, fixture }) {
  let checks = 0;

  const valid = core.validateSafe(fixture);
  assert(valid.valid, 'fixture should validate');
  checks++;

  assert(
    !core.validateSafe({ ...fixture, title: '' }).valid,
    'empty title should be invalid'
  );
  checks++;

  const badEmail = {
    ...fixture,
    organizer: { ...fixture.organizer, email: 'event..host@example.org' }
  };
  assert(!core.validateSafe(badEmail).valid, 'consecutive-dot email should be invalid');
  checks++;

  assertEqual(
    core.parseJsonStrict('{"a":1}').a,
    1,
    'strict JSON parsing should work'
  );
  checks++;

  const documentText = JSON.stringify(fixture);
  const stubTransport = {
    async request() {
      return {
        status: 200,
        headers: { 'content-type': 'application/vnd.openajang+json' },
        text: documentText
      };
    }
  };
  const resolved = await resolver.resolveOpenAjang('https://example.org/event.json', {
    transport: stubTransport
  });
  assertEqual(resolved.event.title, fixture.title, 'stub transport should resolve');
  checks++;

  const fetchTransport = resolver.createFetchTransport({
    fetch: async () =>
      new Response(documentText, {
        status: 200,
        headers: { 'content-type': 'application/vnd.openajang+json' }
      })
  });
  const fetched = await resolver.resolveOpenAjang('https://example.org/event.json', {
    transport: fetchTransport
  });
  assertEqual(fetched.event.title, fixture.title, 'fetch transport should resolve');
  checks++;

  const privateTransport = resolver.createFetchTransport({
    dnsLookup: async () => [{ address: '127.0.0.1', family: 4 }],
    fetch: async () => {
      throw new Error('private destination must not be fetched');
    }
  });
  await assertRejects(
    () =>
      resolver.resolveOpenAjang('https://public.example/event.json', {
        transport: privateTransport
      }),
    'ResolverSecurityError',
    'private DNS answer should be rejected'
  );
  checks++;

  return { checks };
}
