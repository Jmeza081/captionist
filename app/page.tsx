import { Stack } from '@/components/atoms/Stack'
import { JoinPanel } from '@/components/molecules/JoinPanel'
import styles from './page.module.scss'

// Placeholder until rooms are real: the code and link are generated per room.
const ROOM_CODE = 'C-F34213'
const JOIN_URL = 'https://github.com/Jmeza081'

export default function HomePage() {
  return (
    <Stack as="main" align="center" justify="center" className={styles.main}>
      <JoinPanel code={ROOM_CODE} joinUrl={JOIN_URL} />
    </Stack>
  )
}
