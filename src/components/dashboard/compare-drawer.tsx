"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type {
  CompareSnapshotRef,
  CompareSnapshotsResponse,
  SerializedResumeTarget,
  SerializedTimelineEntry,
} from "@/types/dashboard"

type CompareDrawerProps = {
  open: boolean
  busy: boolean
  versions: SerializedTimelineEntry[]
  targets: SerializedResumeTarget[]
  initialLeft?: CompareSnapshotRef
  initialRight?: CompareSnapshotRef
  result: CompareSnapshotsResponse | null
  onOpenChange: (open: boolean) => void
  onCompare: (left: CompareSnapshotRef, right: CompareSnapshotRef) => Promise<void>
}

function encodeSnapshotRef(ref: CompareSnapshotRef): string {
  if (ref.kind === "base") {
    return "base"
  }

  return `${ref.kind}:${ref.id}`
}

function parseSnapshotRef(value: string): CompareSnapshotRef {
  if (value === "base") {
    return { kind: "base" }
  }

  const [kind, id] = value.split(":")
  if (kind === "version" && id) {
    return { kind: "version", id }
  }

  if (kind === "target" && id) {
    return { kind: "target", id }
  }

  return { kind: "base" }
}

function renderSectionValue(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function CompareDrawer({
  open,
  busy,
  versions,
  targets,
  initialLeft,
  initialRight,
  result,
  onOpenChange,
  onCompare,
}: CompareDrawerProps) {
  const options = useMemo(() => {
    const baseOption = [{ value: "base", label: "Base atual" }]
    const versionOptions = versions.map((version) => ({
      value: `version:${version.id}`,
      label: `${version.label} - ${new Date(version.createdAt).toLocaleString("pt-BR")}`,
    }))
    const targetOptions = targets.map((target) => ({
      value: `target:${target.id}`,
      label: `Target ${target.id.slice(0, 8)} - ${target.targetJobDescription.slice(0, 48)}`,
    }))

    return [...baseOption, ...versionOptions, ...targetOptions]
  }, [targets, versions])

  const [leftValue, setLeftValue] = useState<string>(encodeSnapshotRef(initialLeft ?? { kind: "base" }))
  const [rightValue, setRightValue] = useState<string>(
    encodeSnapshotRef(
      initialRight ??
        (versions[0]
          ? { kind: "version", id: versions[0].id }
          : targets[0]
            ? { kind: "target", id: targets[0].id }
            : { kind: "base" }),
    ),
  )

  useEffect(() => {
    if (!open) {
      return
    }

    setLeftValue(encodeSnapshotRef(initialLeft ?? { kind: "base" }))
    setRightValue(
      encodeSnapshotRef(
        initialRight ??
          (versions[0]
            ? { kind: "version", id: versions[0].id }
            : targets[0]
              ? { kind: "target", id: targets[0].id }
              : { kind: "base" }),
      ),
    )
  }, [initialLeft, initialRight, open, targets, versions])

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Comparar snapshots</DrawerTitle>
          <DrawerDescription>
            Compare base, versoes historicas e variantes derivadas sem mutar o estado.
          </DrawerDescription>
        </DrawerHeader>

        <div className="grid gap-4 px-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Snapshot esquerdo</span>
            <select
              value={leftValue}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              disabled={busy}
              onChange={(event) => setLeftValue(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Snapshot direito</span>
            <select
              value={rightValue}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              disabled={busy}
              onChange={(event) => setRightValue(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="px-4 pt-4">
          <Button
            disabled={busy || leftValue === rightValue}
            onClick={() => void onCompare(parseSnapshotRef(leftValue), parseSnapshotRef(rightValue))}
          >
            {busy ? "Comparando..." : "Executar comparacao"}
          </Button>
        </div>

        <ScrollArea className="mt-4 flex-1 px-4">
          <div className="space-y-4 pb-4">
            {result && (
              <>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium">{result.left.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.left.source ?? result.left.kind}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium">{result.right.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.right.source ?? result.right.kind}
                  </p>
                </div>

                <Separator />

                {Object.keys(result.diff).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Nenhuma diferenca estrutural detectada entre os snapshots selecionados.
                  </div>
                ) : (
                  Object.entries(result.diff).map(([section, value]) => (
                    <div key={section} className="space-y-2 rounded-lg border border-border p-4">
                      <h3 className="text-sm font-semibold capitalize">{section}</h3>
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                        {renderSectionValue(value)}
                      </pre>
                    </div>
                  ))
                )}
              </>
            )}

            {!result && (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Selecione dois snapshots e execute a comparacao para ver o diff estruturado.
              </div>
            )}
          </div>
        </ScrollArea>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
