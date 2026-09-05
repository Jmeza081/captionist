'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { canShareFiles, canWriteImage, copyPng, deliver } from './deliver'
import { ExportError } from './frames'
import { idleLabel, messageFor, progressLabel, readyLabel } from './labels'
import type { Artefact, Capability, DeliverOutcome, FailureReason, Progress } from './types'

/**
 * One export at a time, with the key's label telling the truth about it.
 *
 * A screen owns one of these — the vote grid included, where nineteen cards
 * share it and `run` is told which one was tapped — and hands each key the
 * label it should show. Three states per job: idle (what the device can do
 * with the file — ADR 0033), rendering (how far along — the blocked-label
 * rule, ADR 0032), and ready (a file made for a tap that went stale, waiting
 * for the next one).
 *
 * Capability is read as an external store with a `false` server snapshot,
 * the way `useWebShare` does it: the server cannot detect a share sheet, and
 * a label that changed between first paint and hydration is a mismatch on
 * every phone. So the first paint says the laptop's word and the client's
 * first commit corrects it before anyone has read the button.
 */

export interface ExportJob {
  /** What to show progress on — an entry id, or `standings`. */
  id: string
  artefact: Artefact
  filename: string
  /** Makes the file. Given the progress sink and a signal to stop on. */
  render: (onProgress: (progress: Progress) => void, signal: AbortSignal) => Promise<Blob>
}

export interface ExportControl {
  /** The label a key for this job should wear right now. */
  labelFor: (job: Pick<ExportJob, 'id' | 'artefact'>) => string
  /** Whether that key is the one rendering. */
  busy: (id: string) => boolean
  progress: (id: string) => Progress | undefined
  /** The tap. */
  run: (job: ExportJob) => void
  /** Make the file now, quietly, so the tap can share it inside its window. */
  prepare: (job: ExportJob) => void
}

const subscribe = () => () => {}
const never = () => false

/** How many made files to keep around. A reveal has one; a vote has nineteen. */
const CACHE_LIMIT = 6

export function useExport(notify: (message: string) => void): ExportControl {
  const shareFiles = useSyncExternalStore(subscribe, canShareFiles, never)
  const writeImage = useSyncExternalStore(subscribe, canWriteImage, never)
  const [clipboardRefused, setClipboardRefused] = useState(false)
  const capability = useMemo<Capability>(
    () => ({ canShareFiles: shareFiles, canWriteImage: writeImage && !clipboardRefused }),
    [shareFiles, writeImage, clipboardRefused],
  )

  const [active, setActive] = useState<string | undefined>(undefined)
  const [progress, setProgress] = useState<Progress | undefined>(undefined)
  const [ready, setReady] = useState<string | undefined>(undefined)

  const cache = useRef(new Map<string, Blob>())
  const inflight = useRef(new Map<string, Promise<Blob>>())
  const controllers = useRef(new Set<AbortController>())
  const notifyRef = useRef(notify)
  useEffect(() => {
    notifyRef.current = notify
  }, [notify])

  useEffect(() => {
    const live = controllers.current
    return () => {
      for (const c of live) c.abort()
      live.clear()
    }
  }, [])

  const remember = (id: string, blob: Blob) => {
    cache.current.set(id, blob)
    if (cache.current.size > CACHE_LIMIT) {
      const oldest = cache.current.keys().next().value
      if (oldest !== undefined) cache.current.delete(oldest)
    }
  }

  /** The file for a job: cached, already being made, or made now. */
  const fileFor = (job: ExportJob, onProgress: (p: Progress) => void): Promise<Blob> => {
    const hit = cache.current.get(job.id)
    if (hit) return Promise.resolve(hit)
    const pending = inflight.current.get(job.id)
    if (pending) return pending
    const controller = new AbortController()
    controllers.current.add(controller)
    const made = job
      .render(onProgress, controller.signal)
      .then((blob) => {
        remember(job.id, blob)
        return blob
      })
      .finally(() => {
        controllers.current.delete(controller)
        inflight.current.delete(job.id)
      })
    inflight.current.set(job.id, made)
    return made
  }

  const finish = (job: ExportJob, outcome: DeliverOutcome, reason?: FailureReason) => {
    if (outcome === 'expired') setReady(job.id)
    else if (ready === job.id) setReady(undefined)
    if (outcome === 'failed' && reason === 'clipboard') setClipboardRefused(true)
    const message = messageFor(job.artefact, outcome, reason)
    if (message) notifyRef.current(message)
  }

  const run = useCallback(
    (job: ExportJob) => {
      if (active !== undefined) return
      setActive(job.id)
      setProgress(undefined)
      const onProgress = (p: Progress) => setProgress(p)

      const settle = (outcome: DeliverOutcome, reason?: FailureReason) => {
        setActive(undefined)
        setProgress(undefined)
        finish(job, outcome, reason)
      }

      const failure = (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          settle('cancelled')
          return
        }
        settle('failed', error instanceof ExportError ? error.reason : 'render')
      }

      // The clipboard's road starts *now*, inside the gesture, with a promise
      // for the bytes — Safari's rule. Only when there is no sheet to prefer.
      if (job.artefact === 'png' && capability.canWriteImage && !capability.canShareFiles) {
        const made = fileFor(job, onProgress)
        // A render that fails rejects the promise the clipboard is holding,
        // which it reports as a refusal; catch it first so the message says
        // what actually happened.
        let failed: unknown
        const guarded = made.catch((error: unknown) => {
          failed = error
          throw error
        })
        void copyPng(guarded).then((outcome) => {
          if (failed !== undefined) failure(failed)
          else if (outcome === 'failed') settle('failed', 'clipboard')
          else settle(outcome)
        })
        return
      }

      void fileFor(job, onProgress)
        .then((blob) => deliver(job.artefact, blob, job.filename, capability))
        .then((outcome) => settle(outcome), failure)
    },
    // `finish` and `fileFor` read refs and state through closures that are
    // rebuilt with `active`; listing them would rebuild on every render for
    // nothing more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, capability],
  )

  const prepare = useCallback((job: ExportJob) => {
    if (cache.current.has(job.id) || inflight.current.has(job.id)) return
    const start = () => {
      if (cache.current.has(job.id) || inflight.current.has(job.id)) return
      fileFor(job, () => {}).catch(() => {
        // Quietly. The tap will try again and report properly.
      })
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2000 })
    else setTimeout(start, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const labelFor = useCallback(
    (job: Pick<ExportJob, 'id' | 'artefact'>): string => {
      if (active === job.id) return progress ? progressLabel(progress.done, progress.total) : 'Rendering…'
      if (ready === job.id) return readyLabel(job.artefact)
      return idleLabel(job.artefact, capability)
    },
    [active, progress, ready, capability],
  )

  return {
    labelFor,
    busy: (id) => active === id,
    progress: (id) => (active === id ? progress : undefined),
    run,
    prepare,
  }
}
