import type { MediaRef, PlayerFace } from '@/lib/game/types'
import { markFor, memeFilename, standingsFilename } from './labels'
import type { StandingsRow } from './standings'
import type { ExportJob } from './useExport'

/**
 * A screen's state, turned into something `useExport` can run.
 *
 * The renderers are imported when the job runs, not when the screen mounts:
 * a room that never taps the key never loads a decoder, and a room whose flag
 * is off never renders the key at all.
 */

export interface MemeJobInput {
  /** The entry's id — what the key's progress is tracked under. */
  id: string
  mode: 'caption' | 'react'
  media: MediaRef | undefined
  lines?: readonly string[]
  prompt?: string
  /** Named on the reveal. Absent during the vote, which is anonymous. */
  author?: { face: PlayerFace; points: number }
  roundNumber: number
  /** The grid position, for the filename of a vote-time export. */
  entryIndex?: number
}

export function memeJob(input: MemeJobInput): ExportJob | undefined {
  const src = input.media?.src
  if (!src) return undefined
  return {
    id: input.id,
    artefact: 'gif',
    filename: memeFilename(input.roundNumber, input.entryIndex),
    render: async (onProgress, signal) => {
      const { renderMeme } = await import('./meme')
      return renderMeme(
        {
          src,
          hint: { width: input.media?.width, height: input.media?.height },
          spec: {
            mode: input.mode,
            lines: input.lines,
            prompt: input.prompt,
            author: input.author ? { name: input.author.face.name, points: input.author.points } : undefined,
            mark: markFor(src),
            roundNumber: input.roundNumber,
          },
        },
        onProgress,
        signal,
      )
    },
  }
}

/**
 * @param round Which table this is — the round number, or `final` on the podium.
 *   It is in the id because the cache is keyed on the id alone, with no content
 *   key: a constant `'standings'` re-delivered the first render's bytes to any
 *   later export from the same mount, which is exactly what a score screen that
 *   survives a round boundary would do.
 */
export function standingsJob(
  code: string,
  title: string,
  rows: readonly StandingsRow[],
  round: number | 'final',
): ExportJob {
  return {
    id: `standings-${code}-${round}`,
    artefact: 'png',
    filename: standingsFilename(code),
    render: async () => {
      const { renderStandings } = await import('./standings')
      return renderStandings({ code, title, rows })
    },
  }
}

/** A `Standing` row from the selector, as the renderer wants it. */
export function standingsRow(row: { rank: number; score: number; player: PlayerFace }): StandingsRow {
  const { name, color, src, avatarSeed, hat, bot } = row.player
  return { rank: row.rank, score: row.score, name, color, src, avatarSeed, hat, bot: bot !== undefined }
}
