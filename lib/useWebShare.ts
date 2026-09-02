'use client'

import { useSyncExternalStore } from 'react'

/**
 * What sharing a room link does on this device.
 *
 * The lobby has always had two share keys, and until now both did the same
 * thing: copy the URL. On a laptop that is right — there is nowhere else for a
 * link to go, and the clipboard is where you paste it into Slack from. On a
 * phone it is the wrong half of the operating system: the OS already owns a
 * sheet listing Slack, Messages, AirDrop and everything else installed, and
 * "Link copied — paste it into Slack" asks somebody to go and find Slack
 * themselves for a link the OS would have handed straight to it.
 *
 * So the key opens the share sheet where there is one, and copies where there
 * is not.
 */
export interface WebShare {
  /**
   * Whether `navigator.share` exists here.
   *
   * **False on the server, always.** There is no navigator there, and a button
   * whose label came out of feature detection during SSR is a hydration
   * mismatch on every phone. It settles on the client's first commit, long
   * before anybody has read the button.
   */
  supported: boolean
  /**
   * Opens the sheet, or copies. Resolves to what actually happened, so the
   * caller can confirm it in the right words — or say nothing at all, which is
   * what a cancelled sheet deserves.
   */
  share: (payload: { title: string; text: string; url: string }) => Promise<ShareOutcome>
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Whether the OS sheet exists, as an external store.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, for the reason
 * `useReducedMotion` gives: the navigator is an external system, and reading
 * one into state from an effect is the cascading render React 19 objects to.
 * Nothing ever changes it mid-session, so `subscribe` has nothing to listen to
 * and returns a no-op teardown.
 */
function subscribe() {
  return () => {}
}

const hasShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

const noShareOnTheServer = () => false

export function useWebShare(): WebShare {
  const supported = useSyncExternalStore(subscribe, hasShare, noShareOnTheServer)

  const share = async (payload: {
    title: string
    text: string
    url: string
  }): Promise<ShareOutcome> => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload)
        return 'shared'
      } catch (error) {
        /*
          Dismissing the sheet rejects with `AbortError`, which is not a
          failure — it is somebody changing their mind, and a snackbar reading
          "Couldn't share" over the top of a deliberate cancel is the app
          arguing with them. Anything else falls through to the clipboard,
          because a sheet that refused to open is exactly when the old
          behaviour is wanted.
        */
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      }
    }

    try {
      await navigator.clipboard?.writeText(payload.url)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  return { supported, share }
}
