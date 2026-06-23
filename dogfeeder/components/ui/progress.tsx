import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0 - 100
  indeterminate?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(value)}
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-full bg-primary/15",
          className
        )}
        {...props}
      >
        {indeterminate ? (
          <div className="absolute inset-y-0 left-0 w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        ) : (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
