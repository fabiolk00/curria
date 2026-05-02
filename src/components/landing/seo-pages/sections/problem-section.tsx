import { motion } from "motion/react";
import { AlertCircle, FileX2, TerminalSquare } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function ProblemSection({ theme, cards }: { theme: SEOPageProps['theme'], cards: SEOPageProps['content']['problemCards'] }) {
  return (
    <section className="py-32 bg-white border-b border-zinc-200 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none">
        <div className={`absolute inset-0 rounded-full blur-[120px] ${theme.bgAccent}`} />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-[40px] leading-[1.1] font-bold text-[#0a0a0a] tracking-normal mb-6">
            Por que ótimos candidatos são rejeitados pelo ATS?
          </h2>
          <p className="text-xl text-zinc-600 font-medium leading-relaxed">
            Você pode ter a experiência perfeita, mas se o seu currículo não for legível por máquinas, recrutadores humanos nunca chegarão a vê-lo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-xl hover:border-zinc-300 transition-all duration-300 relative group overflow-hidden"
            >
              {/* Subtle top glare */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {/* Icon Container */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-zinc-100 border border-zinc-200 shadow-inner relative">
                <div className={`absolute inset-0 ${theme.bgAccent} opacity-20 blur-xl group-hover:opacity-40 transition-opacity`} />
                {i === 0 ? <FileX2 className="w-5 h-5 text-[#0a0a0a]" /> : i === 1 ? <AlertCircle className="w-5 h-5 text-[#0a0a0a]" /> : <TerminalSquare className="w-5 h-5 text-[#0a0a0a]" />}
              </div>
              
              <h3 className="text-xl font-bold text-[#0a0a0a] tracking-tight mb-4">{card.title}</h3>
              <p className="text-zinc-600 leading-relaxed font-medium">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

