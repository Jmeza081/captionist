'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Inline } from '@/components/atoms/Inline'
import { Stack } from '@/components/atoms/Stack'
import { clearUsage, usageReport, type ProviderUsage, type UsageReport } from '@/lib/gifs/usage'
import styles from './GifUsage.module.scss'

/**
 * What this app has actually cost a GIF provider, on this browser.
 *
 * It lives in the gallery rather than anywhere a player can reach because that
 * is what it is: a developer's read-out of a local counter, for filling in a
 * production-key application with a measured number instead of ADR-0021's
 * model. Not a design-system component and not reusable — the gallery is the
 * only surface that wants it.
 *
 * Read after the first paint, never during: the ledger is in `localStorage`,
 * which does not exist while this is being server-rendered.
 */

function Figures({ usage }: { usage: ProviderUsage }) {
  return (
    <tr>
      <td className={styles.provider}>{usage.provider}</td>
      <td className={styles.n}>{usage.calls}</td>
      <td className={styles.n}>{usage.byKind.trending}</td>
      <td className={styles.n}>{usage.byKind.search}</td>
      <td className={styles.n}>{usage.byKind.share}</td>
      <td className={styles.n}>{usage.byKind.items}</td>
      <td className={styles.n}>{usage.failed}</td>
      <td className={styles.n}>{usage.quota}</td>
      <td className={styles.n}>
        {usage.peakHour}
        {usage.peakAt && <span className={styles.at}>{usage.peakAt.slice(5)}</span>}
      </td>
    </tr>
  )
}

function Table({ title, rows }: { title: string; rows: readonly ProviderUsage[] }) {
  if (rows.length === 0) return null
  return (
    <Stack gap={8}>
      <span className={styles.tableTitle}>{title}</span>
      {/* Its own scroller: eight columns do not fit a phone, and the page
          itself must never scroll sideways. */}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Calls</th>
              <th>Trending</th>
              <th>Search</th>
              <th>Share</th>
              <th>Items</th>
              <th>Failed</th>
              <th>Quota</th>
              <th>Peak/hr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((usage) => (
              <Figures key={usage.provider} usage={usage} />
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}

export function GifUsage() {
  const [report, setReport] = useState<UsageReport | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  /**
   * Read from an async continuation, never synchronously inside the effect.
   *
   * The same rule `useGifSearch` follows for its arrival board, and lint holds
   * it: setting state in an effect body is a render the compiler may not have
   * run. A microtask is enough — the ledger is a synchronous `localStorage`
   * read, it just must not happen during the effect itself.
   */
  const refresh = useCallback(() => {
    void Promise.resolve().then(() => setReport(usageReport()))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(JSON.stringify(usageReport(), null, 2))
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }, [])

  if (!report) return <p className={styles.note}>Reading the ledger…</p>

  const empty = report.production.length === 0 && report.development.length === 0

  return (
    <Stack gap={14}>
      {empty ? (
        <p className={styles.note}>
          Nothing counted yet. The offline shelf is free and never appears here —
          play a round with <code>?gifs=klipy</code> or <code>?gifs=giphy</code> and
          come back.
        </p>
      ) : (
        <>
          {/* Not `Tag` — that atom shouts in CSS, which is right for HOST and
              wrong for a date range. */}
          <span className={styles.window}>
            {report.hoursObserved} {report.hoursObserved === 1 ? 'hour' : 'hours'} observed
            {report.from && ` · ${report.from.slice(5)} → ${report.to?.slice(5)}`}
          </span>

          <Table title="Production" rows={report.production} />
          <Table title="Development" rows={report.development} />

          <p className={styles.note}>
            Quote the production figures. Development is inflated: React’s
            StrictMode runs the arrival effect twice, so a dev board really does
            cost two calls. <strong>Peak/hr is one seat’s peak, not one room’s</strong> —
            every player pays for their own boards, so a room of ten costs roughly
            ten times this against the same hourly allowance.
          </p>
        </>
      )}

      <Inline gap={10}>
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy report'}</Button>
        <Button
          variant="outline"
          onClick={() => {
            clearUsage()
            setCopied(false)
            refresh()
          }}
        >
          Reset
        </Button>
        <Button variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </Inline>
    </Stack>
  )
}
