/** Hash changes are not cancellable. Restore the accepted URL before the app router runs. */
export function createHashExitGuard(
  browser: Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener">,
  shouldBlock: () => boolean,
  onAttempt: (url: string) => void,
) {
  let accepted = browser.location.href
  let leaving = false
  const check = () => {
    if (browser.location.href === accepted) return false
    if (leaving || !shouldBlock()) {
      accepted = browser.location.href
      leaving = false
      return false
    }
    const destination = browser.location.href
    browser.history.replaceState(browser.history.state, "", accepted)
    onAttempt(destination)
    return true
  }
  const change = (event: Event) => {
    if (check()) event.stopImmediatePropagation()
  }
  browser.addEventListener("hashchange", change, true)
  return {
    check,
    leave(url: string) {
      leaving = true
      browser.location.assign(url)
    },
    dispose() {
      browser.removeEventListener("hashchange", change, true)
    },
  }
}
