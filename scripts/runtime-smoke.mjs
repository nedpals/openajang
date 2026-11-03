import { runSmoke } from './runtime-smoke-lib.mjs';

const bundle = new URL('../node_modules/.cache/openajang-runtime/bundle.mjs', import.meta.url).href;
const module = await import(bundle);
const result = await runSmoke(module);
console.log(`runtime smoke passed: ${result.checks} checks`);
