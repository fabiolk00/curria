import { motion } from "motion/react";
import type { SEOPageProps } from "../seo-page-template";
import { Network } from "lucide-react";

export default function KeywordsSection({ theme, keywords }: { theme: SEOPageProps['theme'], keywords: SEOPageProps['content']['keywords'] }) {
  const categories = [...new Set(keywords.map(k => k.category))];

  return (
    <section className="py-32 bg-zinc-50 border-b border-zinc-200 relative overflow-hidden">
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] ${theme.bgAccent.replace('bg-', 'bg-')} rounded-full blur-[120px] opacity-20 pointer-events-none`} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8 bg-white ${theme.textAccent} border border-zinc-200 shadow-sm relative group`}>
            <div className={`absolute inset-0 ${theme.bgAccent.replace('bg-', 'bg-')} opacity-20 group-hover:opacity-30 transition-opacity rounded-2xl`} />
            <Network className="w-8 h-8 relative z-10" />
          </div>
          <h2 className="text-[40px] leading-[1.1] font-bold text-[#0a0a0a] tracking-normal mb-6">
            Palavras-Chave
          </h2>
          <p className="text-xl text-zinc-600 font-medium leading-relaxed">
            O ATS depende de variações exatas ou altamente específicas de palavras-chave para avaliar sua competência. Incluir estes termos estrategicamente na sua experiência é obrigatório.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category, i) => (
            <motion.div 
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm hover:border-zinc-300 hover:shadow-md transition-all duration-300 flex flex-col group relative overflow-hidden"
            >
              <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-${theme.textAccent.replace('text-', '')}/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
              
              <h3 className="text-lg font-bold text-[#0a0a0a] mb-6 pb-4 border-b border-zinc-100 flex items-center justify-between tracking-tight">
                {category}
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200`}>
                  {keywords.filter(k => k.category === category).length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2 mt-auto">
                {keywords.filter(k => k.category === category).map((kw, j) => (
                  <span 
                    key={j} 
                    className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-1 text-[13px] font-medium text-green-800 border border-green-300 group-hover:bg-green-200 group-hover:border-green-400 transition-colors"
                  >
                    {kw.term}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
