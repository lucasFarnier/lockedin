import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeading({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="workspace-heading">
      <div className="workspace-heading-icon"><Icon className="size-6" /></div>
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}