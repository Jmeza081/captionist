/**
 * The vocabulary the export modules share.
 *
 * Kept apart from the modules that touch the DOM so the pure ones — budget,
 * layout, labels — import nothing that needs a browser, and Vitest can cover
 * them under Node.
 */

/** What is being made: a re-encoded animation, or a picture of a table. */
export type Artefact = 'gif' | 'png'

/**
 * What this device can do with a file, decided once per session.
 *
 * `canShareFiles` is `navigator.canShare({ files })` — narrower than
 * `navigator.share` itself, which every phone has for a URL and only some
 * have for a file. `canWriteImage` is a `ClipboardItem` that takes a PNG.
 */
export interface Capability {
  canShareFiles: boolean
  canWriteImage: boolean
}

/**
 * What actually happened, so the caller can confirm it in the right words —
 * or say nothing, which is what an opened sheet and a cancelled one deserve.
 *
 * `expired` is the one the share sheet adds: the user's tap authorised a
 * share, the render took longer than the browser's activation window, and the
 * sheet refused to open for a gesture that had gone stale. The file is ready;
 * it needs a second tap, and the label says so.
 */
export type DeliverOutcome = 'shared' | 'saved' | 'copied' | 'cancelled' | 'expired' | 'failed'

/** Why a render failed, for the one line the snackbar gets to say. */
export type FailureReason = 'source' | 'render' | 'clipboard'

/** Progress through an encode, for the label that counts it. */
export interface Progress {
  done: number
  total: number
}
