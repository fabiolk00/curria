import Link from "next/link"
import { Bot } from "lucide-react"

export default function Logo({
  size = "default",
  linkTo = "/",
}: {
  size?: "sm" | "default"
  linkTo?: string
}) {
  return (
    <Link href={linkTo} className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md ${
          size === "sm" ? "w-6 h-6" : "w-8 h-8"
        }`}
      >
        <Bot className={size === "sm" ? "w-4 h-4" : "w-5 h-5"} />
      </div>
      <span className={`font-bold tracking-tight ${size === "sm" ? "text-lg" : "text-xl"}`}>
        Curr
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500 dark:from-purple-400 dark:to-indigo-400">
          IA
        </span>
      </span>
    </Link>
  )
}
