"use client"

import { AnimatePresence, motion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { BrandText } from "@/components/brand-wordmark"
import { landingFaqs } from "@/components/landing/faq-content"

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="border-b border-zinc-200/50 bg-[#FAFAFA] py-32">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          className="mb-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="mb-6 text-[40px] font-bold leading-[1.1] tracking-normal text-zinc-900">
            Perguntas frequentes
          </h2>
          <p className="text-xl font-medium leading-relaxed text-zinc-500">
            <BrandText
              text="Tire suas dúvidas sobre ATS, currículo e como o CurrIA ajuda você a conseguir mais entrevistas."
              className="font-medium text-zinc-500"
            />
          </p>
        </motion.div>

        <div className="space-y-4">
          {landingFaqs.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <div
                key={faq.question}
                className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? "border-zinc-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
                    : "border-zinc-200/80 bg-transparent hover:border-zinc-300 hover:bg-white/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="group flex w-full items-center justify-between px-8 py-6 text-left focus:outline-none"
                >
                  <span className="pr-8 text-lg font-bold tracking-tight text-zinc-900">
                    {faq.question}
                  </span>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-transform duration-300 ${
                      isOpen
                        ? "rotate-180 border-zinc-200 bg-zinc-100"
                        : "border-zinc-200/80 bg-white group-hover:border-zinc-300"
                    }`}
                  >
                    <ChevronDown className={`h-4 w-4 ${isOpen ? "text-zinc-700" : "text-zinc-500"}`} />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="px-8 pb-8 pt-0"
                    >
                      <BrandText
                        text={faq.answer}
                        className="text-[15px] font-medium leading-relaxed text-zinc-500"
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
