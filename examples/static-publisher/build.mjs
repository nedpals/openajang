import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseJsonStrict, validateSafe } from "@openajang/core";
import { registrationAction } from "@openajang/core/adapters";

const source = await readFile("event.openajang.json", "utf8");
const result = validateSafe(parseJsonStrict(source));
if (!result.valid) {
  for (const error of result.errors)
    console.error(`${error.path || "/"}: ${error.message}`);
  process.exit(1);
}
const e = result.event;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const url = (s) => {
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
};
const action = registrationAction(e);
const location =
  [
    e.location.physical?.name,
    e.location.physical?.address?.locality,
    e.location.virtual?.platform,
  ]
    .filter(Boolean)
    .join(" · ") || "See event details";
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(e.title)}</title><link rel="alternate" type="application/vnd.openajang+json" href="./event.openajang.json">
<style>body{font:1rem/1.6 system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem}a{color:#075a9e}p{white-space:pre-wrap}</style>
</head><body><main><h1>${esc(e.title)}</h1>
<p><strong>Status:</strong> ${esc(e.status)}${e.status_note ? `: ${esc(e.status_note)}` : ""}</p>
<p><strong>When:</strong> ${esc(e.starts_at)}${e.ends_at ? ` to ${esc(e.ends_at)}` : ""}${!e.starts_at.includes("T") ? " (hours not published)" : ""}</p>
<p><strong>Where:</strong> ${esc(location)}</p><p><strong>Organizer:</strong> ${esc(e.organizer.name)}</p>
${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${e.description ? `<p>${esc(e.description)}</p>` : ""}
${action && url(action.url) ? `<p><a href="${esc(url(action.url))}">${esc(action.label)}</a></p>` : ""}
<p><a href="./event.openajang.json">Event data</a></p></main></body></html>\n`;
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);
await writeFile("dist/event.openajang.json", source);
console.log("Built dist/index.html and dist/event.openajang.json");
