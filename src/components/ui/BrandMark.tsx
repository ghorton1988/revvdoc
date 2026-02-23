import Image from 'next/image';

interface BrandMarkProps {
  /**
   * Width/height in px. The image is square; glow scales proportionally.
   * Default: 280.
   */
  size?: number;
  className?: string;
}

/**
 * BrandMark — RevvDoc hero logo with full motion and zero square-edge appearance.
 *
 * Visual layers (bottom → top):
 *  1. Outer bloom — wide, soft, static teal halo
 *  2. Inner glow — tight halo that breathes (animate-breathe-glow)
 *  3. Image — revvdoc-gauge.png rendered with TWO edge-elimination techniques:
 *       • mix-blend-mode: screen  → dark background pixels dissolve into the page
 *       • radial mask-image       → outer edge feathers to transparent (circular crop)
 *       Together they guarantee no square/box boundary is visible on any background.
 *  4. Sweep overlay — narrow light beam that slowly scans the gauge face
 *
 * The outer wrapper carries animate-fade-up for the float-in on first render.
 * All animations respect prefers-reduced-motion via globals.css.
 */
export function BrandMark({ size = 280, className = '' }: BrandMarkProps) {
  // Radial mask fades the PNG edge to transparent, eliminating any square boundary
  const radialMask = 'radial-gradient(circle at center, black 48%, transparent 72%)';

  return (
    <div
      className={`relative flex items-center justify-center animate-fade-up ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer bloom — wide, static, provides base glow depth */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-brand/[0.07] blur-[72px] scale-[1.9]"
      />

      {/* Inner glow — breathes in and out (opacity pulse) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-brand/[0.18] blur-3xl scale-[1.35] animate-breathe-glow"
      />

      {/*
        Gauge image:
        • mix-blend-screen makes dark pixels transparent on dark surfaces
        • maskImage radial fade feathers the circular edge to full transparency
        No square edge can appear regardless of background color or brightness.
      */}
      <Image
        src="/revvdoc-gauge.png"
        alt="RevvDoc — Mobile Vehicle Service"
        width={size}
        height={size}
        className="relative z-10 object-contain mix-blend-screen"
        style={{
          maskImage: radialMask,
          WebkitMaskImage: radialMask,
        }}
        priority
      />

      {/*
        Gauge sweep — a narrow light-beam gradient that translates slowly
        left→right across the gauge face. Clipped to the circular bounds
        by overflow-hidden + radial mask matching the image mask above.
        z-20 so it appears above the image as a surface glint.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-full"
        style={{
          maskImage: radialMask,
          WebkitMaskImage: radialMask,
        }}
      >
        <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent animate-gauge-sweep" />
      </div>
    </div>
  );
}
