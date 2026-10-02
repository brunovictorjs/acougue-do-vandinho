"use client"

import { BoldIcon, Heading2Icon, ItalicIcon, Link2Icon, ListIcon, ListOrderedIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Markdown editor with a small toolbar and a live preview styled like the store. */
export function MarkdownEditor({ value, onChange, id = "markdown-editor" }: { value: string; onChange: (v: string) => void; id?: string }) {
  const textarea = () => document.getElementById(id) as HTMLTextAreaElement | null

  function wrap(before: string, after = before, placeholder = "texto") {
    const el = textarea()
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const selected = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + before + selected + after + value.slice(e)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + selected.length)
    })
  }

  function prefixLines(prefix: (i: number) => string) {
    const el = textarea()
    if (!el) return
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1
    const end = value.indexOf("\n", el.selectionEnd)
    const stop = end === -1 ? value.length : end
    const block = value
      .slice(start, stop)
      .split("\n")
      .map((l, i) => prefix(i) + l)
      .join("\n")
    onChange(value.slice(0, start) + block + value.slice(stop))
  }

  const tools = [
    { label: "Título", icon: Heading2Icon, run: () => prefixLines(() => "## ") },
    { label: "Negrito", icon: BoldIcon, run: () => wrap("**") },
    { label: "Itálico", icon: ItalicIcon, run: () => wrap("_") },
    { label: "Lista", icon: ListIcon, run: () => prefixLines(() => "- ") },
    { label: "Lista numerada", icon: ListOrderedIcon, run: () => prefixLines((i) => `${i + 1}. `) },
    { label: "Link", icon: Link2Icon, run: () => wrap("[", "](https://)", "texto do link") },
  ]

  return (
    <Tabs defaultValue="write" className="gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-0.5" role="toolbar" aria-label="Formatação">
          {tools.map(({ label, icon: Icon, run }) => (
            <Tooltip key={label}>
              <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={label} onClick={run} />}>
                <Icon />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <TabsList>
          <TabsTrigger value="write">Escrever</TabsTrigger>
          <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="write">
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={14} className="font-mono text-[13px] leading-relaxed" placeholder={"## Sobre o corte\nDescreva o produto…"} />
        <p className="mt-1 text-xs text-muted-foreground">Markdown: ## título, **negrito**, - lista, 1. lista numerada.</p>
      </TabsContent>
      <TabsContent value="preview">
        <div className="dark min-h-80 rounded-lg bg-background p-5 text-foreground">
          <div className="prose-product">{value ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown> : <p>Nada para mostrar ainda.</p>}</div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
