import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const mdComponents = {
  p: ({ children }) => (
    <p className="text-sm text-[#3A5A52] leading-[1.7] my-1 font-semibold">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-extrabold text-text">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-accent italic">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="pl-5 my-1 text-sm text-[#3A5A52] leading-[1.7] font-semibold">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="pl-5 my-1 text-sm text-[#3A5A52] leading-[1.7] font-semibold">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="mb-0.5">{children}</li>
  ),
};

export default function VocabularyCard({ word, onEdit, onRerunAI, onDelete }) {
  const [englishOpen, setEnglishOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef(null);

  // Measure content height for animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [word.explanation_en, englishOpen]);

  return (
    <div className="fade-in bg-input-bg rounded-xl py-4 px-[18px] border border-border">
      {/* Header: word + AI badge + menu */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xl font-extrabold text-text m-0 leading-[1.3]">
          {word.word}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {word.ai_generated && (
            <span className="bg-accent text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md tracking-[0.03em]">AI</span>
          )}
          {/* Three-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="bg-transparent border-none cursor-pointer px-1 py-0.5 text-muted text-lg font-extrabold leading-none flex">⋮</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px] rounded-[10px] border-border shadow-[0_4px_16px_rgba(0,60,50,0.12)]">
              <DropdownMenuItem onClick={onEdit} className="px-3.5 py-2.5 text-sm font-bold font-nunito text-text cursor-pointer">Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onRerunAI} className="px-3.5 py-2.5 text-sm font-bold font-nunito text-text cursor-pointer">Re-run AI</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="px-3.5 py-2.5 text-sm font-bold font-nunito text-error cursor-pointer">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Spanish explanation */}
      {word.explanation_es && (
        <div className="mb-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {word.explanation_es}
          </ReactMarkdown>
        </div>
      )}

      {/* English collapsible section */}
      {word.explanation_en && (
        <>
          <div className="border-t border-border mt-1 pt-2.5">
            <button
              onClick={() => setEnglishOpen(!englishOpen)}
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer font-nunito text-[13px] font-bold text-muted p-0 w-full"
            >
              <span className="text-sm">🇬🇧</span>
              <span>{englishOpen ? "English" : "Show English"}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{
                  transition: "transform 0.2s ease",
                  transform: englishOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Animated content */}
            <div style={{
              maxHeight: englishOpen ? contentHeight : 0,
              overflow: "hidden",
              transition: "max-height 0.3s ease",
            }}>
              <div ref={contentRef} className="pt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {word.explanation_en}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
