import { formatDateTime } from "@/lib/utils";
import { APPLICATION_STATUS_CONFIG } from "@/constants/statuses";
import type { ApplicationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  toStatus: ApplicationStatus;
  fromStatus?: ApplicationStatus | null;
  reason?: string | null;
  createdAt: Date | string;
  changedBy?: string | null;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export default function Timeline({ events, className }: TimelineProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-4 top-0 h-full w-px bg-gray-200" />
      <ul className="space-y-6">
        {events.map((event, i) => {
          const config = APPLICATION_STATUS_CONFIG[event.toStatus];
          const isLast = i === events.length - 1;
          return (
            <li key={event.id} className="relative flex gap-4 pl-10">
              {/* Dot */}
              <div
                className={cn(
                  "absolute left-2.5 top-1 flex h-3 w-3 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white",
                  config.bgColor.replace("bg-", "bg-").replace("-100", "-400"),
                  isLast ? "ring-2 ring-offset-1" : "",
                )}
                style={{ backgroundColor: undefined }}
              >
                <div className={cn("h-2 w-2 rounded-full", config.bgColor.replace("-100", "-500"))} />
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", config.bgColor, config.color)}>
                    {config.label}
                  </span>
                  {event.fromStatus && (
                    <span className="text-xs text-gray-400">
                      from {APPLICATION_STATUS_CONFIG[event.fromStatus].label}
                    </span>
                  )}
                </div>
                {event.reason && (
                  <p className="mt-1 text-sm text-gray-600">{event.reason}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {formatDateTime(event.createdAt)}
                  {event.changedBy && ` · by ${event.changedBy}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
