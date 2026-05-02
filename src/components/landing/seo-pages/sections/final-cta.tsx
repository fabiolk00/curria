import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function FinalCta({ theme, role }: { theme: SEOPageProps['theme'], role: string }) {
  return (
    <section className="py-32 bg-zinc-50 relative overflow-hidden flex justify-center items-center border-t border-zinc-200">
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-10 ${theme.bgAccent.replace('bg-', 'bg-')}`} />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl p-12 lg:p-16 shadow-2xl border border-zinc-200 overflow-hidden relative"
        >
          {/* Subtle grid on dark bg */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] bg-[size:16px_16px]" />
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-[56px] font-bold text-[#0a0a0a] tracking-normal leading-tight mb-6">
              Pronto para sua próxima vaga de {role}?
            </h2>
            <p className="text-lg md:text-xl text-zinc-600 mb-10 max-w-2xl mx-auto font-medium">
              Pare de adivinhar o que o ATS quer. Obtenha uma revisão detalhada do seu currículo e otimize-o para as melhores empresas instantaneamente.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
              <a href="/criar-conta" className={`h-14 px-8 rounded-lg text-white font-semibold text-lg shadow-md transition-all hover:shadow-lg ${theme.accent} hover:opacity-90 flex items-center gap-2 w-full sm:w-auto justify-center`}>
                Analisar Meu Currículo grátis
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-zinc-500 text-sm font-medium">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                Sem cartão de crédito
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-zinc-300" />
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                Exportação em PDF instantânea
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-zinc-300" />
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                100% de Privacidade
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

