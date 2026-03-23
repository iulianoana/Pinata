import { Button } from "@/components/ui/button";

export default function VocabularyEmptyState({ onAdd }) {
  return (
    <div className="text-center py-16 px-5 flex flex-col items-center gap-4">
      {/* Book icon in green circle */}
      <div className="w-[72px] h-[72px] rounded-full bg-accent-light flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-text mb-1.5">
          Your vocabulary is empty
        </h2>
        <p className="text-muted text-[15px] font-semibold leading-relaxed max-w-[280px] mx-auto">
          Start adding Spanish words to build your personal dictionary
        </p>
      </div>

      <Button onClick={onAdd} className="mt-2">+ Add words</Button>
    </div>
  );
}
