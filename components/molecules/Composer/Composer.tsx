'use client'

import { useId, type ReactNode } from 'react'
import { Icon } from '@/components/atoms/Icon'
import { ReactionCTA } from '@/components/atoms/ReactionCTA'
import { TextField } from '@/components/atoms/TextField'
import { TunedImage } from '@/components/molecules/TunedImage'
import styles from './Composer.module.scss'

export interface ComposerAttachment {
  src: string
  alt: string
}

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  /** Six one-tap emoji, left of the reaction affordance. */
  quickReactions: { id: string; glyph: string; label: string }[]
  onQuickReact: (id: string) => void
  /** Opens the searchable toolbar. */
  onReact?: () => void
  /** Opens the GIF panel. Only one surface may be open at a time. */
  onAttachGif?: () => void
  /** A GIF staged to send with the next message. */
  attachment?: ComposerAttachment
  onClearAttachment?: () => void
  /** The caption this message will answer, staged and cancellable. */
  replyTo?: { src?: string; caption: string }
  onClearReply?: () => void
  /** The GIF panel, rendered above the composer inside the rail. */
  panel?: ReactNode
}

/**
 * The chat composer.
 *
 * Send activates on text *or* an attachment — a GIF on its own is a complete
 * message, so requiring text alongside it would be wrong.
 */
export function Composer({
  value,
  onChange,
  onSend,
  quickReactions,
  onQuickReact,
  onReact,
  onAttachGif,
  attachment,
  onClearAttachment,
  replyTo,
  onClearReply,
  panel,
}: ComposerProps) {
  const fieldId = useId()
  const canSend = value.trim().length > 0 || attachment !== undefined

  return (
    <div className={styles.wrap}>
      {panel}

      <div className={styles.composer}>
        {replyTo && (
          <div className={styles.replying}>
            {replyTo.src && (
              // A set behind it too. The quote's thumbnail is the same remote
              // GIF as the message it points at, and it was the same blank
              // square while it arrived.
              <TunedImage className={styles.replyingThumb} src={replyTo.src} alt="" />
            )}
            <div className={styles.attachedBody}>
              <span className={styles.attachedLabel}>Replying to</span>
              <span className={styles.replyingCaption}>{replyTo.caption}</span>
            </div>
            <button
              type="button"
              className={styles.attachedClose}
              onClick={onClearReply}
              aria-label="Stop replying"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        )}

        {attachment && (
          <div className={styles.attached}>
            {/*
              The staged GIF, on a set until it arrives.

              This one is a provider's tile that was chosen a moment ago and is
              being fetched at its message size — the gap the picker board had,
              one tile wide. Distinct from the *picker* over this composer,
              which stays plain: a dozen flickering thumbnails over a live chat
              rail is a different amount of noise from one.
            */}
            <TunedImage
              className={styles.attachedPreview}
              src={attachment.src}
              alt={attachment.alt}
            />
            <div className={styles.attachedBody}>
              <span className={styles.attachedLabel}>GIF attached</span>
              <span className={styles.attachedHint}>
                Sends with your next message
              </span>
            </div>
            <button
              type="button"
              className={styles.attachedClose}
              onClick={onClearAttachment}
              aria-label="Remove attached GIF"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        )}

        <div className={styles.strip}>
          <div className={styles.quick}>
            {quickReactions.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.quickKey}
                onClick={() => onQuickReact(r.id)}
                aria-label={`React with ${r.label}`}
              >
                <span aria-hidden="true">{r.glyph}</span>
              </button>
            ))}
          </div>

          {onReact && <ReactionCTA onClick={onReact} className={styles.stripKey} />}

          {onAttachGif && (
            <button
              type="button"
              className={styles.gifKey}
              onClick={onAttachGif}
              // "GIF" alone tells a screen reader nothing about what the key
              // does; the affordance is a picker, same as the reaction CTA.
              aria-label="Attach a GIF"
              aria-expanded={panel !== undefined && panel !== null}
              aria-haspopup="dialog"
            >
              <span aria-hidden="true">GIF</span>
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSend) onSend()
          }}
        >
          <TextField
            id={fieldId}
            size="composer"
            placeholder="Say something regrettable…"
            aria-label="Message the room"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            trailing={
              <button
                type="submit"
                className={styles.send}
                disabled={!canSend}
                aria-label="Send message"
              >
                <Icon name="send" size={15} />
              </button>
            }
          />
        </form>
      </div>
    </div>
  )
}
