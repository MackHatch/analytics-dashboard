// DEX Adapter
// Single responsibility: quote generation and swap execution
// Factory pattern to support multiple DEXes

import { QuoteInputs, QuoteOutputs, SwapInputs, SwapResult } from './types'
import { UniswapV2Adapter } from './UniswapV2Adapter'

export class DEXAdapter {
  private adapter: UniswapV2Adapter

  constructor(chainId: number) {
    // Default to Uniswap V2, can be extended to support other DEXes
    this.adapter = new UniswapV2Adapter(chainId)
  }

  /**
   * Generate a quote for swapping tokens
   */
  async getQuote(inputs: QuoteInputs): Promise<QuoteOutputs> {
    return this.adapter.getQuote(inputs)
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(inputs: SwapInputs): Promise<SwapResult> {
    return this.adapter.executeSwap(inputs)
  }

  /**
   * Simulate swap to check if it would succeed
   */
  async simulateSwap(inputs: SwapInputs): Promise<{
    success: boolean
    revertReason?: string
  }> {
    return this.adapter.simulateSwap(inputs)
  }

  /**
   * Check if quote is still valid
   */
  isQuoteValid(quote: QuoteOutputs): boolean {
    return this.adapter.isQuoteValid(quote)
  }

  /**
   * Get DEX router address
   */
  getRouterAddress(): string {
    return this.adapter.getRouterAddress()
  }
}
