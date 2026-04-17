"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { motion, type Variants } from "motion/react"
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Lightbulb,
  Plus,
} from "lucide-react"

import { BrandText } from "@/components/brand-wordmark"
import Footer from "@/components/landing/footer"
import Header from "@/components/landing/header"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { RoleLandingConfig } from "@/lib/seo/role-landing-config"

function DeveloperHeroVisual() {
  const items = [
    { label: "React", x: "8%", y: "22%" },
    { label: "Node", x: "38%", y: "10%" },
    { label: "TypeScript", x: "62%", y: "28%" },
    { label: "SQL", x: "22%", y: "62%" },
    { label: "AWS", x: "72%", y: "64%" },
  ]

  return (
    <div className="relative mx-auto mt-14 h-[260px] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-b from-background to-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.08),transparent_55%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 260" fill="none">
        <path d="M110 72 C 220 40, 280 40, 400 80" stroke="currentColor" className="text-primary/20" strokeWidth="1.5" />
        <path d="M400 80 C 500 110, 560 140, 650 170" stroke="currentColor" className="text-primary/20" strokeWidth="1.5" />
        <path d="M180 170 C 260 150, 310 130, 400 80" stroke="currentColor" className="text-primary/15" strokeWidth="1.5" />
      </svg>

      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [0, -4, 0] }}
          transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
          className="absolute"
          style={{ left: item.x, top: item.y }}
        >
          <div className="rounded-2xl border border-primary/15 bg-background/85 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-md">
            {item.label}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function DataEngineerHeroVisual() {
  const chips = ["Spark", "Airflow", "Databricks", "Kafka", "BigQuery"]

  return (
    <div className="relative mx-auto mt-14 h-[260px] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-b from-background to-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.08),transparent_55%)]" />

      <div className="absolute left-[8%] top-[34%] rounded-2xl border border-border/60 bg-background/85 px-5 py-3 shadow-sm backdrop-blur-md">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Source</div>
        <div className="mt-1 text-sm font-semibold">Raw events</div>
      </div>

      <div className="absolute left-[39%] top-[28%] rounded-2xl border border-primary/20 bg-background/90 px-5 py-4 shadow-sm backdrop-blur-md">
        <div className="text-xs uppercase tracking-wider text-primary">Transform</div>
        <div className="mt-1 text-sm font-semibold">ETL / Orchestration</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip, i) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs text-foreground"
            >
              {chip}
            </motion.span>
          ))}
        </div>
      </div>

      <div className="absolute right-[8%] top-[34%] rounded-2xl border border-border/60 bg-background/85 px-5 py-3 shadow-sm backdrop-blur-md">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Warehouse</div>
        <div className="mt-1 text-sm font-semibold">Analytics layer</div>
      </div>

      <div className="absolute left-[24%] top-[43%] h-[2px] w-[14%] overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className="h-full w-16 bg-gradient-to-r from-transparent via-primary to-transparent"
          animate={{ x: ["-100%", "220%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="absolute left-[63%] top-[43%] h-[2px] w-[14%] overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className="h-full w-16 bg-gradient-to-r from-transparent via-primary to-transparent"
          animate={{ x: ["-100%", "220%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 0.4 }}
        />
      </div>
    </div>
  )
}

function FinanceHeroVisual() {
  return (
    <div className="relative mx-auto mt-14 h-[260px] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-b from-background to-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.08),transparent_55%)]" />

      <div className="absolute inset-x-10 bottom-10 top-10">
        <svg className="h-full w-full" viewBox="0 0 680 180" fill="none">
          <path d="M0 150 C 120 140, 180 120, 260 118 C 330 116, 400 90, 470 80 C 560 66, 610 30, 680 24" stroke="currentColor" className="text-primary/50" strokeWidth="3" />
          <path d="M0 150 C 120 140, 180 120, 260 118 C 330 116, 400 90, 470 80 C 560 66, 610 30, 680 24" stroke="url(#grad)" strokeWidth="3" />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="680" y2="0">
              <stop stopColor="currentColor" className="text-primary/20" />
              <stop offset="0.5" stopColor="currentColor" className="text-primary/70" />
              <stop offset="1" stopColor="currentColor" className="text-primary" />
            </linearGradient>
          </defs>
        </svg>

        <motion.div
          className="absolute right-[6%] top-[4%] rounded-2xl border border-primary/20 bg-background/90 px-4 py-3 shadow-sm backdrop-blur-md"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Forecast</div>
          <div className="mt-1 text-lg font-semibold">+18%</div>
        </motion.div>

        <motion.div
          className="absolute left-[10%] bottom-[8%] rounded-2xl border border-border/60 bg-background/85 px-4 py-3 shadow-sm backdrop-blur-md"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        >
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Budget</div>
          <div className="mt-1 text-sm font-semibold">Controlado</div>
        </motion.div>
      </div>
    </div>
  )
}

function RoleHeroVisual({ variant }: { variant?: RoleLandingConfig["visualVariant"] }) {
  if (variant === "developer") return <DeveloperHeroVisual />
  if (variant === "data_engineer") return <DataEngineerHeroVisual />
  if (variant === "finance") return <FinanceHeroVisual />
  return null
}
  )
}
