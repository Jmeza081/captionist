'use client'

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
}: RoomShareProps) {
  // Shown without the scheme: it's read aloud and typed, not clicked.
  const readable = joinUrl.replace(/^https?:\/\//, '')

  return (
    <div className={styles.share}>
      <Box background="light" padding={12} radius="media" className={styles.qr}>
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
        <RoomCode code={code} />
        <span className={styles.url}>{readable}</span>

        <div className={styles.actions}>
          <Button variant="secondary" size="inline" onClick={onCopyLink}>
            Copy link
          </Button>
          {onShareToSlack && (
            <Button variant="secondary" size="inline" onClick={onShareToSlack}>
              Share to Slack
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
