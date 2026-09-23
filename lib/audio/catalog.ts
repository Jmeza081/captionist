/**
 * Every sound the room can make, and whose it is.
 *
 * **One chiptune set, all CC0.** The beds are Juhani Junkala's, the podium
 * fanfare is congusbongus's, the stings and the tick are Kenney's. CC0 asks
 * for nothing; the credits ride along anyway, because the toolbox names what
 * is playing and the licence modal names where it came from.
 *
 * Shipped as static files in `public/audio`, encoded to MP3 because it is the
 * one format every browser the room supports decodes — several of the sources
 * were OGG only, which Safari will not play. The beds were loudness-normalised
 * to -18 LUFS on the way in so a crossfade never lurches; `gain` is what's
 * left to mix.
 */

export type CueId =
  | 'title'
  | 'stageSelect'
  | 'bossFight'
  | 'fanfare'
  | 'ending'
  | 'opener'
  | 'reveal'
  | 'tick'

export interface Cue {
  src: string
  /** 0–1, applied on top of the bus. The beds sit under conversation. */
  gain: number
  /** Beds loop; stings and the fanfare play once. */
  loop: boolean
  title: string
  artist: string
  source: string
}

const JUNKALA_ACTION = 'https://opengameart.org/content/5-chiptunes-action'
const JUNKALA_ADVENTURE = 'https://opengameart.org/content/4-chiptunes-adventure'
const KENNEY_JINGLES = 'https://kenney.nl/assets/music-jingles'

export const CUES: Record<CueId, Cue> = {
  title: {
    src: '/audio/title-screen.mp3',
    gain: 0.5,
    loop: true,
    title: 'Title Screen',
    artist: 'Juhani Junkala',
    source: JUNKALA_ACTION,
  },
  stageSelect: {
    src: '/audio/stage-select.mp3',
    gain: 0.45,
    loop: true,
    title: 'Stage Select',
    artist: 'Juhani Junkala',
    source: JUNKALA_ADVENTURE,
  },
  bossFight: {
    src: '/audio/boss-fight.mp3',
    gain: 0.5,
    loop: true,
    title: 'Boss Fight',
    artist: 'Juhani Junkala',
    source: JUNKALA_ADVENTURE,
  },
  fanfare: {
    src: '/audio/fanfare.mp3',
    gain: 0.6,
    loop: false,
    title: 'Glorious victory fanfare NES',
    artist: 'congusbongus',
    source: 'https://opengameart.org/content/glorious-victory-fanfare-nes',
  },
  ending: {
    src: '/audio/ending.mp3',
    gain: 0.4,
    loop: true,
    title: 'Ending',
    artist: 'Juhani Junkala',
    source: JUNKALA_ACTION,
  },
  opener: {
    src: '/audio/opener.mp3',
    gain: 0.5,
    loop: false,
    title: 'NES jingle 00',
    artist: 'Kenney',
    source: KENNEY_JINGLES,
  },
  reveal: {
    src: '/audio/reveal.mp3',
    gain: 0.55,
    loop: false,
    title: 'NES jingle 13',
    artist: 'Kenney',
    source: KENNEY_JINGLES,
  },
  tick: {
    src: '/audio/tick.mp3',
    gain: 0.5,
    loop: false,
    title: 'Tick',
    artist: 'Kenney',
    source: 'https://kenney.nl/assets/interface-sounds',
  },
}
