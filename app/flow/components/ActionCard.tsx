'use client'

import { Step, FlowState } from '../lib/runtime/types'

interface ActionCardProps {
  step: Step
  state: FlowState
  onAction: (action: string, data?: any) => void
}

interface RecoveryInfo {
  title: string
  description?: string
  details?: string[]
  actions?: Array<{ label: string; href: string; target?: string }>
  bgColor: string
  textColor: string
  retryLabel?: string
}

function getRecoveryInfo(state: FlowState, errorStep?: Step): RecoveryInfo | null {
  // Swap succeeded but stream creation failed
  if (state.swapTxHash && !state.streamTxHash && state.amountOutReceived) {
    return {
      title: '✓ Swap Completed Successfully',
      description: 'Your swap transaction was successful. You can retry creating the stream without swapping again.',
      details: [
        `Swap TX: ${state.swapTxHash.slice(0, 20)}...`,
        `Amount received: ${state.amountOutReceived ? formatAmount(state.amountOutReceived, state.tokenOut?.decimals || 18) : 'N/A'}`,
      ],
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      retryLabel: 'Retry Create Stream',
    }
  }

  // Stream created but indexing failed
  if (state.streamTxHash && errorStep === Step.WAIT_INDEXED) {
    return {
      title: '✓ Stream Created Successfully',
      description: 'Your stream was created on-chain. The indexer is still processing it.',
      details: [
        `Stream TX: ${state.streamTxHash}`,
        state.streamId ? `Stream ID (from event): ${state.streamId}` : 'Stream ID pending...',
      ],
      actions: [
        { label: 'Search Dashboard', href: '/dashboard/streams' },
        ...(state.streamId ? [{ label: 'View Stream', href: `/dashboard/streams/${state.streamId}` }] : []),
      ],
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-800 dark:text-blue-200',
      retryLabel: 'Retry Indexer Wait',
    }
  }

  // Quote expired
  if (state.quote && errorStep === Step.SWAP) {
    return {
      title: 'Quote Expired',
      description: 'The DEX quote has expired. Please refresh the quote before swapping.',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      retryLabel: 'Refresh Quote',
    }
  }

  // Approval failed
  if (errorStep === Step.APPROVE_IN || errorStep === Step.APPROVE_OUT) {
    return {
      title: 'Approval Failed',
      description: 'The token approval transaction failed. You can retry the approval.',
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      textColor: 'text-orange-800 dark:text-orange-200',
      retryLabel: 'Retry Approval',
    }
  }

  return null
}

function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  if (fraction === 0n) {
    return whole.toString()
  }
  const fractionStr = fraction.toString().padStart(decimals, '0')
  const trimmed = fractionStr.replace(/0+$/, '')
  return `${whole}.${trimmed}`
}

export function ActionCard({ step, state, onAction }: ActionCardProps) {
  const renderAction = () => {
    switch (step) {
      case Step.CONNECT:
        return (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Connect your wallet to begin the swap-to-stream flow.
            </p>
            <button
              onClick={() => onAction('connect')}
              className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              Connect Wallet
            </button>
          </div>
        )

      case Step.INPUTS:
        return (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Select tokens and enter the amount you want to swap.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Token In
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={state.tokenIn?.address || ''}
                  onChange={(e) => onAction('setTokenIn', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Token Out
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={state.tokenOut?.address || ''}
                  onChange={(e) => onAction('setTokenOut', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Amount In
                </label>
                <input
                  type="text"
                  placeholder="0.0"
                  value={state.amountIn}
                  onChange={(e) => onAction('setAmountIn', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                />
              </div>
              <button
                onClick={() => onAction('continue')}
                disabled={!state.tokenIn || !state.tokenOut || !state.amountIn}
                className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )

      case Step.QUOTE:
        return (
          <div className="space-y-4">
            {state.quote ? (
              <>
                <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Expected Out:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatAmount(state.quote.expectedOut.toString())} {state.tokenOut?.symbol || ''}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Min Out:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatAmount(state.quote.minOut.toString())} {state.tokenOut?.symbol || ''}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Slippage:</span>
                    <span className="text-zinc-900 dark:text-zinc-50">{state.slippage}%</span>
                  </div>
                  {state.quote.highImpact && (
                    <div className="mt-2 p-2 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs">
                      ⚠️ High price impact: {state.quote.impactPercentage?.toFixed(2)}%
                    </div>
                  )}
                  {state.quote.lowLiquidity && (
                    <div className="mt-2 p-2 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs">
                      ⚠️ Low liquidity pool
                    </div>
                  )}
                </div>
                {!isQuoteValid(state.quote) && (
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm">
                    Quote expired. Please refresh.
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => onAction('refreshQuote')}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                  >
                    Refresh Quote
                  </button>
                  <button
                    onClick={() => onAction('continue')}
                    disabled={!isQuoteValid(state.quote)}
                    className="flex-1 px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Ready to fetch quote from DEX. This will query the Uniswap V2 pool for current rates.
                </p>
                <button
                  onClick={() => onAction('getQuote')}
                  disabled={!state.tokenIn || !state.tokenOut || !state.amountIn}
                  className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Quote
                </button>
              </>
            )}
          </div>
        )

      case Step.APPROVE_IN:
        return (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Approve {state.tokenIn?.symbol || 'token'} for DEX swap.
            </p>
            <button
              onClick={() => onAction('approve')}
              className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              Approve {state.tokenIn?.symbol || 'Token'}
            </button>
            {state.approvalInTxHash && (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
                Approval confirmed: {state.approvalInTxHash.slice(0, 10)}...
              </div>
            )}
          </div>
        )

      case Step.SWAP:
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Swapping:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {state.amountIn} {state.tokenIn?.symbol}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Expected:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {state.quote ? formatAmount(state.quote.expectedOut.toString()) : '...'} {state.tokenOut?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Minimum:</span>
                <span className="text-zinc-900 dark:text-zinc-50">
                  {state.quote ? formatAmount(state.quote.minOut.toString()) : '...'} {state.tokenOut?.symbol}
                </span>
              </div>
            </div>
            {!state.approvals?.tokenIn.approved && (
              <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm">
                ⚠️ Token approval required before swap
              </div>
            )}
            {state.quote && !isQuoteValid(state.quote) && (
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm">
                ⚠️ Quote expired. Please refresh quote before swapping.
              </div>
            )}
            <button
              onClick={() => onAction('swap')}
              disabled={!state.quote || !state.approvals?.tokenIn.approved || !isQuoteValid(state.quote)}
              className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Execute Swap
            </button>
            {state.swapTxHash && (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
                <div>Swap transaction: {state.swapTxHash.slice(0, 10)}...</div>
                {state.amountOutReceived && (
                  <div className="mt-1 font-semibold">
                    Received: {formatAmount(state.amountOutReceived.toString())} {state.tokenOut?.symbol}
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case Step.APPROVE_OUT:
        return (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Approve {state.tokenOut?.symbol || 'token'} for stream contract.
            </p>
            <button
              onClick={() => onAction('approve')}
              className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              Approve {state.tokenOut?.symbol || 'Token'}
            </button>
            {state.approvalOutTxHash && (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
                Approval confirmed: {state.approvalOutTxHash.slice(0, 10)}...
              </div>
            )}
          </div>
        )

      case Step.CREATE_STREAM:
        return <CreateStreamCard state={state} onAction={onAction} />

      case Step.WAIT_INDEXED:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <p className="text-zinc-600 dark:text-zinc-400">
                Waiting for indexer to process stream...
              </p>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              This may take a few moments. The indexer is scanning the blockchain for your stream creation event.
            </p>
            {state.streamTxHash && (
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm">
                <div className="font-mono text-xs break-all">
                  Transaction: {state.streamTxHash}
                </div>
                {state.streamId && (
                  <div className="mt-2 font-semibold">
                    Stream ID (from event): {state.streamId}
                  </div>
                )}
              </div>
            )}
            {state.indexedStatus.indexed && state.streamId && (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
                <p className="font-semibold">✓ Stream indexed!</p>
                <p className="mt-1">Stream ID: {state.streamId}</p>
                <p className="text-xs mt-1">
                  Block: {state.indexedStatus.indexedAtBlock}
                </p>
              </div>
            )}
            <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm">
              <p className="text-xs">
                💡 This is the unique feature: bridging on-chain transaction → indexer → dashboard
              </p>
            </div>
          </div>
        )

      case Step.DONE:
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              <p className="font-semibold mb-2">✓ Flow Complete!</p>
              <p className="text-sm mb-3">
                Your stream has been created and indexed successfully.
              </p>
              {state.streamId && (
                <div className="space-y-2">
                  <div className="text-xs">
                    <span className="font-semibold">Stream ID:</span> {state.streamId}
                  </div>
                  {state.indexedStatus.indexedAtBlock && (
                    <div className="text-xs">
                      <span className="font-semibold">Indexed at block:</span> {state.indexedStatus.indexedAtBlock}
                    </div>
                  )}
                  <a
                    href={`/dashboard/streams/${state.streamId}`}
                    className="mt-3 inline-block px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm"
                  >
                    View Stream in Dashboard
                  </a>
                </div>
              )}
            </div>
            <button
              onClick={() => onAction('reset')}
              className="w-full px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Start New Flow
            </button>
          </div>
        )

      case Step.ERROR:
        const errorStep = state.error?.step
        const recoveryInfo = getRecoveryInfo(state, errorStep)
        
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{state.error?.message || 'An error occurred'}</p>
            </div>

            {/* Recovery context information */}
            {recoveryInfo && (
              <div className={`p-3 rounded-lg ${recoveryInfo.bgColor} ${recoveryInfo.textColor} text-sm`}>
                <p className="font-semibold mb-2">{recoveryInfo.title}</p>
                {recoveryInfo.description && (
                  <p className="text-xs mb-2">{recoveryInfo.description}</p>
                )}
                {recoveryInfo.details && (
                  <div className="space-y-1 text-xs">
                    {recoveryInfo.details.map((detail, i) => (
                      <div key={i}>{detail}</div>
                    ))}
                  </div>
                )}
                {recoveryInfo.actions && (
                  <div className="flex gap-2 mt-3">
                    {recoveryInfo.actions.map((action, i) => (
                      <a
                        key={i}
                        href={action.href}
                        target={action.target || '_blank'}
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors text-xs"
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recovery actions */}
            {state.error?.recoverable && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => onAction('retry')}
                    className="flex-1 px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
                  >
                    {recoveryInfo?.retryLabel || 'Retry'}
                  </button>
                  <button
                    onClick={() => onAction('recover')}
                    className="flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                  >
                    Smart Recover
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 text-center">
                  Retry: Try the same step again | Smart Recover: Resume from safest step
                </p>
              </div>
            )}
          </div>
        )

      default:
        return <p className="text-zinc-600 dark:text-zinc-400">Unknown step: {step}</p>
    }
  }

  return (
    <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
        {getStepTitle(step)}
      </h2>
      {renderAction()}
    </div>
  )
}

function getStepTitle(step: Step): string {
  const titles: Record<Step, string> = {
    [Step.CONNECT]: 'Connect Wallet',
    [Step.INPUTS]: 'Select Tokens',
    [Step.QUOTE]: 'Get Quote',
    [Step.APPROVE_IN]: 'Approve Token In',
    [Step.SWAP]: 'Execute Swap',
    [Step.APPROVE_OUT]: 'Approve Token Out',
    [Step.CREATE_STREAM]: 'Create Stream',
    [Step.WAIT_INDEXED]: 'Waiting for Indexer',
    [Step.DONE]: 'Complete',
    [Step.ERROR]: 'Error',
  }
  return titles[step] || step
}

function formatAmount(amount: string): string {
  const num = BigInt(amount)
  if (num === 0n) return '0'
  const eth = Number(num) / 1e18
  return eth.toFixed(4)
}

function isQuoteValid(quote: any): boolean {
  if (!quote || !quote.expiry) return false
  return Date.now() < quote.expiry
}

// Separate component for CREATE_STREAM to handle local state
function CreateStreamCard({ state, onAction }: { state: FlowState; onAction: (action: string, data?: any) => void }) {
  const [recipient, setRecipient] = useState(state.walletAddress || '')

  return (
    <div className="space-y-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        Create streaming payment with swapped tokens.
      </p>
      <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 space-y-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value)
              onAction('setRecipient', e.target.value)
            }}
            className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-mono text-sm"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
            Address that will receive the stream
          </p>
        </div>
        <div className="flex justify-between pt-2 border-t border-zinc-300 dark:border-zinc-700">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Stream Amount:</span>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {state.amountOutReceived ? formatAmount(state.amountOutReceived.toString()) : '0'} {state.tokenOut?.symbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Duration:</span>
          <span className="text-sm text-zinc-900 dark:text-zinc-50">30 days</span>
        </div>
      </div>
      <button
        onClick={() => onAction('createStream', { recipient })}
        disabled={!state.amountOutReceived || !recipient || !recipient.startsWith('0x')}
        className="w-full px-6 py-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Create Stream
      </button>
      {state.streamTxHash && (
        <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
          <div>Stream transaction: {state.streamTxHash.slice(0, 10)}...</div>
          {state.streamId && (
            <div className="mt-1 font-semibold">Stream ID: {state.streamId}</div>
          )}
        </div>
      )}
    </div>
  )
}
