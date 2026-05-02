import { motion } from "motion/react";
import { Check, X, FileSearch } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function AtsFilterSection({ theme, checklist }: { theme: SEOPageProps['theme'], checklist: SEOPageProps['content']['filterChecklist'] }) {
  return (
    <section className="py-32 bg-zinc-50 border-b border-zinc-200 relative overflow-hidden">
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.05] pointer-events-none">
        <div className={`absolute inset-0 rounded-full blur-[100px] ${theme.bgAccent}`} />
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="lg:pr-12"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-white border border-zinc-200 shadow-sm relative">
            <div className={`absolute inset-0 ${theme.bgAccent} opacity-20 blur-xl`} />
            <FileSearch className="w-8 h-8 text-[#0a0a0a] relative z-10" />
          </div>
          <h2 className="text-[40px] leading-[1.1] font-bold text-[#0a0a0a] tracking-normal mb-6">
            Como os sistemas ATS leem o seu currículo
          </h2>
          <p className="text-lg text-zinc-600 mb-6 leading-relaxed font-medium">
            O software de rastreamento (ATS) extrai texto de cima para baixo. Formatações complexas quebram esse processo, resultando em dados embaralhados ou campos vazios no seu perfil do sistema.
          </p>
          <p className="text-lg text-zinc-600 leading-relaxed font-medium">
            Após a extração, o algoritmo classifica você com base na porcentagem de correspondência de palavras-chave da vaga. Se a pontuação for baixa, sua candidatura é arquivada automaticamente.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="bg-white border border-zinc-200 rounded-2xl p-10 shadow-xl relative overflow-hidden group hover:border-zinc-300 transition-all duration-300"
        >
          {/* Subtle top glare */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <h3 className="font-bold text-xl text-[#0a0a0a] mb-8 flex items-center gap-3 relative z-10">
            Checklist de Leitura ATS
            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200">Regras Críticas</span>
          </h3>
          <ul className="space-y-5 relative z-10">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-4 pb-5 border-b border-zinc-200 last:border-0 last:pb-0">
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${item.checked ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-rose-100 text-rose-600 border-rose-200'}`}>
                  {item.checked ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div>
                  <p className="text-zinc-700 font-medium leading-relaxed">{item.item}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

