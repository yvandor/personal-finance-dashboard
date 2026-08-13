import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

// `secondary` outlines with --border-strong rather than --border: a resting
// control the user has to be able to find needs 3:1 non-text contrast
// (WCAG 1.4.11), which the hairline --border deliberately does not meet.
// `danger` fills with --danger-foreground rather than a literal white --
// the dark palette's red is light enough that white-on-red lands at 2.8:1.
const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-hover",
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
  ghost: "text-muted hover:bg-surface-hover hover:text-foreground",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
});
