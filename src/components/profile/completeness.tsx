import { Check, X } from "lucide-react";
import { completeness, type NormalizedProfile } from "@/lib/profile/normalized";

export function CompletenessBadges({ profile }: { profile: Partial<NormalizedProfile> | null | undefined }) {
  const c = completeness(profile);
  const items: [string, boolean][] = [["Experience", c.experience], ["Education", c.education], ["Skills", c.skills]];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Data completeness">
      {items.map(([label, ok]) => (
        <span key={label} className={`inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 ${ok ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
          {ok ? <Check className="size-3" /> : <X className="size-3" />} {label}
        </span>
      ))}
    </div>
  );
}
