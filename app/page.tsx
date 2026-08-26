import QRCode from 'react-qr-code'
import styles from './page.module.scss'

const ROOM_CODE = 'C-F34213'
const JOIN_URL = 'https://github.com/Jmeza081'

export default function HomePage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>{ROOM_CODE}</h1>
        <QRCode value={JOIN_URL} />
      </main>
    </div>
  )
}
