"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"

/**
 * Floating decorative elements that respond to scroll and viewport size.
 * This component adds visual interest to the hero section on larger screens.
 */
export function FloatingDecorations() {
  const [mounted, setMounted] = useState(false)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || prefersReduced) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Top-right floating accent */}
      <motion.div
        animate={{ 
          y: [0, -20, 0],
          rotate: [0, 180, 360]
        }}
        transition={{
          duration: 20,
          ease: "linear",
          repeat: Infinity,
        }}
        className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl opacity-0 md:opacity-40 lg:opacity-60"
      />
      
      {/* Bottom-left floating accent */}
      <motion.div
        animate={{ 
          y: [0, 20, 0],
          rotate: [360, 180, 0]
        }}
        transition={{
          duration: 25,
          ease: "linear",
          repeat: Infinity,
        }}
        className="absolute -bottom-32 -left-32 w-80 h-80 bg-secondary/5 rounded-full blur-3xl opacity-0 md:opacity-30 lg:opacity-50"
      />

      {/* Center accent for mid-to-large screens */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{
          duration: 15,
          ease: "easeInOut",
          repeat: Infinity,
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl opacity-0 lg:opacity-40"
      />
    </div>
  )
}
