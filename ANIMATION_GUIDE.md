/**
 * SNAPPY & TACTILE ANIMATION GUIDE
 * ================================
 * 
 * Apply these patterns across all UI components for consistent,
 * warehouse-friendly interactions. All timings optimized for warehouse use:
 * - Duration: 150-200ms (snappy, not sluggish)
 * - Easing: easeOut (instant feedback)
 * - Animate: transform + opacity only (GPU accelerated)
 */

// ============================================
// 1. BUTTONS & CLICKABLE ELEMENTS
// ============================================

// ✅ GOOD: Snappy button with scale tap
<motion.button
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.15, ease: "easeOut" }}
  className="px-4 py-2 rounded-lg bg-primary text-white"
>
  Click Me
</motion.button>

// ❌ BAD: Too long, too many transforms
<motion.button
  whileHover={{ y: -4, boxShadow: "..." }}
  whileTap={{ scale: 0.9, y: 2 }}
  transition={{ duration: 0.4 }}
>
  Click Me
</motion.button>

// ============================================
// 2. CARDS & SELECTABLE ITEMS
// ============================================

// ✅ GOOD: Simple hover lift + tap
<motion.div
  whileHover={{ y: -2 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15, ease: "easeOut" }}
  className="p-4 rounded-lg border"
>
  Card Content
</motion.div>

// ============================================
// 3. MODALS / DRAWERS / DROPDOWNS
// ============================================

// ✅ GOOD: Slide up + fade in, 200ms
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  Modal Content
</motion.div>

// ============================================
// 4. LISTS & GRIDS (Stagger pattern)
// ============================================

// ✅ GOOD: Stagger 30ms between items
{items.map((item, idx) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.03, duration: 0.2, ease: "easeOut" }}
  >
    {item.name}
  </motion.div>
))}

// ============================================
// 5. PROGRESS BARS & DATA VISUALIZATION
// ============================================

// ✅ GOOD: Width animate only (no height/margin), 250ms
<motion.div
  initial={{ width: 0 }}
  animate={{ width: `${percentage}%` }}
  transition={{ duration: 0.25, ease: "easeOut" }}
  className="h-2 bg-primary rounded-full"
/>

// ============================================
// COMMON MISTAKES TO AVOID
// ============================================

// ❌ DON'T: Animate height/width (causes reflow)
// ❌ DON'T: Use duration > 300ms (feels sluggish in warehouse)
// ❌ DON'T: Chain too many animations (overwhelming)
// ❌ DON'T: Animate left/top/margin (use translate instead)
// ❌ DON'T: Use easeInOutCubic everywhere (only use easeOut for responsiveness)

// ============================================
// IMPORT & USAGE
// ============================================

import { motion } from "framer-motion";
import { snappyAnimations } from "@/lib/animations";

// Use preset:
<motion.div {...snappyAnimations.slideUpFade}>
  Content
</motion.div>

// Or mix and match:
<motion.button
  whileTap={snappyAnimations.tap}
  transition={{ duration: 0.15, ease: "easeOut" }}
>
  Click
</motion.button>
