import { AnimatePresence, motion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

import type { SeoFaqItem } from "@/lib/seo/json-ld"

export default function FaqSection({ faq }: { faq: readonly SeoFaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-32 bg-[#FAFAFA] border-b border-zinc-200/50">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-[40px] leading-[1.1] font-bold text-zinc-900 tracking-normal mb-6">
            Perguntas Frequentes
          </h2>
          <p className="text-xl text-zinc-500 font-medium leading-relaxed">
            Tudo o que você precisa saber sobre sistemas ATS e otimização de currículos.
          </p>
        </div>

        <div className="space-y-4">
          {faq.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div 
                key={item.question}
                className={`rounded-2xl transition-all duration-300 overflow-hidden ${isOpen ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-200' : 'bg-transparent border border-zinc-200/80 hover:border-zinc-300 hover:bg-white/50'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left focus:outline-none group"
                >
                  <span className="font-bold text-lg text-zinc-900 tracking-tight pr-8">{item.question}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 shadow-sm border ${isOpen ? 'rotate-180 bg-zinc-100 border-zinc-200' : 'bg-white border-zinc-200/80 group-hover:border-zinc-300'}`}>
                    <ChevronDown className={`w-4 h-4 ${isOpen ? 'text-zinc-700' : 'text-zinc-500'}`} />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="px-8 pb-8 pt-0"
                    >
                      <p className="text-zinc-500 leading-relaxed font-medium text-[15px]">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}


