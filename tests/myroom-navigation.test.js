import test from "node:test"
import assert from "node:assert/strict"
import { createHashExitGuard } from "../src/features/myroom/hooks/hashExitGuard.ts"

test("dirty hash/back attempts stay in the room until confirmed, while clean exits pass through", () => {
  let listener,
    dirty = true,
    attempt = null,
    stopped = false,
    assigned = null
  const browser = {
    location: {
      href: "http://localhost/#/myroom",
      assign(url) {
        assigned = url
      },
    },
    history: {
      state: { preserved: true },
      replaceState(state, _title, url) {
        assert.deepEqual(state, { preserved: true })
        browser.location.href = url
      },
    },
    addEventListener(name, fn, capture) {
      assert.equal(name, "hashchange")
      assert.equal(capture, true)
      listener = fn
    },
    removeEventListener(name, fn, capture) {
      assert.equal(fn, listener)
      assert.equal(capture, true)
      listener = null
    },
  }
  const guard = createHashExitGuard(
    browser,
    () => dirty,
    (url) => {
      attempt = url
    },
  )
  browser.location.href = "http://localhost/#/studio"
  listener({
    stopImmediatePropagation() {
      stopped = true
    },
  })
  assert.equal(stopped, true)
  assert.equal(browser.location.href, "http://localhost/#/myroom")
  assert.equal(attempt, "http://localhost/#/studio")
  guard.leave(attempt)
  assert.equal(assigned, attempt)
  browser.location.href = assigned
  stopped = false
  listener({
    stopImmediatePropagation() {
      stopped = true
    },
  })
  assert.equal(stopped, false)
  dirty = false
  browser.location.href = "http://localhost/#/"
  listener({
    stopImmediatePropagation() {
      stopped = true
    },
  })
  assert.equal(stopped, false)
  // The router can run first; it must check synchronously before updating React.
  dirty = true
  browser.location.href = "http://localhost/#/leaderboard"
  assert.equal(guard.check(), true)
  assert.equal(browser.location.href, "http://localhost/#/")
  assert.equal(attempt, "http://localhost/#/leaderboard")
  assert.equal(guard.check(), false) // second listener sees the restored route
  guard.dispose()
  assert.equal(listener, null)
})
