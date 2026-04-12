import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_CONFIG } from "@/constants/statuses";
import type { ApplicationStatus } from "@prisma/client";

interface StatusBadgeProps {
  status: ApplicationStatus;
  className?: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const config = APPLICATION_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgColor,
        config.color,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
