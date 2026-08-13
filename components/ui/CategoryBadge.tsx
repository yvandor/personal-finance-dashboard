interface CategoryBadgeProps {
  /** Category display name. Always rendered -- the dot alone never carries the meaning. */
  name: string;
  /**
   * The category's `color` field: a `#rrggbb` string, already validated by
   * lib/schemas/category.ts at the system boundary, which is why it is safe to
   * hand straight to an inline style.
   */
  color: string;
  className?: string;
}

/**
 * A category's color dot plus its name. Presentational only -- no state, no
 * client boundary, so it renders inside Server Components too.
 *
 * Layout contract for callers: this sizes to its content and never sets a
 * width, a font-size or a color, so it inherits from wherever it is dropped --
 * a table cell, a card header, a list row. Long names truncate rather than
 * widening the container, so it will not blow out a narrow column.
 */
export function CategoryBadge({ name, color, className = "" }: CategoryBadgeProps) {
  return (
    <span
      className={["inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/*
        The ring keeps the dot visible when a user picks a color close to the
        surface behind it (a near-white category on a white card, or a very
        dark one in dark mode). Tied to --foreground rather than a fixed
        black/white so it flips with the palette and stays a contrasting
        outline in both.
      */}
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/20 ring-inset"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
