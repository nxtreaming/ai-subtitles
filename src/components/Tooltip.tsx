import { ReactNode } from "react";

interface TooltipProps {
    label: string;
    children: ReactNode;
    position?: "top" | "bottom";
}

export default function Tooltip({ label, children, position = "bottom" }: TooltipProps) {
    return (
        <div className="relative group/tooltip inline-flex">
            {children}
            <span
                className={`
                    pointer-events-none absolute left-1/2 -translate-x-1/2 z-[60]
                    px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap
                    bg-foreground text-background shadow-lg
                    opacity-0 group-hover/tooltip:opacity-100
                    transition-all duration-200 ease-out
                    scale-95 group-hover/tooltip:scale-100
                    ${position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"}
                `}
            >
                {label}
            </span>
        </div>
    );
}
