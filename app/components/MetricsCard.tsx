interface MetricsCardProps {
  title: string
  value: string | number
  subtitle?: string
}

export function MetricsCard({ title, value, subtitle }: MetricsCardProps) {
  return (
    <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
        {title}
      </h3>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  )
}
