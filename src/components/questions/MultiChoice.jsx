import { cn } from "@/lib/utils";

export default function MultiChoice({ q, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      {q.options.map((opt, i) => {
        const sel = value?.selected === i;
        return (
          <div key={i} onClick={() => onChange({ selected: i })}
            className={cn(
              "py-3.5 px-4 rounded-[14px] cursor-pointer transition-all border-[2.5px] font-semibold text-sm min-h-[52px] flex items-center gap-2.5 text-text",
              sel ? "border-accent bg-accent-light" : "border-border bg-white"
            )}>
            <span className={cn(
              "inline-flex items-center justify-center w-[22px] h-[22px] rounded-full shrink-0 transition-all border-[2.5px]",
              sel ? "border-accent bg-accent shadow-[inset_0_0_0_4px_#fff]" : "border-[#B0E0D8] bg-transparent"
            )} />
            {opt}
          </div>
        );
      })}
    </div>
  );
}
