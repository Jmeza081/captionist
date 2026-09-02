import type { ModalStep } from '@/components/molecules/Modal'
import type { GameMode } from '@/lib/game/types'
import {
  AnswerIllustration,
  CaptionIllustration,
  PickIllustration,
  PodiumIllustration,
  PromptIllustration,
  VoteIllustration,
} from './illustrations'

/**
 * The walkthrough's copy and artwork.
 *
 * Co-located with the component that renders it, the same as `RoomShell`'s.
 * It is branched by mode rather than forked into two components, because the
 * two formats differ in who supplies what — steps 3 and 4 are the same
 * sentences on purpose. **Step 3's rail is not the same twice**, though: the
 * words are, but caption mode ranks four captions over one image and react
 * mode ranks four different GIFs, so `VoteIllustration` takes the mode. It is a
 * value branch inside one component, never a second component.
 */

export const HELP_MODES: ReadonlyArray<{ value: GameMode; label: string }> = [
  { value: 'caption', label: 'Caption the image' },
  { value: 'react', label: 'React to the caption' },
]

/**
 * Four steps, one per beat of a round, so a player who joined mid-session can
 * catch up without anyone explaining it out loud.
 */
export const HELP_STEPS: Readonly<Record<GameMode, ModalStep[]>> = {
  caption: [
    {
      eyebrow: 'The role',
      heading: 'Someone picks the image',
      body: 'Each round one player is the Captionist. They pick a GIF and then sit the round out — they do not compete against the captions they set up.',
      illustration: <PickIllustration />,
    },
    {
      eyebrow: 'The writing',
      heading: 'Everyone else captions it',
      body: 'You get a top and a bottom line, 60 characters each. Entries are anonymous until the reveal, so write the one you would not sign.',
      illustration: <CaptionIllustration />,
    },
    {
      eyebrow: 'The vote',
      heading: 'The room ranks the top three',
      body: 'Three points for first, two for second, one for third. You cannot vote for your own — we checked.',
      // The one step whose picture is not the same in both modes: caption mode
      // ranks four captions over *one* image, react mode ranks four GIFs.
      illustration: <VoteIllustration mode="caption" />,
    },
    {
      eyebrow: 'The score',
      heading: 'Points carry to the podium',
      body: 'Five rounds, the role rotates each time, and the totals decide the champion.',
      illustration: <PodiumIllustration />,
    },
  ],
  react: [
    {
      eyebrow: 'The role',
      heading: 'Someone writes the prompt',
      body: 'Each round one player is the Prompter. They write a single line and then sit the round out — no image from them.',
      illustration: <PromptIllustration />,
    },
    {
      eyebrow: 'The answer',
      heading: 'Everyone else answers with a GIF',
      body: 'Search for the answer that lands. Entries are anonymous until the reveal, and you can swap yours until the clock runs out.',
      illustration: <AnswerIllustration />,
    },
    {
      eyebrow: 'The vote',
      heading: 'The room ranks the top three',
      body: 'Three points for first, two for second, one for third. You cannot vote for your own — we checked.',
      illustration: <VoteIllustration mode="react" />,
    },
    {
      eyebrow: 'The score',
      heading: 'Points carry to the podium',
      body: 'Five rounds, the role rotates each time, and the totals decide the champion.',
      illustration: <PodiumIllustration />,
    },
  ],
}
