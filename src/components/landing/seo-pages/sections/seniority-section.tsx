import { motion } from "motion/react";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function SenioritySection({ theme, levels }: { theme: SEOPageProps['theme'], levels: SEOPageProps['content']['seniority'] }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-32 bg-white border-b border-zinc-200 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-[0.05] pointer-events-none">
        <div className={`absolute inset-0 rounded-full blur-[100px] ${theme.bgAccent}`} />
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="lg:pr-12"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-zinc-100 border border-zinc-200 shadow-inner relative">
            <div className={`absolute inset-0 ${theme.bgAccent} opacity-20 blur-xl`} />
            <TrendingUp className="w-8 h-8 text-[#0a0a0a] relative z-10" />
          </div>
          <h2 className="text-[40px] leading-[1.1] font-bold text-[#0a0a0a] tracking-normal mb-6">
            Ajustando para nível de experiência
          </h2>
          <p className="text-xl text-zinc-600 mb-10 leading-relaxed font-medium">
            O ATS espera diferentes pesos de palavras-chave e focos estruturais dependendo do nível da vaga. 
            Um currículo Sênior enfatiza impacto e liderança, enquanto um Júnior foca em base técnica e agilidade de aprendizado.
          </p>

          <div className="flex flex-col gap-3">
            {levels.map((level, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`text-left px-6 py-5 rounded-xl border text-[15px] font-bold tracking-tight transition-all duration-300 flex items-center justify-between group overflow-hidden relative ${
                  activeTab === i 
                    ? `bg-white border-zinc-300 text-[#0a0a0a] shadow-md scale-[1.02]` 
                    : 'bg-transparent border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
                }`}
              >
                {activeTab === i && (
                  <div className={`absolute inset-0 opacity-10 bg-gradient-to-r from-transparent via-zinc-200 to-transparent pointer-events-none`} />
                )}
                <span className="relative z-10">{level.level}</span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors relative z-10 ${
                  activeTab === i ? 'bg-zinc-100 text-[#0a0a0a]' : 'bg-zinc-50 text-zinc-400 group-hover:bg-zinc-100 group-hover:text-[#0a0a0a]'
                }`}>
                  →
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="bg-zinc-50 border border-zinc-200 rounded-2xl p-10 lg:p-12 shadow-xl min-h-[450px] relative overflow-hidden group hover:border-zinc-300 transition-all duration-500"
        >
          {/* Subtle top glare */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className={`absolute top-0 right-0 w-64 h-64 rounded-bl-[60px] opacity-[0.05] blur-[40px] ${theme.bgAccent.replace('bg-', 'bg-')}`} />
          
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10"
          >
            <h3 className="text-[28px] leading-tight font-bold text-[#0a0a0a] mb-10 pb-6 border-b border-zinc-200 tracking-tight flex items-center gap-3">
              Foco: <span className={theme.textAccent}>{levels[activeTab].level}</span>
            </h3>
            <ul className="space-y-8">
              {levels[activeTab].tips.map((tip, j) => (
                <li key={j} className="flex gap-5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[15px] font-bold bg-white border border-zinc-200 text-[#0a0a0a] shadow-inner relative">
                    <div className={`absolute inset-0 ${theme.bgAccent} opacity-20 blur-md rounded-full`} />
                    <span className="relative z-10">{j + 1}</span>
                  </div>
                  <p className="text-zinc-600 leading-relaxed pt-1.5 text-lg font-medium">{tip}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
