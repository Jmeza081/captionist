import QRCode from 'react-qr-code'
import { Box } from '@/components/atoms/Box'
import { RoomCode } from '@/components/atoms/RoomCode'
import { Stack } from '@/components/atoms/Stack'
import styles from './JoinPanel.module.scss'

export interface JoinPanelProps {
  /** The room code players type if they can't scan. */
  code: string
  /** Absolute URL encoded in the QR code. */
  joinUrl: string
}

/**
 * The two ways into a room: scan the code, or type it.
 *
 * The QR sits on a light surface because scanners need the contrast, which is
 * why this is the one place in a dark-first app that paints white.
 */
export function JoinPanel({ code, joinUrl }: JoinPanelProps) {
  return (
    <Stack
      as="section"
      gap={26}
      align="center"
      className={styles.panel}
      aria-labelledby="join-heading"
    >
      <h1 id="join-heading" className={styles.heading}>
        Scan to join
      </h1>

      <Box background="light" padding={20} radius="card" className={styles.qr}>
        <QRCode
          value={joinUrl}
          size={256}
          // Rendered as a responsive block; `size` only sets the viewBox.
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          bgColor="#FFFFFF"
          fgColor="#0A0A0B"
          viewBox="0 0 256 256"
          title={`QR code to join room ${code}`}
        />
      </Box>

      <p className={styles.hint}>Or enter this code</p>
      <RoomCode code={code} />
    </Stack>
  )
}
