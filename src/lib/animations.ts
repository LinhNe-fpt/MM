/**
 * Snappy & Tactile Animation Presets
 * Optimized for warehouse environments with speed-focused UX
 * All durations: 150-200ms, easing: easeOut (hardware accelerated)
 */

export const snappyAnimations = {
  // ====== TAP / PRESS INTERACTIONS ======
  // Button/card pressed down feeling
  tap: {
    scale: 0.95,
    transition: { duration: 0.15, ease: "easeOut" },
  },

  // Hover lift effect - subtle
  hoverLift: {
    y: -2,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // ====== DRAG & DROP AFFORDANCE ======
  // Item being dragged - lifted up
  dragging: {
    scale: 1.05,
    boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // Drop zone highlight
  dropZoneActive: {
    scale: 1.02,
    borderColor: "#0033A0",
    transition: { duration: 0.15, ease: "easeOut" },
  },

  // ====== TRANSITIONS & ENTRANCES ======
  // Slide up + fade (for modals, drawers, dropdowns)
  slideUpFade: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // Slide down + fade (for collapsing)
  slideDownFade: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // Fade in
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // Scale in (for appearing elements)
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.15, ease: "easeOut" },
  },

  // ====== STAGGER PATTERNS ======
  // For lists and grids
  staggerContainer: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { staggerChildren: 0.03, delayChildren: 0.1 },
  },

  staggerItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: "easeOut" },
  },

  // ====== LOADING & PROGRESS ======
  // Smooth progress fill
  progressFill: {
    initial: { width: 0 },
    animate: (customWidth: number) => ({ width: `${customWidth}%` }),
    transition: { duration: 0.25, ease: "easeOut" },
  },

  // Pulse for loading indicators
  pulse: {
    animate: { opacity: [1, 0.5, 1] },
    transition: { duration: 2, repeat: Infinity },
  },

  // ====== TRANSITIONS ======
  // Standard duration presets (in milliseconds)
  timing: {
    instant: 100,
    quick: 150,
    snappy: 200,
    smooth: 300,
  },

  // Easing functions
  ease: {
    out: "easeOut",
    inOut: "easeInOut",
    in: "easeIn",
  },
};

// ====== TAILWIND TRANSITIONS ======
// Add to your tailwind.config.ts for utility classes
export const transitionClasses = {
  // Fast transitions (150ms)
  "transition-snappy": "transition-all duration-150 ease-out",
  "transition-tap": "transition-all duration-150 ease-out active:scale-95",

  // Medium transitions (200ms)
  "transition-smooth": "transition-all duration-200 ease-out",

  // Transform-only (GPU accelerated)
  "transition-transform": "transition-transform duration-150 ease-out",

  // Opacity only
  "transition-opacity": "transition-opacity duration-150 ease-out",
};
