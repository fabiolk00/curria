import { motion } from "motion/react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function HeroSection({ theme, content }: { theme: SEOPageProps['theme'], content: SEOPageProps['content'] }) {
  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] pt-24 pb-32 border-b border-zinc-200/50">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className={`absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-gradient-to-tr from-transparent ${theme.bgAccent.replace('bg-', 'via-').replace('50', '200/40')} to-transparent rounded-full opacity-40 blur-3xl pointer-events-none`} />
      
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <div className={`inline-flex items-center rounded-full border border-zinc-200/80 bg-white shadow-sm px-3 py-1.5 text-xs font-semibold ${theme.textAccent} mb-8 tracking-wide uppercase`}>
            <span className={`flex h-2 w-2 rounded-full ${theme.accent} mr-2 animate-pulse`} />
            {theme.badgeLabel}
          </div>
          
          <h1 className="text-5xl md:text-[64px] font-bold tracking-normal text-zinc-900 leading-[1.05] mb-6">
            {content.heroTitle}
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-500 mb-10 leading-relaxed max-w-xl font-medium">
            {content.heroSubtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/criar-conta" className={`h-12 px-6 rounded-md text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:shadow-md ${theme.accent} hover:opacity-90 flex items-center justify-center gap-2`}>
              Analisar meu Currículo grátis
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/criar-conta" className="h-12 px-6 rounded-md bg-white border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors shadow-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-400" />
              Criar conta grátis
            </a>
          </div>
          
          <div className="mt-10 flex items-center gap-4 text-sm text-zinc-500 font-medium">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#FAFAFA] bg-zinc-200 shadow-sm" />
              ))}
            </div>
            <p>Confiado por <span className="text-zinc-900 font-semibold">10.000+</span> profissionais</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative lg:h-[500px] rounded-xl border border-zinc-200/80 bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col"
        >
          {/* Mac window dots - Linear style */}
          <div className="h-12 border-b border-zinc-100 bg-white/50 backdrop-blur-sm flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            </div>
            <div className="mx-auto flex h-6 px-3 rounded-md bg-zinc-100/80 items-center justify-center text-[11px] text-zinc-400 font-mono tracking-tight">
              trampofy.com.br/verificador-ats
            </div>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
          <div className="flex-1 flex items-stretch justify-stretch bg-[#FDFCFC]">
            {theme.heroVisual}
          </div>
        </motion.div>
      </div>
    </section>
  );
}


