import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTokenAmount(amount: string) {
  const num = BigInt(amount)
  if (num === 0n) return '0'
  const eth = Number(num) / 1e18
  return eth.toFixed(6)
}

function formatTimestamp(timestamp: string) {
  return new Date(Number(BigInt(timestamp)) * 1000).toLocaleString()
}

export default async function StreamDetailPage({
  params,
}: {
  params: { streamId: string }
}) {
  const stream = await prisma.stream.findUnique({
    where: { id: params.streamId },
    include: {
      events: {
        orderBy: { blockNumber: 'desc' },
        take: 50,
      },
      withdrawals: {
        orderBy: { timestamp: 'desc' },
      },
    },
  })

  if (!stream) {
    notFound()
  }

  const now = BigInt(Math.floor(Date.now() / 1000))
  const isActive = !stream.canceled && now >= stream.start && now < stream.end
  const isCompleted = !stream.canceled && now >= stream.end

  let status = 'Pending'
  if (stream.canceled) status = 'Canceled'
  else if (isCompleted) status = 'Completed'
  else if (isActive) status = 'Active'

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <a
          href="/dashboard/streams"
          className="text-blue-500 hover:text-blue-600 mb-4 inline-block"
        >
          ← Back to Streams
        </a>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Stream #{stream.id.slice(0, 16)}
        </h1>
        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
          status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          status === 'Completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
          status === 'Canceled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        }`}>
          {status}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">Stream Details</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Sender:</span>
              <p className="font-mono text-zinc-900 dark:text-zinc-50">{stream.sender}</p>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Recipient:</span>
              <p className="font-mono text-zinc-900 dark:text-zinc-50">{stream.recipient}</p>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Token:</span>
              <p className="font-mono text-zinc-900 dark:text-zinc-50">{stream.token}</p>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Amount:</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                {formatTokenAmount(stream.amount.toString())}
              </p>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Withdrawn:</span>
              <p className="text-zinc-900 dark:text-zinc-50">
                {formatTokenAmount(stream.withdrawn.toString())}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">Timeline</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Start:</span>
              <p className="text-zinc-900 dark:text-zinc-50">
                {formatTimestamp(stream.start.toString())}
              </p>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">End:</span>
              <p className="text-zinc-900 dark:text-zinc-50">
                {formatTimestamp(stream.end.toString())}
              </p>
            </div>
            {stream.cliff > 0n && (
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Cliff:</span>
                <p className="text-zinc-900 dark:text-zinc-50">
                  {formatTimestamp(stream.cliff.toString())}
                </p>
              </div>
            )}
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Refundable:</span>
              <p className="text-zinc-900 dark:text-zinc-50">
                {stream.refundable ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">Withdrawals</h2>
        {stream.withdrawals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left p-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Amount</th>
                  <th className="text-left p-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Recipient</th>
                  <th className="text-left p-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {stream.withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="p-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {formatTokenAmount(w.amount.toString())}
                    </td>
                    <td className="p-3 text-sm font-mono text-zinc-900 dark:text-zinc-50">
                      {formatAddress(w.recipient)}
                    </td>
                    <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatTimestamp(w.timestamp.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">No withdrawals yet</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">Recent Events</h2>
        <div className="space-y-2">
          {stream.events.slice(0, 10).map((event) => (
            <div
              key={event.id}
              className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {event.eventType}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    Block {event.blockNumber.toString()}
                  </p>
                </div>
                <a
                  href={`https://etherscan.io/tx/${event.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  View TX
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
