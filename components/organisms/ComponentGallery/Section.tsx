import type { ReactNode } from 'react'
import { SECTIONS, type SectionId } from './sections'
import styles from './ComponentGallery.module.scss'

/**
 * One section of a panel, titled from the table rather than from the call.
 *
 * The title and the spec live in `sections.ts` because the jump rail needs
 * them before the panel renders. Passing them here as well would be the same
 * two strings in two files, which is exactly how a rail ends up naming a
 * section something the section does not call itself.
 */
export function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const { title, spec } = SECTIONS[id]

  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionSpec}>{spec}</span>
      </div>
      {children}
    </section>
  )
}

/** One state of one component, labelled with what it is showing. */
export function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.case}>
      <span className={styles.caseLabel}>{label}</span>
      <div className={styles.caseBody}>{children}</div>
    </div>
  )
}
