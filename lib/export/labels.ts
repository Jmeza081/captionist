import { providerOf } from '@/lib/gifs/allow'
import { descriptorFor } from '@/lib/gifs/descriptors'
import type { Artefact, Capability, DeliverOutcome, FailureReason } from './types'

/**
 * Every word the export feature says, in one place.
 *
 * The label is decided by what the device can do, never by what it is — the
 * rule ADR 0033 set for the lobby's share key, applied to a file: a phone
 * whose sheet takes files gets "Share", a laptop gets "Copy" or "Save", and
 * the server, which can detect nothing, gets the laptop's word so the first
 * paint and the hydrated one agree.
 */

export function idleLabel(artefact: Artefact, capability: Capability): string {
  if (artefact === 'gif') return capability.canShareFiles ? 'Share GIF' : 'Save GIF'
  if (capability.canShareFiles) return 'Share image'
  return capability.canWriteImage ? 'Copy image' : 'Save image'
}

/**
 * The label while the encoder runs. The count is the point — a blocked key
 * says what is missing, and here what is missing is forty-eight frames.
 */
export function progressLabel(done: number, total: number): string {
  if (total <= 1) return 'Rendering…'
  return `Rendering ${Math.min(done, total)} of ${total}…`
}

/**
 * After a share sheet refused a gesture that went stale mid-render. The file
 * is made; one more tap sends it.
 */
export function readyLabel(artefact: Artefact): string {
  return artefact === 'gif' ? 'Send GIF' : 'Send image'
}

export function memeFilename(round: number, entryIndex?: number): string {
  const entry = entryIndex === undefined ? '' : `-entry-${entryIndex}`
  return `captionist-round-${round}${entry}.gif`
}

export function standingsFilename(code: string): string {
  return `captionist-standings-${code}.png`
}

/**
 * Whose picture this is, in the word the mark uses.
 *
 * Derived from the URL rather than stored, the way `providerOf` already
 * decides it for chat: a GIF picked before a provider swap is still credited
 * to whoever served it. `undefined` for the app's own art, which is credited
 * to nobody — the rule ADR 0020 set for the offline shelf.
 */
export function markFor(src: string | undefined): string | undefined {
  if (!src) return undefined
  const provider = providerOf(src)
  return provider ? descriptorFor(provider)?.name : undefined
}

/**
 * The snackbar, or nothing.
 *
 * A sheet that opened is its own confirmation and a cancelled one is somebody
 * changing their mind, so both say nothing. Everything invisible says what
 * happened and, where it helps, what to do next.
 */
export function messageFor(
  artefact: Artefact,
  outcome: DeliverOutcome,
  reason?: FailureReason,
): string | undefined {
  const thing = artefact === 'gif' ? 'GIF' : 'image'
  switch (outcome) {
    case 'shared':
    case 'cancelled':
      return undefined
    case 'saved':
      return artefact === 'gif' ? 'GIF saved' : 'Image saved'
    case 'copied':
      return 'Image copied — paste it into Slack'
    case 'expired':
      return `${artefact === 'gif' ? 'GIF' : 'Image'} is ready. Tap again to share it.`
    case 'failed':
      if (reason === 'source') return `Couldn’t fetch that ${thing}. Try again.`
      if (reason === 'clipboard') return 'Couldn’t copy it. Save it instead.'
      return artefact === 'gif'
        ? 'Couldn’t render that GIF. Try again.'
        : 'Couldn’t render the scoreboard. Try again.'
  }
}
