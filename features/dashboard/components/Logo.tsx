import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  variant?: "default" | "sidebar";
}

export const Logo = ({ className, textClassName, variant = "default" }: LogoProps) => {
  const isSidebar = variant === "sidebar";
  return (
    <div className={cn("flex items-center", isSidebar ? "gap-2" : "gap-3", className)}>
      <LogoIcon className={isSidebar ? "size-6" : "size-8"} />
      <span className={cn("font-semibold tracking-tight text-[#47404a]", isSidebar ? "text-[17px] text-[#ecfc03]" : "text-xl", textClassName)}>
        Ruta
      </span>
    </div>
  );
};

export const LogoIcon = ({ className }: { className?: string; color?: string; suffix?: string }) => (
  <span className={cn("grid shrink-0 place-items-center rounded-md bg-[#ecfc03] font-semibold text-[#47404a]", className)} aria-hidden="true">
    R
  </span>
);
