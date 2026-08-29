import styles from './Logo.module.scss'

export interface LogoProps {
  /**
   * Which mark the design draws. `header` is the 26px in-room bar, `landing`
   * the 34px front door.
   *
   * A named size rather than a number: both are `theme/` metrics, and a
   * numeric prop would put raw px back in the call site.
   */
  size?: 'header' | 'landing'
}

/**
 * The Captionist mark — a speech bubble mid-laugh, on the accent ground.
 *
 * Decorative everywhere it appears today: every call site sits it beside the
 * wordmark, and the page title already names the app.
 *
 * The artwork carries its own rounded corners, so nothing here rounds it a
 * second time — a `border-radius` on top would cut the ground away from the
 * bubble's tail.
 */
export function Logo({ size = 'header' }: LogoProps) {
  return (
    // The delivered vector, verbatim. next/image would rasterise it, and a
    // srcset is meaningless for a shape that resolves at every size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt=""
      aria-hidden="true"
      className={`${styles.logo} ${styles[size]}`}
    />
  )
}
