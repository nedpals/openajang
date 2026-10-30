// Publishes the repo's canonical artifacts at their public URLs. The schema $id
// (https://openajang.nedpals.xyz/schema/0.1/event.json) must resolve, so the
// files are copied from the repo root instead of being kept in a second place.
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const pub = new URL('../public/', import.meta.url);

await rm(pub, { recursive: true, force: true });
await mkdir(pub, { recursive: true });

for (const name of ['schema', 'examples', 'generated', 'CNAME']) {
  await cp(fileURLToPath(new URL(name, root)), fileURLToPath(new URL(name, pub)), { recursive: true });
}
