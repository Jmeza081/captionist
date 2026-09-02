import type { Metadata } from 'next'
import { Stack } from '@/components/atoms/Stack'
import { ComponentGallery } from '@/components/organisms/ComponentGallery'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: 'Components · Captionist',
  description: 'Every built component, in its states, against the real tokens.',
}

export default function ComponentsPage() {
  return (
    <Stack as="main" className={styles.main}>
      <ComponentGallery />
    </Stack>
  )
}
