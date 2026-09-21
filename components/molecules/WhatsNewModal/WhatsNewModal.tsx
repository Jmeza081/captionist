'use client'

import { useState } from 'react'
import { Modal, type ModalStep } from '@/components/molecules/Modal'
import { RELEASES_URL, releaseDate, type ReleaseFeed } from '@/lib/releases'
import styles from './WhatsNewModal.module.scss'

export interface WhatsNewModalProps {
  open: boolean
  onClose: () => void
  /** Fetched on the server and handed down. Never fetched from here. */
  feed: ReleaseFeed
}

/**
 * What shipped, one release per step.
 *
 * One per step rather than one long scroll, which is what earns `Modal` its
 * keep: Back and Next, the dot row and the count come for free, and a reader
 * who only wants the newest gets it first and stops. The alternative was a
 * scrolling list inside a card that already scrolls.
 *
 * The body is GitHub's own rendered HTML — see `lib/releases.ts` for why that
 * is `dangerouslySetInnerHTML` and what is done to it first. It goes in
 * `bodyBlock` because release notes are headings and lists, and the card's
 * default body is a `<p>`.
 */
export function WhatsNewModal({ open, onClose, feed }: WhatsNewModalProps) {
  const [step, setStep] = useState(0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="What shipped"
      steps={stepsFor(feed)}
      stepIndex={step}
      onStepChange={setStep}
      // Not `error`: the red glow is the room breaking underneath somebody
      // mid-game. GitHub being unreachable is a page that could not fetch a
      // changelog, and dressing it as a failure of the app overstates it.
    />
  )
}

function stepsFor(feed: ReleaseFeed): ModalStep[] {
  if (feed.status === 'rate-limited') {
    return [
      {
        eyebrow: 'What shipped',
        heading: 'GitHub is rate-limiting us.',
        body: (
          <>
            Try again in an hour, or{' '}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer noopener">
              read the releases on GitHub
            </a>
            .
          </>
        ),
      },
    ]
  }

  if (feed.status === 'unavailable') {
    return [
      {
        eyebrow: 'What shipped',
        heading: 'Couldn’t reach GitHub.',
        body: (
          <>
            Try again in a minute, or{' '}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer noopener">
              read the releases on GitHub
            </a>
            .
          </>
        ),
      },
    ]
  }

  if (feed.releases.length === 0) {
    return [
      {
        eyebrow: 'What shipped',
        heading: 'Nothing shipped yet.',
        body: (
          <>
            Follow{' '}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer noopener">
              the repository
            </a>{' '}
            and this fills up.
          </>
        ),
      },
    ]
  }

  return feed.releases.map((release) => ({
    eyebrow: releaseDate(release.publishedAt),
    heading: release.name,
    bodyBlock: (
      <div className={styles.notes}>
        {/* GitHub's HTML, absolutised and target-ed in `lib/releases.ts`. */}
        <div
          className={styles.rendered}
          dangerouslySetInnerHTML={{ __html: release.html }}
        />
        <a
          className={styles.permalink}
          href={release.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {release.tag} on GitHub
        </a>
      </div>
    ),
  }))
}
