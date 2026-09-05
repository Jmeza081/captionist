import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

/**
 * The feature flags, declared once and read on the server.
 *
 * There is exactly one, and it exists for a specific reason: the export
 * feature re-encodes a provider's GIF with a caption burned in, which the
 * provider's terms neither allow nor forbid in so many words. If the answer
 * turns out to be no, the feature has to go dark in the time it takes to flip
 * a switch — not the time it takes to redeploy. See ADR 0036.
 *
 * Read in `app/room/[code]/page.tsx`, which is a dynamic Server Component, so
 * the flag is evaluated per request and the answer travels down as a prop.
 * Nothing in the browser can turn it back on.
 */

/**
 * Whether there is anything to ask.
 *
 * `vercelAdapter()` authenticates with the deployment's OIDC token, or with an
 * SDK key in `FLAGS`. Neither exists on a laptop that has never run
 * `vercel env pull`, and asking anyway costs a failed token lookup and an
 * error line on every room render. So the adapter is consulted only where it
 * can answer; everywhere else the environment's own default is the answer.
 */
const askVercel = Boolean(
  process.env.VERCEL || process.env.FLAGS || process.env.VERCEL_OIDC_TOKEN,
)

/**
 * What governs until a Vercel project exists, and locally forever: on, unless
 * the environment says otherwise. A server-side variable on purpose — a
 * `NEXT_PUBLIC_` one would be inlined at build time and could not be flipped.
 */
const exportMediaDefault = process.env.EXPORT_MEDIA !== 'off'

const exportMediaDeclaration = {
  key: 'export-media',
  description: 'Export the winning meme as a GIF and the standings as an image',
  options: [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ],
  defaultValue: exportMediaDefault,
}

/**
 * Export the winning meme as a GIF and the standings as an image.
 *
 * `defaultValue` is also what the SDK returns when the adapter throws — a
 * flag the dashboard has never heard of, a flags service that is down — so a
 * misconfigured deploy fails *open* to whatever the environment says rather
 * than to a blank room.
 */
export const exportMedia = askVercel
  ? flag<boolean>({ ...exportMediaDeclaration, adapter: vercelAdapter() })
  : flag<boolean>({ ...exportMediaDeclaration, decide: () => exportMediaDefault })
