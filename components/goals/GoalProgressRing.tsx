interface GoalProgressRingProps {
  percentComplete: number;
  isAchieved: boolean;
  size?: number;
}

const STROKE_WIDTH = 8;

// Same "never color-only" discipline as BudgetProgressBar: the percentage
// is also rendered as real text inside the ring, and the full status is
// exposed via aria-valuetext, not just implied by fill color/angle.
export function GoalProgressRing({ percentComplete, isAchieved, size = 96 }: GoalProgressRingProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  // The ring visually caps at 100% -- a fill that wraps past a full circle
  // isn't meaningful -- but the number displayed inside it does not, same
  // convention as BudgetProgressBar's displayPercent vs. raw percentUsed.
  const displayPercent = Math.min(percentComplete, 100);
  const offset = circumference * (1 - displayPercent / 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={percentComplete}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={isAchieved ? "Goal reached" : `${percentComplete}% complete`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-surface-hover"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none ${isAchieved ? "text-income" : "text-accent"}`}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums">{isAchieved ? "🎉" : `${displayPercent}%`}</span>
    </div>
  );
}
