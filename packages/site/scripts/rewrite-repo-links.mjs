// Repo documents link to each other by filename; on the site those become pages.
const PAGES = { 'SPEC.md': '/spec/', 'FEEDS.md': '/feeds/', 'CONVERSIONS.md': '/conversions/' };
const REPO = 'https://github.com/nedpals/openajang/blob/master/';

function rewrite(url) {
  const [path, hash = ''] = url.split(/(?=#)/);
  if (PAGES[path]) return PAGES[path] + hash;
  if (/^[\w./-]+\.md$/.test(path)) return REPO + path + hash;
  return url;
}

function walk(node) {
  if (node.type === 'link' && !/^[a-z][a-z0-9+.-]*:|^[#/]/i.test(node.url)) node.url = rewrite(node.url);
  node.children?.forEach(walk);
}

export const rewriteRepoLinks = () => walk;
