import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { parseJsonStrict, validateSafe } from "@openajang/core";

const page = process.argv[2];
if (!page || !page.endsWith("/"))
  throw new Error("Pass the public event page URL ending in /");
const local = parseJsonStrict(await readFile("event.openajang.json", "utf8"));
const htmlResponse = await fetch(page, { cache: "no-store" });
if (!htmlResponse.ok) throw new Error(`Page: HTTP ${htmlResponse.status}`);
const html = await htmlResponse.text();
if (
  !html.includes(
    'rel="alternate" type="application/vnd.openajang+json" href="./event.openajang.json"',
  )
)
  throw new Error("Expected discovery link missing from page");
const response = await fetch(
  new URL("event.openajang.json", htmlResponse.url),
  { cache: "no-store" },
);
if (!response.ok) throw new Error(`Document: HTTP ${response.status}`);
const type = (response.headers.get("content-type") || "")
  .split(";")[0]
  .trim()
  .toLowerCase();
if (!["application/json", "application/vnd.openajang+json"].includes(type))
  throw new Error(`Unexpected document media type: ${type || "(missing)"}`);
const deployed = parseJsonStrict(await response.text());
const checked = validateSafe(deployed);
if (!checked.valid)
  throw new Error(
    `Deployed document is invalid: ${JSON.stringify(checked.errors)}`,
  );
if (!isDeepStrictEqual(deployed, local))
  throw new Error(
    "Deployed document differs from event.openajang.json; deployment or cache may be stale",
  );
if (deployed.url !== htmlResponse.url)
  console.warn(
    `Warning: document URL field ${deployed.url} differs from final page URL ${htmlResponse.url}`,
  );
if (!response.headers.get("access-control-allow-origin"))
  console.warn(
    "Warning: no Access-Control-Allow-Origin header; cross-origin browser clients may be unable to read the document",
  );
console.log(`Verified ${htmlResponse.url} and ${response.url} (${type})`);
