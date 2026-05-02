import { motion } from "motion/react";
import { Star } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function SpecializationsSection({ theme, specializations }: { theme: SEOPageProps['theme'], specializations: SEOPageProps['content']['specializations'] }) {
  return (
    <section className="py-32 bg-zinc-50 border-b border-zinc-200 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-200/50 via-zinc-50 to-zinc-50" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-3xl mb-20">
          <h2 className="text-[40px] leading-[1.1] font-bold text-[#0a0a0a] tracking-normal mb-6">
            Adapte por especialização
          </h2>
          <p className="text-xl text-zinc-600 font-medium leading-relaxed">
            Um currículo genérico pontua mal no ATS. Destaque seu nicho exato com estas palavras-chave e frameworks focados.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {specializations.map((spec, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-xl flex flex-col group hover:border-zinc-300 transition-all duration-300 relative overflow-hidden"
            >
              {/* Subtle top glare */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex flex-col gap-5 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-100 border border-zinc-200 shadow-inner relative">
                  <div className={`absolute inset-0 ${theme.bgAccent} opacity-20 blur-xl group-hover:opacity-40 transition-opacity`} />
                  <Star className="w-5 h-5 text-[#0a0a0a]" />
                </div>
                <h3 className="font-bold text-[#0a0a0a] text-xl tracking-tight">{spec.title}</h3>
              </div>
              <p className="text-zinc-600 mb-8 flex-1 leading-relaxed font-medium">
                {spec.desc}
              </p>
              <div className="pt-6 border-t border-zinc-200">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Palavras-chave Alvo</h4>
                <div className="flex flex-wrap gap-2.5">
                  {spec.tags.map((tag, j) => (
                    <span 
                      key={j} 
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-green-100 border border-green-300 text-green-800 shadow-sm group-hover:bg-green-200 group-hover:border-green-400 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
