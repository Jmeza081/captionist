import { GifProviderError, GifQuotaError } from './errors'
import { adSessionId } from './customer'
import { KLIPY } from './descriptors'
import type { GifAd, GifBoard, GifProvider, GifQuery } from './provider'
import type { GifResult } from './types'

/**
 * Klipy, called from the browser.
 *
 * Same shape as `giphy.ts` and for the same reason. Klipy's integration
 * requirements are near-identical to Giphy's on every point that shaped
 * ADR-0020:
 *
 *   > API requests and media loads must originate from the user's mobile app,
 *   > desktop app, or web browser. Do not route requests through
 *   > partner-operated servers, proxies, CDNs, or other intermediaries without
 *   > prior written approval from KLIPY.
 *
 *   > Do not store, mirror, re-host, rewrite, or retain copies of KLIPY media
 *   > unless KLIPY has approved a different delivery method in writing.
 *
 * So no proxy and no cache here either. What switching buys is not the
 * architecture — it is the allowance: a Klipy production key is free and
 * unmetered where Giphy's beta key is 100 an hour. See ADR-0022.
 *
 * Everything below was verified against live responses on 2026-08-31, not
 * reconstructed from documentation. The surprises are recorded where they bite.
 */

const ENDPOINT = 'https://api.klipy.com/api/v1'

/** The brief clock is 30s. A hung request must not eat it. */
const TIMEOUT_MS = 4_000

/**
 * The SFW filter, pinned — and this one is load-bearing in a way Giphy's is not.
 *
 * **Klipy fails open.** A `content_filter` it does not recognise, and a
 * `content_filter` left off entirely, both return exactly what `off` returns —
 * with HTTP 200 and `result: true`, so nothing anywhere reports a problem.
 * Verified by comparing slugs across `high`, `off`, `nonsense` and omitted: the
 * last three agree.
 *
 * So a typo here is not a degraded filter, it is *no* filter, silently, under a
 * picker that says "SFW filter on" — in a game people play at work. It is a
 * constant and never a setting, and `klipy.test.ts` asserts it rides on every
 * request.
 */
const CONTENT_FILTER = 'high'

interface KlipyRendition {
  url?: string
  width?: number
  height?: number
}

interface KlipyItem {
  slug?: string
  title?: string
  /** `gif` for a GIF. Anything else is an ad or something we do not draw. */
  type?: string
  tags?: string[]
  file?: Partial<Record<'hd' | 'md' | 'sm' | 'xs', Partial<Record<
    'gif' | 'webp' | 'jpg' | 'mp4' | 'webm',
    KlipyRendition
  >>>>
}

/**
 * An ad, which shares the item array and nothing else.
 *
 * No slug, no `file`, no title. `content` is a whole HTML document.
 */
interface KlipyAd {
  type?: string
  width?: number
  height?: number
  content?: string
}

interface KlipyBody {
  result?: boolean
  data?: {
    data?: (KlipyItem & KlipyAd)[]
    has_next?: boolean
  }
  errors?: { message?: string[] }
}

/** An ad is only usable if it has a document and a size to draw it at. */
function toAd(item: KlipyAd): GifAd | undefined {
  if (item.type !== 'ad') return undefined
  const { content, width, height } = item
  if (!content || !size(width) || !size(height)) return undefined
  return { content, width: width as number, height: height as number }
}

/** Klipy sends real numbers, not Giphy's decimal strings. Junk is simply absent. */
function size(raw: number | undefined): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

/** Titles are noisy; this is enough for the panel's local narrowing. */
function keywordsFor(title: string, tags: string[], query: string | undefined): string[] {
  const words = `${query ?? ''} ${title} ${tags.join(' ')}`
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 1)
  return [...new Set(words)]
}

function toResult(item: KlipyItem, query: string | undefined): GifResult | undefined {
  /**
   * `md` for the tile, `sm` for the preview — the same reasoning as Giphy's
   * `fixed_width`. Every one of a hundred sampled items carried all five
   * formats at all four qualities, so the fallback chain is belt-and-braces
   * rather than a case anyone has seen.
   */
  const rendition = item.file?.md?.gif ?? item.file?.sm?.gif ?? item.file?.hd?.gif
  const src = rendition?.url
  if (!item.slug || !src) return undefined

  /**
   * The slug, not the numeric `id`.
   *
   * The numeric id is the stable identity and is useless here: the share
   * trigger and `gifs/items` both take slugs. A *search* slug also carries a
   * per-response token — `bunny-deploy--kgr6Utsfe` — which changes between
   * requests and between filter levels, so it is an identifier for this board
   * and not a durable name. That is fine everywhere it is used: React keys and
   * `selectedId` live inside one board, and `toMediaRef` drops the id before
   * anything reaches game state.
   */
  const alt = item.title?.trim() || 'A GIF'

  return {
    id: item.slug,
    src,
    alt,
    keywords: keywordsFor(alt, item.tags ?? [], query),
    mp4: item.file?.md?.mp4?.url,
    webp: item.file?.md?.webp?.url,
    // `xs` rather than a still format: Klipy has no still-frame rendition, and
    // `blur_preview` is a data: URI, which the event lane's allowlist rejects
    // by design and which would bloat any message carrying it.
    still: item.file?.xs?.jpg?.url,
    // Off the same rendition `src` came from, so the ratio describes the image
    // actually being rendered rather than one it was resized from.
    width: size(rendition?.width),
    height: size(rendition?.height),
  }
}

async function search(query: GifQuery, apiKey: string): Promise<GifBoard> {
  const term = query.q.trim()
  const params = new URLSearchParams({
    // Klipy pages from one; the cursor counts from zero.
    page: String(query.cursor.page + 1),
    per_page: String(query.limit),
    content_filter: CONTENT_FILTER,
    locale: 'en_US',
  })
  if (term) params.set('q', term)

  /**
   * Ask for ads, or do not — and the difference is the whole compliance story.
   *
   * All five of these are required for delivery. Send none and only GIFs come
   * back, so the board is unfiltered by construction. Send them and ads arrive
   * inline, at which point they *must* be rendered: dropping them would be the
   * client-side filter requirement 4 forbids. Asking and rendering are one
   * decision, expressed here as one `if`.
   */
  const { adSizes } = KLIPY
  if (adSizes) {
    params.set('customer_id', adSessionId())
    params.set('ad-min-width', String(adSizes.minWidth))
    params.set('ad-max-width', String(adSizes.maxWidth))
    params.set('ad-min-height', String(adSizes.minHeight))
    params.set('ad-max-height', String(adSizes.maxHeight))
  }

  /**
   * No `format_filter`, deliberately.
   *
   * It reads like the obvious way to say "we want GIFs", and it is a trap: it
   * restricts the response to that *one* format and nulls the rest. With
   * `format_filter=gif` every item comes back with `webp`, `mp4` and the `jpg`
   * still stripped — which is the WebP the board renders instead of fifty
   * animated GIFs on a phone, the MP4 the wall uses, and the frame a
   * reduced-motion viewer sees. Verified: omitted returns all five formats at
   * all four qualities; `format_filter=gif` returns one.
   *
   * Non-GIF *items* are dropped below, on `type`, which is the actual question
   * this parameter looked like it was answering.
   */
  // The app key is a **path segment**, not a query parameter and not a header.
  const url = `${ENDPOINT}/${apiKey}/gifs/${term ? 'search' : 'trending'}?${params.toString()}`

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

  if (response.status === 429) {
    throw new GifQuotaError('Klipy’s hourly limit is spent', 'klipy')
  }

  /**
   * Klipy answers failure two different ways, and only one of them is a status.
   *
   * An invalid key is **HTTP 404** with `result: false` — not 401, not 403 —
   * so status alone cannot be trusted to mean what it usually means, and the
   * envelope has to be checked even on a 200.
   */
  if (!response.ok) {
    throw new GifProviderError(`Klipy answered ${response.status}`, 'klipy')
  }

  const body = (await response.json()) as KlipyBody

  if (body.result !== true) {
    const detail = body.errors?.message?.[0] ?? 'an unreadable answer'
    throw new GifProviderError(`Klipy returned ${detail}`, 'klipy')
  }

  /**
   * Klipy's order and composition, kept.
   *
   * Requirement 4 is explicit — "do not independently reorder, insert, remove,
   * suppress, replace, or filter returned results", and any approved filtering
   * "must be configured through the KLIPY Partner Panel". This used to drop
   * `type !== 'gif'`, which is exactly that: a client-side content filter.
   *
   * **The board is GIFs by construction, not by filtering.** Ads are only
   * delivered to a request that asks for them — they require `customer_id` and
   * the four `ad-min/max-width/height` parameters, and `search` above sends
   * none. So nothing but GIFs is returned in the first place.
   *
   * What is left drops only an item with no slug and no drawable rendition —
   * a tile that cannot be rendered at all, which is the same rule the Giphy
   * adapter follows and is a fact about our renderer rather than a judgement
   * about their content.
   *
   * The day this app asks for ads is the day it has to render them; those two
   * cannot land apart without reintroducing the filter. See ADR-0022.
   */
  const returned = body.data?.data ?? []

  const items = returned.flatMap((item) => {
    const result = toResult(item, term)
    return result ? [result] : []
  })

  /**
   * Ads, carried on their own channel rather than dropped.
   *
   * They cannot join `items` — an ad has no slug and no rendition, and letting
   * one near `GifResult` would put an advertiser's HTML one `toMediaRef` away
   * from game state. Splitting them is not filtering: everything Klipy returned
   * is still rendered, in the order given, on the surface each shape suits.
   */
  const ads = returned.flatMap((item) => {
    const ad = toAd(item)
    return ad ? [ad] : []
  })

  return { items, ads }
}

/**
 * Tell Klipy a GIF was chosen.
 *
 * Fire-and-forget, and deliberately unawaited: this is Klipy's attribution
 * signal, not the player's business, and a picker that failed because an
 * analytics ping did would be a worse trade than a lost ping. Accepts the slug
 * exactly as it arrived, per-response token and all — that token is how Klipy
 * ties the click back to the search that surfaced it.
 */
function share(id: string, apiKey: string, query?: string): void {
  const body = JSON.stringify(query ? { q: query } : {})
  void fetch(`${ENDPOINT}/${apiKey}/gifs/share/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined)
}

export const klipyProvider: GifProvider = { descriptor: KLIPY, search, share }
