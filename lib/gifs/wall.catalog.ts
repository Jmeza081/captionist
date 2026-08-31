import type { WallTile } from './wall'

/**
 * The landing wall's GIFs, committed rather than fetched.
 *
 * **Generated. Run `node scripts/import-wall-gifs.mjs` to refresh.**
 *
 * These are hot-linked `media.giphy.com` renditions — the sanctioned way to
 * display Giphy media, and the same thing `backdrop.ts` and `notFound.ts`
 * already do. What it is *not* is an API call: the wall renders on four routes
 * (`/`, `/host`, `/join`, `/join/[code]`), and searching Giphy from any of
 * them would have cost an upstream call per visitor against an allowance of a
 * hundred an hour — the landing page would have spent the room's whole budget
 * on people who never joined a room. See ADR-0020.
 *
 * Empty is a valid state: `wallTiles()` falls back to the offline shelf, which
 * is what a fresh clone with no key and the Playwright suite both get.
 */
export const WALL_GIFS: readonly WallTile[] = [
  {
    "id": "xSM46ernAUN3y",
    "poster": "https://media0.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xSM46ernAUN3y/200w.gif",
    "mp4": "https://media0.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xSM46ernAUN3y/200w.mp4",
    "alt": "Video gif. A man outdoors, holding a fishing pole,  looks over his shoulder and a smile grows on his face. He then nods in approval."
  },
  {
    "id": "Yrl3qoBXef8rorcZdE",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Yrl3qoBXef8rorcZdE/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Yrl3qoBXef8rorcZdE/200w.mp4",
    "alt": "Happy Molly Shannon GIF by Laff"
  },
  {
    "id": "1iSaZtCdYhxg4",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1iSaZtCdYhxg4/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1iSaZtCdYhxg4/200w.mp4",
    "alt": "Animated GIF"
  },
  {
    "id": "iNjfcmUM8lUPWm3fay",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/iNjfcmUM8lUPWm3fay/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/iNjfcmUM8lUPWm3fay/200w.mp4",
    "alt": "Sad Jim Carrey GIF"
  },
  {
    "id": "qnE7DFFqmgdyM",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/qnE7DFFqmgdyM/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/qnE7DFFqmgdyM/200w.mp4",
    "alt": "Animated GIF"
  },
  {
    "id": "UqKD7TU0igaUE",
    "poster": "https://media3.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UqKD7TU0igaUE/200w.gif",
    "mp4": "https://media3.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UqKD7TU0igaUE/200w.mp4",
    "alt": "Animated GIF"
  },
  {
    "id": "wZtxnyxWTImyzpRxf1",
    "poster": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/wZtxnyxWTImyzpRxf1/200w.gif",
    "mp4": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/wZtxnyxWTImyzpRxf1/200w.mp4",
    "alt": "Sweater Weather Snl GIF"
  },
  {
    "id": "fSm4iaBU4Mn2E",
    "poster": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/fSm4iaBU4Mn2E/200w.gif",
    "mp4": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/fSm4iaBU4Mn2E/200w.mp4",
    "alt": "s reactions tenor GIF"
  },
  {
    "id": "gpXfKa9xLAR56",
    "poster": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gpXfKa9xLAR56/200w.gif",
    "mp4": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gpXfKa9xLAR56/200w.mp4",
    "alt": "Muppets gif. Kermit the Frog stands in front of red stage curtains and frantically applauds, his green arms becoming a blur of motion."
  },
  {
    "id": "sdMHXBCDyJOqk",
    "poster": "https://media3.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/sdMHXBCDyJOqk/200w.gif",
    "mp4": "https://media3.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/sdMHXBCDyJOqk/200w.mp4",
    "alt": "football nfl GIF"
  },
  {
    "id": "E2i9ILCmSJUkg",
    "poster": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/E2i9ILCmSJUkg/200w.gif",
    "mp4": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/E2i9ILCmSJUkg/200w.mp4",
    "alt": "Animated GIF"
  },
  {
    "id": "3oFzmfvmjd3iVfqyis",
    "poster": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oFzmfvmjd3iVfqyis/200w.gif",
    "mp4": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oFzmfvmjd3iVfqyis/200w.mp4",
    "alt": "Have A Nice Day GIF"
  },
  {
    "id": "vHPocSEMWOqPK",
    "poster": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/vHPocSEMWOqPK/200w.gif",
    "mp4": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/vHPocSEMWOqPK/200w.mp4",
    "alt": "Animated GIF"
  },
  {
    "id": "FgagoIMiobhbG",
    "poster": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/FgagoIMiobhbG/200w.gif",
    "mp4": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/FgagoIMiobhbG/200w.mp4",
    "alt": "Animated GIF"
  },
  {
    "id": "3nfqWYzKrDHEI",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3nfqWYzKrDHEI/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3nfqWYzKrDHEI/200w.mp4",
    "alt": "pivot moving GIF"
  },
  {
    "id": "YrD1PQldGsstG",
    "poster": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YrD1PQldGsstG/200w.gif",
    "mp4": "https://media1.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YrD1PQldGsstG/200w.mp4",
    "alt": "Girl Door GIF"
  },
  {
    "id": "JpehtCvclNLSE",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/JpehtCvclNLSE/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/JpehtCvclNLSE/200w.mp4",
    "alt": "Chocolate Reaction GIF"
  },
  {
    "id": "88jioKJMm8dNpaDRik",
    "poster": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/88jioKJMm8dNpaDRik/200w.gif",
    "mp4": "https://media4.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/88jioKJMm8dNpaDRik/200w.mp4",
    "alt": "im a big deal GIF"
  },
  {
    "id": "Yl5TkbFrPLNJyMObHn",
    "poster": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Yl5TkbFrPLNJyMObHn/200w.gif",
    "mp4": "https://media2.giphy.com/media/v1.Y2lkPWZhN2JmNTkxdmNwbmpoZ3drMHJ2bWMyYWZvMjlwZTYwc254Mjk2N2VzNGlmYjVkOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Yl5TkbFrPLNJyMObHn/200w.mp4",
    "alt": "Uh Oh Omg GIF by Acorn TV"
  }
]
