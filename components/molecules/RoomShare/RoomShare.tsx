'use client'

import type { ReactNode } from 'react'
import QRCode from 'react-qr-code'
import { Box } from '@/components/atoms/Box'
import { Button } from '@/components/atoms/Button'
import { RoomCode } from '@/components/atoms/RoomCode'
import styles from './RoomShare.module.scss'

export interface RoomShareProps {
  /** The room code, e.g. `C-F34213`. */
  code: string
  /** Absolute URL players land on. */
  joinUrl: string
  /** Both of these must confirm with a snackbar — they have no visible result. */
  onCopyLink: () => void
  onShareToSlack?: () => void
  /**
   * The room's rules, under the link — "5 rounds · 90s · rank top 3".
   *
   * Phone only, and it is the header's settings line moved down here. A phone
   * header holds the wordmark, the host chip and the walkthrough key, and
   * nothing else fits; on a laptop the line stays in the bar where every other
   * screen carries it. Mode deliberately absent — see `roomRulesLine`.
   */
  meta?: ReactNode
}

/**
 * The lobby's share block: scan it, read it out, or send the link.
 *
 * Copy and share have no visible result of their own, so the host is expected
 * to confirm both with a snackbar — see DESIGNSYSTEM.md §4.2.
 */
export function RoomShare({
  code,
  joinUrl,
  onCopyLink,
  onShareToSlack,
  meta,
}: RoomShareProps) {
  // Shown without the scheme: it's read aloud and typed, not clicked.
  const readable = joinUrl.replace(/^https?:\/\//, '')

  return (
    <div className={styles.share}>
      <Box background="light" padding={8} radius="media" className={styles.qr}>
        <QRCode
          value={joinUrl}
          size={256}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          bgColor="#FFFFFF"
          fgColor="#0A0A0B"
          viewBox="0 0 256 256"
          title={`QR code to join room ${code}`}
        />
      </Box>

      <div className={styles.body}>
        <RoomCode code={code} size="compact" />
        <span className={styles.url}>{readable}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" size="small" onClick={onCopyLink}>
          Copy link
        </Button>
        {onShareToSlack && (
          <Button variant="secondary" size="small" onClick={onShareToSlack}>
            Share to Slack
          </Button>
        )}
      </div>
    </div>
  )
}
