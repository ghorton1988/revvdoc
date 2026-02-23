/**
 * AppBackdrop — Immersive full-page backdrop for splash/auth/onboarding contexts.
 *
 * Renders as `position: absolute; inset: 0; z-index: -1` so it sits directly
 * behind the page content within its parent's stacking context.
 *
 * IMPORTANT: The parent wrapper must have `position: relative` and `overflow: hidden`
 * (or a fixed height) so this backdrop doesn't leak outside the page.
 *
 * Layers (bottom → top):
 *  1. Vignette edges — darkens L/R/bottom to frame the content
 *  2. Primary teal bloom — large, soft radial glow at ~15% from top (behind BrandMark)
 *  3. Secondary bloom — smaller, lower, adds depth
 *  4. Noise texture — pure CSS pseudo-element, 4% opacity, no external asset needed
 *
 * The global HudBackground (root layout) provides the circuit grid and corner brackets.
 * AppBackdrop adds page-specific richness on top of that base layer.
 */
export function AppBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      {/* Left vignette */}
      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-surface-base/60 to-transparent" />
      {/* Right vignette */}
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-surface-base/60 to-transparent" />
      {/* Bottom vignette — softens the lower half */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface-base via-surface-base/50 to-transparent" />

      {/* Primary bloom — sits directly behind the BrandMark at page top */}
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[480px] h-[320px] rounded-full bg-brand/[0.10] blur-[100px]" />

      {/* Secondary bloom — lower, cooler, creates sense of depth */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[300px] h-[220px] rounded-full bg-brand/[0.05] blur-[80px]" />

      {/* Tertiary accent — far bottom-right corner */}
      <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-brand/[0.04] blur-[60px]" />

      {/*
        Noise texture — generated as a CSS background-image using a data-URI SVG feTurbulence filter.
        No external file or JS library required. Sits at 3% opacity so it's only perceptible
        on close inspection, adding photographic grain to the smooth gradient surface.
      */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
        }}
      />
    </div>
  );
}
