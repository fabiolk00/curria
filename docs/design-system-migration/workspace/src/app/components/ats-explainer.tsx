import { Link } from "react-router"
import { 
  FileUp, 
  Cpu, 
  Network, 
  XCircle, 
  CheckCircle2, 
  ArrowRightCircle, 
  EyeOff
} from "lucide-react"
import { motion } from "motion/react"

const steps = [
  {
    icon: FileUp,
    title: "1. Você se candidata",
    description: "Você envia seu currículo através de um portal de vagas.",
  },
  {
    icon: Cpu,
    title: "2. O ATS escaneia",
    description: "Software automatizado analisa seu currículo buscando palavras-chave, formatação e relevância antes que um humano veja.",
  },
  {
    icon: Network,
    title: "3. Filtrado ou encaminhado",
    description: "Se seu currículo não corresponde aos critérios, é rejeitado antes mesmo de chegar à mesa do recrutador.",
    showPaths: true,
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
}

export default function AtsExplainer() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-background">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-primary/5 blur-3xl rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">O que é ATS e por que você deve se importar?</h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            <strong className="text-foreground">75% dos currículos nunca são vistos por um humano.</strong> Eles são rejeitados por sistemas ATS (Applicant Tracking Systems). Veja como funciona:
          </p>
        </motion.div>

        {/* Steps flow */}
        <motion.div 
          className="max-w-6xl mx-auto relative"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-[4.5rem] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-border to-transparent -z-10" />

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => (
              <motion.div 
                key={index} 
                variants={itemVariants}
                className="relative group"
              >
                <div className="h-full flex flex-col p-8 rounded-3xl bg-card border border-border/40 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
                  
                  {/* Hover background glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="mb-8 relative inline-flex">
                    <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300 shadow-sm">
                      <step.icon className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors duration-300 stroke-[1.5]" />
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-xl mb-3 tracking-tight group-hover:text-primary transition-colors">{step.title}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed flex-grow">{step.description}</p>
                  
                  {step.showPaths && (
                    <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10 text-sm font-medium">
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-5 w-5" />
                          <span>Rejeitado pelo robô</span>
                        </div>
                        <span className="text-destructive font-bold">75%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-sm font-medium">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>Visto pelo recrutador</span>
                        </div>
                        <span className="text-green-600 dark:text-green-500 font-bold">25%</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Callout */}
        <motion.div 
          className="mt-20 max-w-4xl mx-auto flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="p-[1px] rounded-3xl bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 w-full mb-10 overflow-hidden shadow-sm">
            <div className="bg-card rounded-[23px] p-8 md:p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10">
                <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">O CurrIA foi feito para vencer o ATS</h3>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Nós fazemos a engenharia reversa desse processo. Nossa inteligência artificial otimiza seu currículo com as palavras-chave certas para que você sempre caia na pilha do recrutador.
                </p>
              </div>
            </div>
          </div>
          
          <Link 
            to="/what-is-ats" 
            className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-1"
          >
            Entenda a fundo como vencer o ATS
            <ArrowRightCircle className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
