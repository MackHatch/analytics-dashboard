// Indexer Adapter Types
// Types for indexer API interactions

export interface WaitForIndexedInputs {
  txHash: string
  timeout?: number // Optional timeout in milliseconds
}

export interface WaitForIndexedResult {
  success: boolean
  streamId: string
  indexedAtBlock: number
  indexedAt: string // ISO timestamp
}

export interface WaitForIndexedError {
  success: false
  error: 'TIMEOUT' | 'NOT_FOUND' | 'NETWORK_ERROR'
  message: string
}
