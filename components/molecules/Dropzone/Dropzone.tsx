'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/atoms/Button'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Icon } from '@/components/atoms/Icon'
import styles from './Dropzone.module.scss'

export interface ReadyFile {
  name: string
  /** Already formatted for reading — "2.4MB", not a byte count. */
  size: string
  /** "1200×900". */
  dimensions?: string
  /** Object URL or data URI for the preview. */
  previewUrl: string
}

export interface DropzoneProps {
  /** When set, the zone resolves to the file-ready card. */
  file?: ReadyFile
  onFile: (file: File) => void
  onConfirm?: () => void
  onReplace?: () => void
  /** Largest accepted upload, for the hint line. */
  maxLabel?: string
  /**
   * Uploads are unavailable. The zone stays visible and focusable and says why
   * — "blocked is not disabled" applies to a whole surface, not only buttons.
   */
  blocked?: boolean
  /** What is missing. Shown in place of the hint when `blocked`. */
  reason?: string
}

/**
 * Upload, shared verbatim by both modes.
 *
 * Three states in one component — empty, drag-over, and file-ready — because
 * they're the same box at three moments, and the design draws them that way.
 * Clicking opens the file picker; the whole zone is also a keyboard target.
 */
export function Dropzone({
  file,
  onFile,
  onConfirm,
  onReplace,
  maxLabel = '12MB max',
  blocked = false,
  reason = 'Uploads land in a later release.',
}: DropzoneProps) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) onFile(dropped)
  }

  if (blocked) {
    return (
      <div className={`${styles.zone} ${styles.blocked}`} aria-disabled="true" tabIndex={0}>
        <Icon name="upload" size={26} color="#A18FFF" />
        <span className={styles.zoneTitle}>Upload your own</span>
        <span className={styles.zoneHint}>{reason}</span>
      </div>
    )
  }

  if (file) {
    return (
      <div className={styles.ready}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object
            URL for a just-picked file; next/image can't optimise it. */}
        <img className={styles.preview} src={file.previewUrl} alt="" />

        <div className={styles.readyBody}>
          <Eyebrow>Ready for the room</Eyebrow>
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.fileMeta}>
            {file.size}
            {file.dimensions ? ` · ${file.dimensions}` : ''}
          </span>

          <div className={styles.readyActions}>
            <Button size="inline" onClick={onConfirm}>
              Use this image
            </Button>
            <Button variant="secondary" size="inline" onClick={onReplace}>
              Replace
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.zone} ${over ? styles.over : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
      >
        <Icon name="upload" size={26} color="#A18FFF" />
        <span className={styles.zoneTitle}>
          {over ? 'Drop to upload' : 'Drop a GIF, PNG or screenshot'}
        </span>
        <span className={styles.zoneHint}>
          {over ? 'Let go and it’s in' : `or click to browse · ${maxLabel}`}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.input}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) onFile(picked)
        }}
      />
    </>
  )
}
