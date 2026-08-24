"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "model";
  content: string;
}

/** Yanıtla birlikte gelen teşhis bilgisi: hangi model, bilgi tabanı ne kadar taze. */
interface ChatMeta {
  model: string;
  modelFallback: string | null;
  retrieval: { mode: string; chunks: number; chars: number; omitted: number; budget: number };
  index: {
    builtAt: string;
    records: number;
    summaries: number;
    embedModel: string | null;
    warnings: string[];
  };
}

interface ChatbotPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const GREETING: Message = {
  role: "model",
  content:
    "Merhaba! Portal veritabanındaki projeler, bütçeler, faturalar, efor atamaları ve lisanslar hakkında sorularınızı yanıtlayabilirim.",
};

export function ChatbotPopup({ isOpen, onClose }: ChatbotPopupProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClear = () => {
    setMessages([GREETING]);
  };

  /** Bilgi tabanını elle tazeler. Normalde gerekmez; veri değişince kendiliğinden yenilenir. */
  const handleReindex = async () => {
    if (isReindexing) return;
    setIsReindexing(true);
    try {
      const res = await fetch("/api/chat/index", { method: "POST" });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: res.ok
            ? `Bilgi tabanı yeniden kuruldu: **${data.records}** kayıt, **${data.summaries}** özet (${data.buildMs} ms).`
            : `Bilgi tabanı yenilenemedi: ${data.error ?? "bilinmeyen hata"}`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "Bilgi tabanı yenilenemedi: sunucuya ulaşılamadı." },
      ]);
    } finally {
      setIsReindexing(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    // Yanıt akarken doldurulacak boş balon
    setMessages([...newMessages, { role: "model", content: "" }]);
    setIsLoading(true);

    /** Akan parçayı son mesaja ekler. */
    const appendToLast = (piece: string) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + piece };
        return next;
      });
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: true,
          messages: newMessages.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "API hatası");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Sunucu satır başına bir JSON nesnesi (NDJSON) gönderir.
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;

          const parsed = JSON.parse(line);
          if (parsed.meta) setMeta(parsed.meta);
          if (parsed.error) throw new Error(parsed.error);
          const piece = parsed.message?.content;
          if (piece) {
            received = true;
            appendToLast(piece);
          }
        }
      }

      if (!received) appendToLast("Model boş yanıt döndü.");
    } catch (error: any) {
      setMessages([
        ...newMessages,
        {
          role: "model",
          content: `Üzgünüm, yanıt alınamadı.\n\n\`${error?.message ?? "bilinmeyen hata"}\`\n\nSorunun kaynağını görmek için: \`/api/chat/health\``,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const warnings = meta?.index.warnings ?? [];
  const modelNote = meta?.modelFallback;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[600px] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-muted/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Portal Asistanı</h2>
              <p className="text-xs text-muted-foreground">
                {meta
                  ? `${meta.model} · ${meta.index.records} kayıt · ${meta.retrieval.chunks} parça (${meta.retrieval.mode})`
                  : "Lokal AI · Endüstri 4.0 Portal"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReindex}
              title="Bilgi tabanını yeniden kur"
              disabled={isReindexing}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-5 w-5", isReindexing && "animate-spin")} />
            </button>
            <button
              onClick={handleClear}
              title="Sohbeti Temizle"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Uyarılar: model bulunamadı, gömme modeli yok vb. */}
        {(warnings.length > 0 || modelNote) && (
          <div className="flex items-start gap-2 border-b bg-amber-500/10 px-6 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              {modelNote && <p>{modelNote}</p>}
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((msg, idx) => {
            const isStreamingPlaceholder =
              isLoading && idx === messages.length - 1 && msg.role === "model" && !msg.content;
            if (isStreamingPlaceholder) {
              return (
                <div key={idx} className="flex w-full justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Veritabanı taranıyor...
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] overflow-hidden rounded-2xl px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "prose prose-sm rounded-tl-sm bg-muted text-foreground dark:prose-invert"
                  )}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-xl border bg-background p-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Projeler, bütçeler, faturalar, lisanslar hakkında sorun..."
              className="flex-1 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
