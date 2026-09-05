import type { Artefact, Capability, DeliverOutcome } from './types'

/**
 * Where a file goes on this device.
 *
 * The share sheet where it takes files, the clipboard where it takes images,
 * a download otherwise. Each is detected, never inferred from a user agent —
 * ADR 0033's rule for a link, applied to a file. Two of the three have
 * gesture rules worth knowing:
 *
 * - `navigator.share` must run inside the tap's activation window. A render
 *   that takes longer than that window makes the sheet throw
 *   `NotAllowedError`, which is reported as `expired` so the caller can keep
 *   the file and ask for one more tap.
 * - Safari's clipboard wants the `ClipboardItem` *constructed* during the
 *   gesture, with a promise for the bytes. `copyPng` takes a promise for that
 *   reason; call it synchronously from the click.
 */

const probeFile = () => new File([new Uint8Array(1)], 'probe.gif', { type: 'image/gif' })

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [probeFile()] })
  } catch {
    return false
  }
}

export function canWriteImage(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  )
}

export function capability(): Capability {
  return { canShareFiles: canShareFiles(), canWriteImage: canWriteImage() }
}

export async function shareFile(file: File, title: string): Promise<DeliverOutcome> {
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'AbortError') return 'cancelled'
      if (error.name === 'NotAllowedError') return 'expired'
    }
    return 'failed'
  }
}

export async function copyPng(blob: Blob | Promise<Blob>): Promise<DeliverOutcome> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function saveBlob(blob: Blob, filename: string): DeliverOutcome {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Not immediately: Safari starts the download after `click` returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}

export function mimeFor(artefact: Artefact): string {
  return artefact === 'gif' ? 'image/gif' : 'image/png'
}

/**
 * The file, delivered the best way this device has. The clipboard is not
 * offered here — its gesture rule means the caller starts it before the
 * render, see `copyPng`.
 */
export async function deliver(
  artefact: Artefact,
  blob: Blob,
  filename: string,
  can: Capability,
): Promise<DeliverOutcome> {
  if (can.canShareFiles) {
    const file = new File([blob], filename, { type: mimeFor(artefact) })
    if (navigator.canShare({ files: [file] })) return shareFile(file, 'Captionist')
  }
  return saveBlob(blob, filename)
}
