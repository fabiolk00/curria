import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { CheckCircle2, XCircle } from "lucide-react"

export function BeforeAfterComparison() {
  const [isImproved, setIsImproved] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsImproved((prev) => !prev)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-card border rounded-xl overflow-hidden shadow-2xl">
      <div className="absolute top-0 left-0 w-full p-4 bg-muted/50 border-b flex justify-between items-center z-10">
        <span className="text-sm font-medium">
          {isImproved ? "Currículo Otimizado" : "Currículo Original"}
        </span>
        {isImproved ? (
          <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            ATS Friendly
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-destructive font-medium">
            <XCircle className="w-4 h-4" />
            Reprovado ATS
          </span>
        )}
      </div>

      <div className="pt-16 p-6 h-full relative overflow-hidden">
        <AnimatePresence mode="wait">
          {!isImproved ? (
            <motion.div
              key="before"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              {/* Header - Nome mal formatado */}
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-muted-foreground">John Doe</h3>
                <p className="text-xs text-muted-foreground/70">john.doe@email.com | (11) 99999-9999</p>
              </div>

              {/* Objetivo genérico */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive/60">OBJETIVO</h4>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Busco uma oportunidade na área de tecnologia para crescer profissionalmente e desenvolver minhas habilidades
                </p>
              </div>

              {/* Experiência sem palavras-chave */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-destructive/60">EXPERIÊNCIA</h4>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground/80">Desenvolvedor</p>
                  <p className="text-xs text-muted-foreground/60">Empresa XYZ - 2021-2023</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="text-xs text-muted-foreground/60 list-disc">
                      Trabalhei em projetos web
                    </li>
                    <li className="text-xs text-muted-foreground/60 list-disc">
                      Ajudei a equipe com tarefas diárias
                    </li>
                    <li className="text-xs text-muted-foreground/60 list-disc">
                      Participei de reuniões e planejamentos
                    </li>
                  </ul>
                </div>
              </div>

              {/* Habilidades sem destaque */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive/60">HABILIDADES</h4>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  HTML, CSS, JavaScript, trabalho em equipe, comunicação, organização
                </p>
              </div>

              {/* Formação */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive/60">FORMAÇÃO</h4>
                <p className="text-xs text-muted-foreground/60">
                  Bacharel em Sistemas de Informação
                </p>
                <p className="text-[11px] text-muted-foreground/50">
                  Universidade ABC - 2020
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="after"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              {/* Header - Nome bem formatado */}
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-foreground">John Doe</h3>
                <p className="text-xs font-medium text-muted-foreground">Desenvolvedora Full Stack</p>
                <p className="text-[11px] text-muted-foreground/80">john.doe@email.com | (11) 99999-9999</p>
              </div>

              {/* Resumo profissional com palavras-chave */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-primary">RESUMO PROFISSIONAL</h4>
                <p className="text-[11px] text-foreground/90 leading-relaxed">
                  Desenvolvedora <span className="bg-primary/20 px-1 py-0.5 rounded font-medium">Full Stack</span> com +2 anos de experiência em{" "}
                  <span className="bg-primary/20 px-1 py-0.5 rounded font-medium">React</span>,{" "}
                  <span className="bg-primary/20 px-1 py-0.5 rounded font-medium">Node.js</span> e{" "}
                  <span className="bg-primary/20 px-1 py-0.5 rounded font-medium">TypeScript</span>
                </p>
              </div>

              {/* Experiência com métricas */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary">EXPERIÊNCIA PROFISSIONAL</h4>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Desenvolvedor Full Stack</p>
                  <p className="text-[11px] text-muted-foreground">Empresa XYZ | 2021-2023</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="text-[11px] text-foreground/80 list-disc leading-relaxed">
                      Desenvolveu <span className="bg-green-500/20 px-1 py-0.5 rounded font-medium">15+ aplicações web</span> usando{" "}
                      <span className="bg-green-500/20 px-1 py-0.5 rounded font-medium">React</span> e{" "}
                      <span className="bg-green-500/20 px-1 py-0.5 rounded font-medium">TypeScript</span>
                    </li>
                    <li className="text-[11px] text-foreground/80 list-disc leading-relaxed">
                      Otimizou performance, <span className="bg-green-500/20 px-1 py-0.5 rounded font-medium">reduzindo carregamento em 40%</span>
                    </li>
                    <li className="text-[11px] text-foreground/80 list-disc leading-relaxed">
                      Liderou equipe de <span className="bg-green-500/20 px-1 py-0.5 rounded font-medium">3 desenvolvedores</span> em metodologia{" "}
                      <span className="bg-green-500/20 px-1 py-0.5 rounded font-medium">Agile/Scrum</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Habilidades técnicas estruturadas */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-primary">HABILIDADES TÉCNICAS</h4>
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">React</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">TypeScript</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">Node.js</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">Git</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">REST APIs</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">PostgreSQL</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">Agile</span>
                  <span className="bg-primary/20 text-[9px] px-2 py-1 rounded-full text-foreground font-medium">Docker</span>
                </div>
              </div>

              {/* Formação */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-primary">FORMAÇÃO ACADÊMICA</h4>
                <p className="text-[11px] font-semibold text-foreground">
                  Bacharel em Sistemas de Informação
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Universidade ABC - 2020
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Scanning effect */}
      <motion.div
        animate={{
          top: ["0%", "100%", "0%"],
        }}
        transition={{
          duration: 3,
          ease: "linear",
          repeat: Infinity,
        }}
        className="absolute left-0 w-full h-[2px] bg-primary/50 shadow-[0_0_8px_rgba(var(--primary),0.5)] z-20 pointer-events-none"
      />
    </div>
  )
}