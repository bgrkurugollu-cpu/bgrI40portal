"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "model";
  content: string;
}

interface ChatbotPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatbotPopup({ isOpen, onClose }: ChatbotPopupProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", content: "Merhaba! Uygulama ile ilgili sorularınızı cevaplamak için buradayım. Size nasıl yardımcı olabilirim?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClear = () => {
    setMessages([
      { role: "model", content: "Merhaba! Uygulama ile ilgili sorularınızı cevaplamak için buradayım. Size nasıl yardımcı olabilirim?" }
    ]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            // Ollama API expects "assistant" for the model's role
            role: m.role === "model" ? "assistant" : "user",
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error("API Hatası");
      }

      const data = await response.json();
      const botReply = data.message?.content || "Cevap alınamadı.";
      
      setMessages([...newMessages, { role: "model", content: botReply }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: "model", content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin." }]);
    } finally {
      setIsLoading(false);
    }
  };

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
              <h2 className="text-lg font-semibold">Gemma Asistan</h2>
              <p className="text-xs text-muted-foreground">Endüstri 4.0 Portal AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm overflow-hidden",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm prose prose-sm dark:prose-invert"
                )}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground rounded-tl-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Düşünüyor...
              </div>
            </div>
          )}
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
              placeholder="Gemma'ya bir şey sorun..."
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
