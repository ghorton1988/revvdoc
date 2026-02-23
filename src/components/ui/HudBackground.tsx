/**
 * HudBackground — Leonardo-style decorative HUD overlay.
 *
 * Renders a fixed, full-screen layer sitting below all content (-z-10).
 * Consists of:
 *  - Dual radial teal glows (top-center + bottom-right)
 *  - Subtle circuit-grid SVG pattern (~3.5% opacity)
 *  - Four corner HUD bracket marks
 *
 * Zero layout impact: pointer-events-none, aria-hidden, fixed positioning.
 * One instance lives in the root layout — do NOT nest multiple instances.
 */
export function HudBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      {/* Primary radial glow — top center */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[360px] rounded-full bg-brand/[0.07] blur-[90px]" />

      {/* Secondary glow — bottom right edge */}
      <div className="absolute -bottom-20 -right-20 w-56 h-56 rounded-full bg-brand/[0.05] blur-[70px]" />

      {/* Circuit grid — faint teal lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="revvdoc-hud-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#00E5B4"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#revvdoc-hud-grid)" />
      </svg>

      {/* HUD corner brackets — top left */}
      <div className="absolute top-10 left-4 w-7 h-7 border-l-2 border-t-2 border-brand/[0.22] rounded-tl" />
      {/* top right */}
      <div className="absolute top-10 right-4 w-7 h-7 border-r-2 border-t-2 border-brand/[0.22] rounded-tr" />
      {/* bottom left — above nav bar */}
      <div className="absolute bottom-20 left-4 w-7 h-7 border-l-2 border-b-2 border-brand/[0.15] rounded-bl" />
      {/* bottom right */}
      <div className="absolute bottom-20 right-4 w-7 h-7 border-r-2 border-b-2 border-brand/[0.15] rounded-br" />
    </div>
  );
}
