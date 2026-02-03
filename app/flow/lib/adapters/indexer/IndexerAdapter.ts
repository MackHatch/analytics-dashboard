// Indexer Adapter
// Single responsibility: call indexer API wait endpoint

import {
  WaitForIndexedInputs,
  WaitForIndexedResult,
  WaitForIndexedError,
} from './types'

export class IndexerAdapter {
  private apiBaseUrl: string

  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl
  }

  /**
   * Wait for transaction to be indexed
   * Polls the indexer API until StreamCreated event is found
   * @param inputs Wait parameters
   * @returns Indexed result or error
   */
  async waitForIndexed(
    inputs: WaitForIndexedInputs
  ): Promise<WaitForIndexedResult | WaitForIndexedError> {
    const { txHash, timeout = 60000 } = inputs

    try {
      const url = `${this.apiBaseUrl}/wait?txHash=${txHash}&timeout=${timeout}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || 'NETWORK_ERROR',
          message: errorData.message || `HTTP ${response.status}`,
        }
      }

      const data = await response.json()

      if (data.success) {
        return {
          success: true,
          streamId: data.streamId,
          indexedAtBlock: data.indexedAtBlock,
          indexedAt: data.indexedAt,
        }
      } else {
        return {
          success: false,
          error: data.error || 'UNKNOWN',
          message: data.message || 'Unknown error',
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      }
    }
  }

  /**
   * Check if transaction is already indexed (single check, no polling)
   * @param txHash Transaction hash
   * @returns Indexed result or null if not found
   */
  async checkIndexed(txHash: string): Promise<WaitForIndexedResult | null> {
    try {
      // Use a short timeout for single check
      const url = `${this.apiBaseUrl}/wait?txHash=${txHash}&timeout=1000&pollInterval=1000`
      const response = await fetch(url)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          return {
            success: true,
            streamId: data.streamId,
            indexedAtBlock: data.indexedAtBlock,
            indexedAt: data.indexedAt,
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error checking indexed status:', error)
      return null
    }
  }

  /**
   * Get API endpoint URL
   * @param endpoint Endpoint path
   * @returns Full URL
   */
  private getApiUrl(endpoint: string): string {
    return `${this.apiBaseUrl}${endpoint}`
  }
}
