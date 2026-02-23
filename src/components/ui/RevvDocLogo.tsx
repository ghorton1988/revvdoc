import Image from 'next/image';

interface RevvDocLogoProps {
  /** Pixel size for width and height (image is square). Default: 120. */
  size?: number;
  /**
   * Whether to show the animated teal glow halo behind the logo.
   * Disable on pages where the logo is very small or motion is distracting.
   * Default: true.
   */
  glow?: boolean;
  className?: string;
}

/**
 * RevvDocLogo — Official brand logo (speedometer + ECG line + wordmark).
 *
 * Uses the /revvdoc-gauge.png asset with an optional pulsing teal glow halo.
 * Respects prefers-reduced-motion via CSS (glow pulse is CSS-only).
 */
export function RevvDocLogo({ size = 120, glow = true, className = '' }: RevvDocLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Pulsing glow halo — GPU-composited blur, no layout impact */}
      {glow && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-brand/20 blur-2xl scale-[1.6] animate-glow-pulse"
        />
      )}

      <Image
        src="/revvdoc-gauge.png"
        alt="RevvDoc — Mobile Vehicle Service"
        width={size}
        height={size}
        className="relative z-10 object-contain drop-shadow-[0_0_12px_rgba(0,229,180,0.3)]"
        priority
      />
    </div>
  );
}
