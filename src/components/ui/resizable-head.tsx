import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "./table";

interface ResizableHeadProps {
  label: React.ReactNode;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  sortActive?: boolean;
  sortDir?: "asc" | "desc";
  onSort?: () => void;
  align?: "left" | "right" | "center";
  className?: string;
}

// Хүснэгтийн баганын толгой — эрэмбэлэх (SortableHead-тэй ижил харагдац)
// болон баганы өргөнийг гараар чирж өөрчлөх (баруун ирмэг дэх бариул)
// хоёуланг нь нэг дор хийдэг, бүх хуудсанд дахин ашиглах компонент.
export const ResizableHead = React.forwardRef<HTMLTableCellElement, ResizableHeadProps>(
  ({ label, width, onResizeStart, sortActive, sortDir, onSort, align = "left", className }, ref) => (
    <TableHead
      ref={ref}
      onClick={onSort}
      style={width ? { width, minWidth: width, maxWidth: width } : undefined}
      className={cn(
        "relative select-none whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold px-1.5",
        onSort && "cursor-pointer hover:text-foreground transition-colors",
        sortActive ? "text-foreground" : "text-muted-foreground/80",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-0.5", align === "right" && "flex-row-reverse")}>
        {label}
        {onSort && (
          <ChevronDown
            className={cn(
              "w-3 h-3 shrink-0 transition-transform",
              sortActive ? "opacity-100" : "opacity-0",
              sortActive && sortDir === "desc" && "rotate-180"
            )}
          />
        )}
      </span>
      {onResizeStart && (
        <span
          onMouseDown={onResizeStart}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-1.5 -mr-0.5 cursor-col-resize z-10 hover:bg-primary/40"
        />
      )}
    </TableHead>
  )
);
ResizableHead.displayName = "ResizableHead";
