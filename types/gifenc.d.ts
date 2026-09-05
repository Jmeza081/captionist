/**
 * `gifenc` ships no types — its `types.d.ts` is in the repository and not in
 * the 1.0.3 tarball — so this is the slice of its surface the export renderer
 * calls, read off `src/index.js`, `src/pnnquant2.js` and `src/palettize.js`.
 * Only what is used; the rest of the module stays untyped on purpose so a
 * new call site has to come back here and read the source first.
 */
declare module 'gifenc' {
  /** `[r, g, b]` or `[r, g, b, a]` per entry, at most 256 of them. */
  export type Palette = number[][]

  export type PixelFormat = 'rgb565' | 'rgb444' | 'rgba4444'

  export interface QuantizeOptions {
    format?: PixelFormat
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
    useSqrt?: boolean
  }

  /**
   * A palette of at most `maxColors` from RGBA pixels. The array's buffer is
   * read as `Uint32Array`, so it must start at offset 0 and hold whole pixels —
   * an `ImageData.data` does, a slice of one may not.
   */
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): Palette

  /** Each pixel as an index into `palette`. */
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: PixelFormat,
  ): Uint8Array

  export interface WriteFrameOptions {
    /** Required on the first frame (the global colour table); a local table after. */
    palette?: Palette
    /** Milliseconds. Written in hundredths, so anything under 10 rounds to 0. */
    delay?: number
    /** `-1` once, `0` forever, `n` times. Only read on the first frame. */
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
    colorDepth?: number
    first?: boolean
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export interface EncoderOptions {
    /** Write the header on the first frame. Default `true`. */
    auto?: boolean
    initialCapacity?: number
  }

  export function GIFEncoder(options?: EncoderOptions): Encoder
}
