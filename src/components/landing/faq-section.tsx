import { motion } from "motion/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "Meu currículo vai ficar robótico?",
    answer: "Não. O CurrIA otimiza a formatação e as palavras-chave para os sistemas de triagem (ATS), mas preserva sua história e suas conquistas. O resultado é um currículo profissional, claro e que demonstra seu valor humano."
  },
  {
    question: "Quanto tempo leva para ver resultados?",
    answer: "A maioria dos nossos usuários relata um aumento nas chamadas para entrevistas já nas primeiras 2 a 3 semanas após atualizarem seus perfis em plataformas de vagas com o novo currículo otimizado."
  },
  {
    question: "Funciona para todas as áreas e senioridades?",
    answer: "Sim. Desde estagiários até executivos (C-Level), e em áreas que vão de Tecnologia até Saúde. Nosso sistema analisa o mercado e foca em destacar as métricas e palavras-chave mais relevantes para o seu nível de experiência e segmento."
  },
  {
    question: "E se eu já tenho um currículo bom e bem diagramado?",
    answer: "Mesmo currículos com um ótimo design visual podem ser reprovados por sistemas ATS se usarem colunas complexas, tabelas ou fontes não padronizadas, que impedem a leitura automática. O CurrIA garante que seu bom conteúdo passe pelos filtros técnicos e chegue de fato à mesa dos recrutadores."
  },
  {
    question: "Meus dados estão seguros na plataforma?",
    answer: "Absolutamente. Levamos sua privacidade a sério. Seus dados pessoais e histórico profissional são armazenados com segurança e nunca são compartilhados ou vendidos a terceiros."
  }
]

export default function FaqSection() {
  return (
    <section className="py-24 relative overflow-hidden bg-background">
      <div className="container mx-auto px-4 max-w-4xl relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Perguntas Frequentes</h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Tudo o que você precisa saber sobre a otimização de currículos e o CurrIA.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-card border shadow-sm rounded-2xl p-6 md:p-8"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-semibold text-lg py-5 hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
