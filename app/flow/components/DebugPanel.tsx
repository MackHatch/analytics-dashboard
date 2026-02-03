'use client'

import { FlowState } from '../lib/runtime/types'

interface DebugPanelProps {
  state: FlowState
  isOpen: boolean
  onToggle: () => void
}

export function DebugPanel({ state, isOpen, onToggle }: DebugPanelProps) {
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm hover:bg-zinc-700 transition-colors"
      >
        Show Debug
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] overflow-y-auto p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Debug Panel</h3>
        <button
          onClick={onToggle}
          className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Current Step:</span>
          <span className="ml-2 text-zinc-900 dark:text-zinc-50">{state.step}</span>
        </div>

        <div>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Wallet:</span>
          <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-50">
            {state.walletAddress || 'Not connected'}
          </span>
        </div>

        <div>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Chain ID:</span>
          <span className="ml-2 text-zinc-900 dark:text-zinc-50">{state.chainId || 'N/A'}</span>
        </div>

        {state.tokenIn && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Token In:</span>
            <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-50">
              {state.tokenIn.symbol} ({state.tokenIn.address.slice(0, 10)}...)
            </span>
          </div>
        )}

        {state.tokenOut && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Token Out:</span>
            <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-50">
              {state.tokenOut.symbol} ({state.tokenOut.address.slice(0, 10)}...)
            </span>
          </div>
        )}

        {state.amountIn && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Amount In:</span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-50">{state.amountIn}</span>
          </div>
        )}

        {state.quote && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Quote:</span>
            <div className="ml-2 mt-1 p-2 rounded bg-zinc-100 dark:bg-zinc-800">
              <div>Expected: {state.quote.expectedOut.toString()}</div>
              <div>Min: {state.quote.minOut.toString()}</div>
              <div>Expiry: {new Date(state.quote.expiry).toLocaleTimeString()}</div>
            </div>
          </div>
        )}

        {state.approvals && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Approvals:</span>
            <div className="ml-2 mt-1 p-2 rounded bg-zinc-100 dark:bg-zinc-800">
              <div>Token In: {state.approvals.tokenIn.approved ? '✓' : '✗'}</div>
              <div>Token Out: {state.approvals.tokenOut.approved ? '✓' : '✗'}</div>
            </div>
          </div>
        )}

        {state.swapTxHash && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Swap TX:</span>
            <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-50 text-xs">
              {state.swapTxHash}
            </span>
          </div>
        )}

        {state.streamTxHash && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Stream TX:</span>
            <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-50 text-xs">
              {state.streamTxHash}
            </span>
          </div>
        )}

        {state.streamId && (
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Stream ID:</span>
            <span className="ml-2 font-mono text-zinc-900 dark:text-zinc-50">{state.streamId}</span>
          </div>
        )}

        {state.error && (
          <div>
            <span className="font-semibold text-red-600 dark:text-red-400">Error:</span>
            <div className="ml-2 mt-1 p-2 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
              <div>{state.error.message}</div>
              <div className="text-xs mt-1">Step: {state.error.step}</div>
              <div className="text-xs">Recoverable: {state.error.recoverable ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-zinc-300 dark:border-zinc-700">
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(state, null, 2))
            }}
            className="w-full px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-xs"
          >
            Copy State JSON
          </button>
        </div>
      </div>
    </div>
  )
}
