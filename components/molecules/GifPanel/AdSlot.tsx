import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import type { GifAd } from '@/lib/gifs/provider'
import styles from './AdSlot.module.scss'

/**
 * Advertising, in a slot of its own above the board.
 *
 * **Never inline in the masonry.** Three reasons, in order of how much they
 * cost to get wrong:
 *
 *   1. An ad is a whole HTML document from a third party, so it goes in a
 *      sandboxed iframe — see the attribute below. A masonry tile is a
 *      `<button>` that stages a pick, and putting a live document inside one
 *      would mean a click could land on either.
 *   2. It has a fixed intrinsic size and may be rescaled by at most ten percent
 *      (Klipy's `meta.ad_max_resize_percent`). The board's columns are fluid by
 *      design, so an ad in one is letterboxed or clipped at most widths.
 *   3. In a grid where every neighbour bleeds edge to edge, a boxed tile with
 *      dead space around it reads as a rendering fault rather than as an ad.
 *
 * **Above the board rather than below it.** Below, the slot lands past fifty
 * tiles — measured at 99% of the way down a phone page — where nobody scrolls.
 * That earns nothing and, worse, would register a served impression with no
 * viewability, which is the kind of inventory an exchange learns to stop
 * filling. Requirement 6 also asks that content not be presented in a way that
 * interferes with measurement or monetization.
 *
 * Renders nothing at all when no ad arrived, which is the ordinary case: ads
 * are never guaranteed, and nothing here depends on one.
 */
export function AdSlot({ ads }: { ads: readonly GifAd[] }) {
  if (ads.length === 0) return null

  return (
    <Stack gap={8} className={styles.slot}>
      <span className={styles.label}>Sponsored</span>
      {/*
        A wrapping row, not a stack.

        Klipy returns two banners per board. Side by side they cost one banner's
        height on a desktop panel; stacked they cost two, and push the tiles
        the player came for below the fold. `Inline` wraps by default, so a
        phone gets the stack it has no room to avoid.
      */}
      <Inline gap={10} justify="center">
        {ads.map((ad, index) => (
          <iframe
            // Ads carry no id of their own; their position in one board is all
            // the identity they have, and the list is replaced wholesale.
            key={index}
            title="Advertisement"
            className={styles.frame}
            /**
             * The security boundary, and the reason this is a component rather
             * than three lines inside `GifPanel`.
             *
             * `allow-scripts` because the ad's own script is what reveals its
             * image; `allow-popups` and `allow-popups-to-escape-sandbox` because
             * its click-through is a `target="_blank"` link and would otherwise
             * be inert. **Never `allow-same-origin`** — with it, the ad shares
             * this app's origin and can read its `localStorage`, its cookies and
             * its DOM. The two together would be equivalent to no sandbox at all.
             *
             * `srcDoc` rather than injecting the markup: inlining it would let
             * the ad's own `html.klipy-ad body { ... }` rules escape into the
             * page, and would hand it the document it is being kept out of.
             */
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            srcDoc={ad.content}
            // Its natural size. Requested small enough to fit the narrowest
            // column, because an iframe clips its content rather than scaling it.
            width={ad.width}
            height={ad.height}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ))}
      </Inline>
    </Stack>
  )
}
