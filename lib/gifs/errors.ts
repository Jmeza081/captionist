import type { GifProviderId } from './provider'

/**
 * What a GIF provider did that was not a board.
 *
 * Provider-neutral on purpose. These used to be `GiphyError` and
 * `GiphyRateLimitError`, which meant `useGifSearch` — a hook that otherwise
 * knows nothing about who supplies the tiles — imported a vendor's name to do
 * its one piece of error branching. The vendor moved onto `provider` instead,
 * where a message can use it without a caller having to.
 */
export class GifProviderError extends Error {
  constructor(
    message: string,
    readonly provider: GifProviderId,
  ) {
    super(message)
  }
}

/**
 * The allowance is spent.
 *
 * Its own type because the room does something different with it: every other
 * failure is one board that did not arrive, and this one ends the game (see
 * `game/gifsExhausted`). A caller that cannot tell them apart would either
 * shrug off a dead quota or end the game over a flaky connection.
 *
 * It extends `GifProviderError` rather than sitting beside it, so a caller that
 * has not learned the distinction still catches this as an ordinary failure and
 * degrades, instead of letting it through uncaught.
 */
export class GifQuotaError extends GifProviderError {}
