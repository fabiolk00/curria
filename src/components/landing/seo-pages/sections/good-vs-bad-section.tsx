import { motion } from "motion/react";
import { XCircle, CheckCircle, Search, EyeOff } from "lucide-react";
import type { SEOPageProps } from "../seo-page-template";

export default function GoodVsBadSection({ theme, bad, good }: { theme: SEOPageProps['theme'] } & SEOPageProps['content']['goodVsBad']) {
  return (
    <section className="py-32 bg-white border-b border-zinc-200 relative overflow-hidden">
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] ${theme.bgAccent.replace('bg-', 'bg-')} rounded-full blur-[150px] opacity-10 pointer-events-none`} />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-[40px] leading-[1.1] font-bold text-[#0a0a0a] tracking-normal mb-6">
            O que o ATS vê vs. O que você enviou
          </h2>
          <p className="text-xl text-zinc-600 font-medium leading-relaxed">
            Layouts complexos com colunas, fotos e gráficos viram uma &quot;sopa de letras&quot; no sistema do recrutador. Veja a diferença de um currículo estruturado para a máquina.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* BAD RESUME */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-6 h-full"
          >
            <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden flex flex-col shadow-lg relative group h-full">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-rose-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="h-14 border-b border-zinc-200 flex items-center px-6 bg-zinc-50 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-4 shadow-sm" />
                <span className="font-mono text-[13px] tracking-tight text-rose-700 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" /> Layout Visual (Reprovado)
                </span>
              </div>
              
              <div className="h-[480px] flex justify-center items-center bg-zinc-100 shrink-0 border-b border-zinc-200">
                {/* Abstract Bad Resume Skeleton */}
                <div className="w-[280px] h-[380px] bg-white rounded-lg border border-rose-200 p-5 flex gap-4 relative shadow-md">
                  {/* Left Column (Bad) */}
                  <div className="w-[35%] border-r border-zinc-200 pr-4 flex flex-col items-center gap-3">
                    {/* Profile Picture */}
                    <div className="w-12 h-12 rounded-full border-2 border-rose-300 bg-rose-50 flex items-center justify-center relative">
                      <XCircle className="w-5 h-5 text-rose-600 absolute -bottom-2 -right-2 bg-white rounded-full" />
                    </div>
                    <div className="w-full h-1.5 bg-zinc-300 rounded-full mt-2" />
                    <div className="w-2/3 h-1.5 bg-zinc-200 rounded-full" />
                    
                    {/* Skill bars (Bad) */}
                    <div className="w-full mt-4 flex flex-col gap-2 relative">
                      <XCircle className="w-4 h-4 text-rose-600 absolute -top-4 -right-2 bg-white rounded-full" />
                      <div className="w-full h-1 bg-zinc-200 rounded-full"><div className="w-[80%] h-full bg-rose-300 rounded-full" /></div>
                      <div className="w-full h-1 bg-zinc-200 rounded-full"><div className="w-[60%] h-full bg-rose-300 rounded-full" /></div>
                      <div className="w-full h-1 bg-zinc-200 rounded-full"><div className="w-[90%] h-full bg-rose-300 rounded-full" /></div>
                    </div>
                  </div>
                  
                  {/* Right Column (Bad) */}
                  <div className="flex-1 flex flex-col gap-3 relative">
                    <XCircle className="w-5 h-5 text-rose-600 absolute top-1/2 -right-2 bg-white rounded-full" />
                    <div className="w-3/4 h-2.5 bg-zinc-300 rounded-full" />
                    <div className="w-1/2 h-1.5 bg-zinc-200 rounded-full mb-2" />
                    
                    <div className="w-full h-[1px] bg-zinc-200" />
                    
                    <div className="w-1/2 h-2 bg-zinc-300 rounded-full mt-2" />
                    <div className="w-full h-1.5 bg-zinc-200 rounded-full" />
                    <div className="w-[90%] h-1.5 bg-zinc-200 rounded-full" />
                    <div className="w-[95%] h-1.5 bg-zinc-200 rounded-full" />
                    
                    <div className="w-1/2 h-2 bg-zinc-300 rounded-full mt-3" />
                    {/* Complex grid/icons in resume */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="w-full h-8 bg-rose-50 border border-rose-200 rounded-md" />
                      <div className="w-full h-8 bg-rose-50 border border-rose-200 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-white flex-1 flex flex-col">
                <span className="inline-flex items-center gap-2 text-rose-700 mb-3 font-semibold text-sm">
                  <XCircle className="w-4 h-4" />
                  Descrição Genérica
                </span>
                <p className="text-zinc-600 italic text-sm leading-relaxed border-l-2 border-rose-300 pl-4">
                  {bad}
                </p>
              </div>
            </div>
          </motion.div>

          {/* GOOD RESUME */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-6 h-full"
          >
            <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden flex flex-col shadow-lg relative group h-full">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="h-14 border-b border-zinc-200 flex items-center px-6 bg-zinc-50 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm mr-4" />
                <span className="font-mono text-[13px] tracking-tight text-emerald-700 font-medium flex items-center gap-2">
                  <Search className="w-4 h-4" /> 100% Legível (Aprovado)
                </span>
              </div>
              
              <div className="h-[480px] flex justify-center items-center bg-zinc-100 shrink-0 border-b border-zinc-200">
                {/* Abstract Good Resume Skeleton */}
                <div className="w-[280px] h-[380px] bg-white rounded-lg border border-emerald-200 p-6 flex flex-col gap-3 relative shadow-md">
                  <CheckCircle className="w-6 h-6 text-emerald-600 absolute -top-3 -right-3 bg-white rounded-full shadow-sm" />
                  
                  {/* Header (Good) */}
                  <div className="w-full flex flex-col items-center gap-2 mb-2 border-b border-emerald-100 pb-3">
                    <div className="w-2/3 h-3 bg-emerald-200 rounded-full" />
                    <div className="w-1/2 h-1.5 bg-emerald-100 rounded-full" />
                    <div className="w-3/4 h-1.5 bg-emerald-100 rounded-full" />
                  </div>
                  
                  {/* Experience (Good) */}
                  <div className="w-full flex flex-col gap-2 relative">
                    <div className="w-1/3 h-2 bg-emerald-200 rounded-full mb-1" />
                    
                    <div className="flex justify-between items-center w-full">
                      <div className="w-1/2 h-1.5 bg-zinc-300 rounded-full" />
                      <div className="w-1/4 h-1.5 bg-zinc-200 rounded-full" />
                    </div>
                    <div className="w-1/3 h-1.5 bg-zinc-200 rounded-full mb-1" />
                    
                    <div className="w-full flex gap-2 items-start">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full mt-0.5" />
                    </div>
                    <div className="w-[90%] flex gap-2 items-start">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full mt-0.5" />
                    </div>
                    <div className="w-[95%] flex gap-2 items-start">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full mt-0.5" />
                    </div>
                  </div>

                  {/* Skills (Good) */}
                  <div className="w-full flex flex-col gap-2 mt-2">
                    <div className="w-1/3 h-2 bg-emerald-200 rounded-full mb-1" />
                    <div className="w-full h-1.5 bg-zinc-200 rounded-full" />
                    <div className="w-[85%] h-1.5 bg-zinc-200 rounded-full" />
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-white flex-1 flex flex-col">
                <span className="inline-flex items-center gap-2 text-emerald-700 mb-3 font-semibold text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Orientado a Métricas
                </span>
                <div className="text-zinc-600 text-sm leading-relaxed border-l-2 border-emerald-300 pl-4 space-y-2">
                  {good.split('\n').map((line, i) => (
                    <p key={i} className="flex group">
                      <span className="text-emerald-600/40 mr-3 select-none text-xs mt-0.5">{(i + 1).toString().padStart(2, '0')}</span>
                      <span className="flex-1 text-emerald-900">{line}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

