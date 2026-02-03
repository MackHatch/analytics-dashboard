import Link from 'next/link'

interface StreamCardProps {
  id: string
  sender: string
  recipient: string
  token: string
  amount: string
  withdrawn: string
  canceled: boolean
  withdrawalCount: number
  start: string
  end: string
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTokenAmount(amount: string) {
  const num = BigInt(amount)
  if (num === 0n) return '0'
  // Simple formatting - divide by 1e18 for ETH/tokens
  const eth = Number(num) / 1e18
  return eth.toFixed(4)
}

export function StreamCard({
  id,
  sender,
  recipient,
  token,
  amount,
  withdrawn,
  canceled,
  withdrawalCount,
  start,
  end,
}: StreamCardProps) {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const startTime = BigInt(start)
  const endTime = BigInt(end)
  const isActive = !canceled && now >= startTime && now < endTime
  const isCompleted = !canceled && now >= endTime

  let status = 'Pending'
  if (canceled) status = 'Canceled'
  else if (isCompleted) status = 'Completed'
  else if (isActive) status = 'Active'

  return (
    <Link href={`/dashboard/streams/${id}`}>
      <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500 transition-colors">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Stream #{id.slice(0, 8)}...
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {status}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            status === 'Completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            status === 'Canceled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
          }`}>
            {status}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Sender:</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-50">
              {formatAddress(sender)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Recipient:</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-50">
              {formatAddress(recipient)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Amount:</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {formatTokenAmount(amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Withdrawn:</span>
            <span className="text-zinc-900 dark:text-zinc-50">
              {formatTokenAmount(withdrawn)} ({withdrawalCount} withdrawals)
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
