import { MetricsCard } from '@/components/MetricsCard'
import Link from 'next/link'
import { prisma } from '@/lib/db'

function formatTokenAmount(amount: string) {
  const num = BigInt(amount)
  if (num === 0n) return '0'
  const eth = Number(num) / 1e18
  return eth.toFixed(2)
}

export default async function DashboardPage() {
  // Fetch metrics directly from database
  const where: any = {}

  const totalStreams = await prisma.stream.count({ where })

  const now = BigInt(Math.floor(Date.now() / 1000))
  const activeStreams = await prisma.stream.count({
    where: {
      ...where,
      canceled: false,
      end: { gt: now },
    },
  })

  const volumeResult = await prisma.stream.aggregate({
    where,
    _sum: { amount: true },
  })
  const totalVolume = volumeResult._sum.amount || 0n

  const withdrawnResult = await prisma.stream.aggregate({
    where,
    _sum: { withdrawn: true },
  })
  const totalWithdrawn = withdrawnResult._sum.withdrawn || 0n

  const uniqueSenders = await prisma.stream.findMany({
    where,
    select: { sender: true },
    distinct: ['sender'],
  })
  const uniqueRecipients = await prisma.stream.findMany({
    where,
    select: { recipient: true },
    distinct: ['recipient'],
  })

  const oneDayAgo = BigInt(Math.floor(Date.now() / 1000) - 86400)
  const recentEvents = await prisma.event.count({
    where: {
      ...where,
      timestamp: { gte: oneDayAgo },
    },
  })

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
        Streaming Payments Dashboard
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricsCard title="Total Streams" value={totalStreams} />
        <MetricsCard title="Active Streams" value={activeStreams} />
        <MetricsCard title="Total Volume" value={formatTokenAmount(totalVolume.toString())} />
        <MetricsCard title="Total Withdrawn" value={formatTokenAmount(totalWithdrawn.toString())} />
        <MetricsCard title="Unique Senders" value={uniqueSenders.length} />
        <MetricsCard title="Unique Recipients" value={uniqueRecipients.length} />
        <MetricsCard title="Events (24h)" value={recentEvents} />
      </div>

      <div className="flex gap-4">
        <Link
          href="/dashboard/streams"
          className="px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          View All Streams
        </Link>
        <Link
          href="/dashboard/leaderboard"
          className="px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  )
}
