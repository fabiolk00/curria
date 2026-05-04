"use client"

import { motion } from "motion/react"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, TrendingUp, Users, Briefcase, Quote } from "lucide-react"

const testimonials = [
  {
    name: "Ana Silva",
    role: "Analista de marketing",
    image: "https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHdvbWFufGVufDF8fHx8MTc3NTA2MTYxNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    result: "Recebi 5 entrevistas em 2 semanas",
    content:
      "Eu não entendia por que não avançava nas vagas. Depois que o Trampofy ajustou meu currículo para o ATS, comecei a receber retorno muito mais rápido.",
  },
  {
    name: "Carlos Mendes",
    role: "Desenvolvedor front-end",
    image: "https://images.unsplash.com/photo-1652471943570-f3590a4e52ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMG1hbnxlbnwxfHx8fDE3NzUwMzYxMzN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    result: "Consegui a vaga que eu queria",
    content:
      "Meu currículo já era bom, mas faltava mostrar melhor o impacto e as palavras-chave certas. Foi isso que fez a diferença nas entrevistas.",
  },
  {
    name: "Roberto Almeida",
    role: "Gerente de projetos",
    image: "https://images.unsplash.com/photo-1701980889802-55ff39e2e973?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwcHJvZmVzc2lvbmFsJTIwbWFufGVufDF8fHx8MTc3NTA2OTY0MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    result: "Passei a receber muito mais retorno",
    content:
      "Antes eu enviava currículo e não sabia o que estava errado. Depois dos ajustes, comecei a passar da triagem e chegar nas entrevistas com mais frequência.",
  },
]

const stats = [
  {
    icon: TrendingUp,
    value: "80%",
    label: "recebem mais respostas de recrutadores",
    description: "Usuários relatam mais respostas depois de ajustar o currículo para o ATS.",
  },
  {
    icon: Briefcase,
    value: "3x",
    label: "mais entrevistas",
    description: "Um currículo mais claro e mais alinhado aumenta suas chances de avançar.",
  },
  {
    icon: Users,
    value: "10k+",
    label: "currículos melhorados",
    description: "Profissionais de diferentes áreas já usaram a plataforma para se destacar.",
  },
]

export default function SocialProof() {
  return (
    <section className="py-24 relative overflow-hidden bg-muted/30">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Veja o impacto real no seu currículo</h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Não é só teoria. Veja o que acontece quando seu currículo passa a comunicar melhor o seu valor e o ATS consegue ler tudo com clareza.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-20 max-w-5xl mx-auto">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
            >
              <Card className="h-full border-border/50 bg-background/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <stat.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-4xl font-black text-foreground mb-2">{stat.value}</h3>
                  <p className="font-semibold text-lg mb-2">{stat.label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stat.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 + idx * 0.1 }}
            >
              <Card className="h-full border-border/50 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <CardContent className="p-8 pt-10 flex flex-col h-full">
                  <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/10 rotate-180 group-hover:text-primary/20 transition-colors" />

                  <div className="flex items-center gap-1 text-amber-500 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-4 h-4 fill-current" />
                    ))}
                  </div>

                  <h4 className="text-lg font-bold mb-3 text-foreground leading-snug">
                    &ldquo;{testimonial.result}&rdquo;
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-8 flex-grow">
                    <span className="font-medium text-foreground">{testimonial.content}</span>
                  </p>

                  <div className="flex items-center gap-4 mt-auto">
                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                      <AvatarImage src={testimonial.image} alt={testimonial.name} className="object-cover" />
                      <AvatarFallback>{testimonial.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

