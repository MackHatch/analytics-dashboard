import { prisma } from '@/lib/db'

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTokenAmount(amount: string) {
  const num = BigInt(amount)
  if (num === 0n) return '0'
  const eth = Number(num) / 1e18
  return eth.toFixed(2)
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
  const type = searchParams.type || 'senders'
  const where: any = {}

  if (type === 'senders') {
    const result = await prisma.stream.groupBy({
      by: ['sender'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    })

    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Leaderboard - Top Senders
          </h1>
          <div className="flex gap-2">
            <a
              href="/dashboard/leaderboard?type=senders"
              className={`px-4 py-2 rounded-lg ${
                type === 'senders'
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              } transition-colors`}
            >
              Senders
            </a>
            <a
              href="/dashboard/leaderboard?type=recipients"
              className={`px-4 py-2 rounded-lg ${
                type === 'recipients'
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              } transition-colors`}
            >
              Recipients
            </a>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Rank</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Address</th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Total Sent</th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Streams</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r, index) => (
                <tr key={r.sender} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="p-4 text-sm text-zinc-900 dark:text-zinc-50">#{index + 1}</td>
                  <td className="p-4 text-sm font-mono text-zinc-900 dark:text-zinc-50">{r.sender}</td>
                  <td className="p-4 text-sm text-right font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatTokenAmount(r._sum.amount?.toString() || '0')}
                  </td>
                  <td className="p-4 text-sm text-right text-zinc-600 dark:text-zinc-400">
                    {r._count.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  } else {
    const result = await prisma.withdrawal.groupBy({
      by: ['recipient'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    })

    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Leaderboard - Top Recipients
          </h1>
          <div className="flex gap-2">
            <a
              href="/dashboard/leaderboard?type=senders"
              className={`px-4 py-2 rounded-lg ${
                type === 'senders'
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              } transition-colors`}
            >
              Senders
            </a>
            <a
              href="/dashboard/leaderboard?type=recipients"
              className={`px-4 py-2 rounded-lg ${
                type === 'recipients'
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              } transition-colors`}
            >
              Recipients
            </a>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Rank</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Address</th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Total Received</th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Withdrawals</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r, index) => (
                <tr key={r.recipient} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="p-4 text-sm text-zinc-900 dark:text-zinc-50">#{index + 1}</td>
                  <td className="p-4 text-sm font-mono text-zinc-900 dark:text-zinc-50">{r.recipient}</td>
                  <td className="p-4 text-sm text-right font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatTokenAmount(r._sum.amount?.toString() || '0')}
                  </td>
                  <td className="p-4 text-sm text-right text-zinc-600 dark:text-zinc-400">
                    {r._count.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
}
