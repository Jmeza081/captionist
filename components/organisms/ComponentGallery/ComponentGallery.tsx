'use client'

import { useEffect, useRef, useState } from 'react'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { AtomsPanel } from './AtomsPanel'
import { AssetsPanel } from './AssetsPanel'
import { MoleculesPanel } from './MoleculesPanel'
import { OrganismsPanel } from './OrganismsPanel'
import { TokensPanel } from './TokensPanel'
import { SECTIONS, TABS, sectionsIn, tabFor, type TabId } from './sections'
import styles from './ComponentGallery.module.scss'

/**
 * Every built component, in its states — one tier at a time.
 *
 * This is the review surface: it renders the real components against the real
 * tokens, so a design review looks at the thing itself rather than a mockup of
 * it. It is also what `e2e/components.spec.ts` drives.
 *
 * **It is a dev tool and ships nowhere.** `next.config.mjs` only adds
 * `page.dev.tsx` to `pageExtensions` under the development server, so the route
 * does not exist in a production build and nothing on this page is in the
 * bundle.
 *
 * **Tabs, and one panel mounted at a time.** The page had grown to nineteen
 * sections down a single scroll, which made it a document rather than a
 * catalogue — and mounting all of it at once meant a chat rail, a host toolbox
 * and twenty televisions animating behind whatever you were actually looking
 * at. Only the open tab renders, so each panel keeps its own state and hands
 * the page back when you leave it.
 */

const PANELS: Record<TabId, () => React.JSX.Element> = {
  atoms: AtomsPanel,
  molecules: MoleculesPanel,
  organisms: OrganismsPanel,
  assets: AssetsPanel,
  tokens: TokensPanel,
}

export function ComponentGallery() {
  const [tab, setTab] = useState<TabId>('atoms')
  /**
   * A section the URL asked for that has not been rendered yet.
   *
   * The browser scrolls to `#media` before React has mounted the panel holding
   * it, so the hash is remembered here and acted on once the right tab is up.
   */
  const pending = useRef<string | undefined>(undefined)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    const apply = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1))
      const target = tabFor(hash)
      if (!target) return
      pending.current = hash
      setTab(target)
    }

    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  /**
   * Acted on once the tab holding it is the one rendering.
   *
   * The guard is the whole point: both effects run in the same commit, so on
   * first paint this fires while `tab` is still the default and the section is
   * not in the tree yet. Consuming the hash there scrolled nowhere and threw it
   * away — which is why `/components#hats` opened Assets at the top of Faces.
   */
  useEffect(() => {
    const id = pending.current
    if (!id || tabFor(id) !== tab) return
    pending.current = undefined
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [tab])

  /**
   * Picking a tab by hand drops whatever the URL had asked for, so coming back
   * to a tab later lands at its top rather than at the last section deep-linked
   * into it.
   */
  const choose = (id: TabId) => {
    pending.current = undefined
    setTab(id)
  }

  /** Roving arrow keys across the tab list, as the tab pattern expects. */
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = TABS[(index + step + TABS.length) % TABS.length]
    if (!next) return
    choose(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const Panel = PANELS[tab]
  const open = TABS.find((t) => t.id === tab)
  const sections = sectionsIn(tab)

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Eyebrow>Captionist · component library · dev only</Eyebrow>
        <h1 className={styles.title}>Built components</h1>
        <p className={styles.standfirst}>
          Every component that exists, rendered against the real tokens and
          sorted the way the folders are: by what each one depends on. Artwork in
          the component tabs is a stand-in — the room uses the provider&rsquo;s
          GIFs. Assets is the real thing.
        </p>
      </header>

      <div className={styles.tabBar}>
        <div className={styles.tabs} role="tablist" aria-label="Component tiers">
          {TABS.map((entry, index) => (
            <button
              key={entry.id}
              ref={(el) => {
                tabRefs.current[entry.id] = el
              }}
              type="button"
              role="tab"
              id={`tab-${entry.id}`}
              aria-selected={entry.id === tab}
              aria-controls={`panel-${entry.id}`}
              tabIndex={entry.id === tab ? 0 : -1}
              className={`${styles.tab} ${entry.id === tab ? styles.tabActive : ''}`}
              onClick={() => choose(entry.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {entry.label}
              <span className={styles.tabCount}>{sectionsIn(entry.id).length}</span>
            </button>
          ))}
        </div>
        {open && <p className={styles.tabBlurb}>{open.blurb}</p>}
      </div>

      <div className={styles.body}>
        {/* The rail is built from the same table the panel renders from, so it
            cannot name a section the panel does not have. Plain anchors: the
            hash is the deep link, and the handler above answers it. */}
        <nav className={styles.rail} aria-label={`${open?.label ?? ''} sections`}>
          <ul className={styles.railList}>
            {sections.map((id) => (
              <li key={id}>
                <a className={styles.railLink} href={`#${id}`}>
                  {SECTIONS[id].title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
        >
          <Panel />
        </div>
      </div>
    </div>
  )
}
