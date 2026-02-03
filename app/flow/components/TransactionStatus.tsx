'use client'

interface TransactionStatusProps {
  status: 'idle' | 'signing' | 'pending' | 'confirmed' | 'failed'
  txHash?: string
  error?: string
  explorerUrl?: string
  onRetry?: () => void
}

export function TransactionStatus({
  status,
  txHash,
  error,
  explorerUrl,
  onRetry,
}: TransactionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'signing':
      case 'pending':
        return 'text-blue-600 dark:text-blue-400'
      case 'confirmed':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-zinc-600 dark:text-zinc-400'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'signing':
        return '✍️'
      case 'pending':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        )
      case 'confirmed':
        return '✓'
      case 'failed':
        return '✗'
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'signing':
        return 'Signing transaction...'
      case 'pending':
        return 'Transaction pending...'
      case 'confirmed':
        return 'Transaction confirmed'
      case 'failed':
        return 'Transaction failed'
      default:
        return ''
    }
  }

  if (status === 'idle') return null

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()} ${
      status === 'confirmed' ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700' :
      status === 'failed' ? 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700' :
      'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {txHash && (
        <div className="text-sm mb-2">
          <span className="font-mono text-xs break-all">{txHash}</span>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              View on Explorer
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-800 dark:text-red-200 mb-2">
          {error}
        </div>
      )}

      {status === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-sm"
        >
          Retry
        </button>
      )}
    </div>
  )
}
