import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const packages = ['core', 'resolver'];
const ref = process.env.GITHUB_REF ?? '';
const match = /^refs\/tags\/sdk-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(ref);
if (!match || (match[4] && match[4].split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0')))) {
  throw new Error('Select a release tag such as sdk-v0.1.0 or sdk-v0.1.0-rc.1');
}
const version = ref.slice('refs/tags/sdk-v'.length);
const tag = match[4] ? 'next' : 'latest';
const directory = process.env.RELEASE_DIR;
if (!directory) throw new Error('RELEASE_DIR is required');

for (const name of packages) {
  const manifest = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'));
  if (manifest.name !== `@openajang/${name}` || manifest.version !== version) {
    throw new Error(`Tag ${ref} does not match @openajang/${name} version ${manifest.version}`);
  }
}

if (process.argv[2] === 'validate') {
  console.log(`Release ${version} (${tag})`);
} else if (process.argv[2] === 'publish') {
  const artifacts = packages.map(name => {
    const tarball = `${directory}/openajang-${name}-${version}.tgz`;
    const manifest = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
    if (manifest.name !== `@openajang/${name}` || manifest.version !== version) throw new Error(`Invalid tarball: ${tarball}`);
    if (name === 'resolver' && manifest.dependencies?.['@openajang/core'] !== version) {
      throw new Error('Resolver tarball must depend on the matching published core version');
    }
    return { tarball, manifest };
  });
  for (const artifact of artifacts) {
    const { tarball, manifest } = artifact;
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${encodeURIComponent(version)}`);
    if (response.status === 200) {
      const published = await response.json();
      const integrity = 'sha512-' + createHash('sha512').update(await readFile(tarball)).digest('base64');
      if (published.dist?.integrity !== integrity) throw new Error(`${manifest.name}@${version} exists with different contents`);
      artifact.published = true;
      console.log(`${manifest.name}@${version} already published with matching integrity; skipping`);
    } else if (response.status === 404) {
      artifact.published = false;
    } else {
      throw new Error(`Registry lookup failed for ${manifest.name}: HTTP ${response.status}`);
    }
  }
  for (const { tarball, published } of artifacts) {
    if (!published) execFileSync('npm', ['publish', tarball, '--access', 'public', '--tag', tag], { stdio: 'inherit' });
  }
} else {
  throw new Error('Expected validate or publish');
}
