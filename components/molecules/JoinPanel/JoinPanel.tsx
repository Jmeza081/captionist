import QRCode from 'react-qr-code'
import { RoomCode } from '@/components/atoms/RoomCode'
import styles from './JoinPanel.module.scss'

export interface JoinPanelProps {
  /** The room code guests type if they can't scan. */
  code: string
  /** Absolute URL encoded in the QR code. */
  joinUrl: string
}

/**
 * The two ways into a room, side by side: scan the code, or type it.
 *
 * The QR sits on a light surface because scanners need the contrast, which is
 * why this is the one place in a dark-first app that paints a white panel.
 */
export function JoinPanel({ code, joinUrl }: JoinPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="join-heading">
      <h1 id="join-heading" className={styles.heading}>
        Scan to join
      </h1>

      <div className={styles.qr}>
        <QRCode
          value={joinUrl}
          size={256}
          // Rendered as a responsive block; `size` only sets the viewBox.
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          bgColor="#FFFFFF"
          fgColor="#0E0F10"
          viewBox="0 0 256 256"
          title={`QR code to join room ${code}`}
        />
      </div>

      <p className={styles.hint}>Or enter this code</p>
      <RoomCode code={code} />
    </section>
  )
}
