import { nextInt } from './rng'
import type { RoomCode } from './types'

/**
 * Room codes are `C-` plus six characters, e.g. `C-F34213`.
 *
 * The alphabet drops the characters that get misread when someone reads a code
 * out over a call: I/1, O/0, S/5 and Z/2 all collide, so only one of each pair
 * survives. Codes get spoken aloud far more often than they get typed.
 *
 * `L` is excluded too, and for a different reason: `normalizeCode` folds it
 * onto `J` so a typed `l` still resolves, which would stop a generated code
 * containing `L` from round-tripping through its own normaliser.
 */
const ALPHABET = '346789ABCDEFGHJKMNPQRTUVWXY'
const BODY_LENGTH = 6

export const CODE_PREFIX = 'C-'
export const CODE_PATTERN = /^C-[346789A-HJKMNPQRTUVWXY]{6}$/

export function generateCode(seed: number): [RoomCode, number] {
  let cursor = seed
  let body = ''
  for (let i = 0; i < BODY_LENGTH; i++) {
    const [index, advanced] = nextInt(cursor, ALPHABET.length)
    cursor = advanced
    body += ALPHABET[index] ?? ALPHABET[0]
  }
  return [CODE_PREFIX + body, cursor]
}

/**
 * Accepts what a person actually types: lowercase, a missing prefix, spaces,
 * and the ambiguous characters the alphabet excludes. Returns `null` when it
 * still isn't a code, so the caller can say what to do next.
 */
export function normalizeCode(input: string): RoomCode | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/^C/, '')
    // Both halves of every collision fold the same way. Handling only the
    // letters would be half a job: someone reading `C-F3Q783` down a call says
    // "oh" and the person typing it reaches for zero.
    .replace(/[IL1]/g, 'J')
    .replace(/[O0]/g, 'Q')
    .replace(/[S5]/g, '3')
    .replace(/[Z2]/g, '4')
  if (cleaned.length !== BODY_LENGTH) return null
  const code = CODE_PREFIX + cleaned
  return CODE_PATTERN.test(code) ? code : null
}
