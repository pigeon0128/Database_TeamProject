import test, { after } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve, sep } from "node:path"

const tempBase = resolve(tmpdir())
const directory = await mkdtemp(join(tempBase, "doroland-artwork-test-"))
process.env.UPLOAD_DIR = directory
const { artworkFileExists, saveFile } = await import("../server/storage.js")
after(async () => {
  assert.ok(directory.startsWith(tempBase + sep))
  assert.ok(
    directory
      .substring(tempBase.length + 1)
      .startsWith("doroland-artwork-test-"),
  )
  await rm(directory, { recursive: true, force: true })
})

test("only a nonempty stored file is eligible for myroom exhibition", async () => {
  assert.equal(await artworkFileExists("artworks/1/missing.png"), false)
  await saveFile("artworks/1/empty.png", Buffer.alloc(0))
  assert.equal(await artworkFileExists("artworks/1/empty.png"), false)
  await saveFile("artworks/1/complete.png", Buffer.from("test fixture"))
  assert.equal(await artworkFileExists("artworks/1/complete.png"), true)
})

test("directories and paths outside the upload store never qualify", async () => {
  await mkdir(join(directory, "directory"))
  assert.equal(await artworkFileExists("directory"), false)
  assert.equal(await artworkFileExists("../outside.png"), false)
})
