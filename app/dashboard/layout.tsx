import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Streaming Payments Analytics
            </Link>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/streams"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Streams
              </Link>
              <Link
                href="/dashboard/leaderboard"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  )
}
