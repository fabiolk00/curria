import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { CheckCircle2, XCircle } from "lucide-react"

export function BeforeAfterComparison() {
  const [isImproved, setIsImproved] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsImproved((prev) => !prev)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-card border rounded-xl overflow-hidden shadow-2xl">
      <div className="absolute top-0 left-0 w-full p-4 bg-muted/50 border-b flex justify-between items-center z-10">
        <span className="text-sm font-medium">
          {isImproved ? "Currículo Otimizado" : "Currículo Original"}
        </span>
        {isImproved ? (
          <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            ATS Friendly
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-destructive font-medium">
            <XCircle className="w-4 h-4" />
            Baixa Visibilidade
          </span>
        )}
      </div>

      <div className="pt-16 p-6 h-full relative">
        <AnimatePresence mode="wait">
          {!isImproved ? (
            <motion.div
              key="before"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div>
                <div className="h-6 w-3/4 bg-muted rounded mb-2" />
                <div className="h-4 w-1/2 bg-muted/50 rounded" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-full bg-muted/50 rounded" />
                <div className="h-4 w-5/6 bg-muted/50 rounded" />
                <div className="h-4 w-4/5 bg-muted/50 rounded" />
              </div>
              <div className="space-y-4">
                <div className="h-5 w-1/3 bg-muted rounded" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-destructive/50 mt-1.5" />
                    <div className="h-4 w-[90%] bg-muted/30 rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-destructive/50 mt-1.5" />
                    <div className="h-4 w-[85%] bg-muted/30 rounded" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="after"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div>
                <div className="h-6 w-3/4 bg-primary/80 rounded mb-2" />
                <div className="h-4 w-1/2 bg-primary/40 rounded" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-full bg-primary/20 rounded" />
                <div className="h-4 w-5/6 bg-primary/20 rounded" />
                <div className="h-4 w-4/5 bg-primary/20 rounded" />
              </div>
              <div className="space-y-4">
                <div className="h-5 w-1/3 bg-primary/60 rounded" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                    <div className="h-4 w-[90%] bg-primary/20 rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                    <div className="h-4 w-[85%] bg-primary/20 rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                    <div className="h-4 w-[95%] bg-primary/20 rounded" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Scanning effect */}
      <motion.div
        animate={{
          top: ["0%", "100%", "0%"],
        }}
        transition={{
          duration: 3,
          ease: "linear",
          repeat: Infinity,
        }}
        className="absolute left-0 w-full h-[2px] bg-primary/50 shadow-[0_0_8px_rgba(var(--primary),0.5)] z-20 pointer-events-none"
      />
    </div>
  )
}