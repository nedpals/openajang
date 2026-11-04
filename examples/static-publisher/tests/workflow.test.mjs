import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  cp,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:http";

const root = process.cwd();
test("build and deployed verification preserve revisions and reject stale data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "openajang-publish-"));
  let server;
  try {
    for (const name of ["build.mjs", "verify.mjs", "event.openajang.json"])
      await cp(join(root, name), join(dir, name));
    await symlink(
      resolve(root, "node_modules"),
      join(dir, "node_modules"),
      "dir",
    );
    const build = () =>
      spawnSync(process.execPath, ["build.mjs"], {
        cwd: dir,
        encoding: "utf8",
      });
    assert.equal(build().status, 0);
    const first = await readFile(
      join(dir, "dist", "event.openajang.json"),
      "utf8",
    );
    assert.equal(build().status, 0);
    assert.equal(
      await readFile(join(dir, "dist", "event.openajang.json"), "utf8"),
      first,
    );
    const event = JSON.parse(first);
    event.location.physical.name = "New venue";
    event.updated_at = "2026-10-29T10:00:00Z";
    await writeFile(join(dir, "event.openajang.json"), JSON.stringify(event));
    assert.equal(build().status, 0);
    assert.match(
      await readFile(join(dir, "dist", "index.html"), "utf8"),
      /New venue/,
    );
    event.status = "cancelled";
    event.updated_at = "2026-10-30T10:00:00Z";
    await writeFile(join(dir, "event.openajang.json"), JSON.stringify(event));
    assert.equal(build().status, 0);
    const html = await readFile(join(dir, "dist", "index.html"), "utf8");
    assert.match(html, /cancelled/);
    assert.doesNotMatch(
      html,
      /href="https:\/\/community\.example\.org\/events\/build-night-2026-11\/register"/,
    );
    assert.equal(
      JSON.parse(
        await readFile(join(dir, "dist", "event.openajang.json"), "utf8"),
      ).id,
      event.id,
    );
    server = createServer(async (req, res) => {
      const file = req.url === "/" ? "index.html" : "event.openajang.json";
      res.setHeader(
        "Content-Type",
        file.endsWith(".json") ? "application/json" : "text/html",
      );
      res.end(await readFile(join(dir, "dist", file)));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const verify = () =>
      new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          ["verify.mjs", `http://127.0.0.1:${server.address().port}/`],
          { cwd: dir, stdio: "ignore" },
        );
        child.on("exit", resolve);
      });
    assert.equal(await verify(), 0);
    event.title = "Updated locally only";
    await writeFile(join(dir, "event.openajang.json"), JSON.stringify(event));
    assert.notEqual(await verify(), 0);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
