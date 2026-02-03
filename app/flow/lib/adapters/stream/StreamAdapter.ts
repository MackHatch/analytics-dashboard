// Stream Adapter
// Single responsibility: simulate, create, and parse stream transactions
// Factory pattern - uses WagmiStreamAdapter for real implementation

import {
  CreateStreamInputs,
  CreateStreamResult,
  SimulateStreamResult,
  StreamCreatedEvent,
} from './types'
import { WagmiStreamAdapter } from './WagmiStreamAdapter'

export class StreamAdapter {
  private adapter: WagmiStreamAdapter

  constructor(chainId: number, contractAddress?: string) {
    this.adapter = new WagmiStreamAdapter(chainId, contractAddress)
  }

  /**
   * Simulate stream creation to check if it would succeed
   */
  async simulateCreateStream(
    inputs: CreateStreamInputs
  ): Promise<SimulateStreamResult> {
    return this.adapter.simulateCreateStream(inputs)
  }

  /**
   * Send stream creation transaction
   */
  async sendCreateStream(
    inputs: CreateStreamInputs
  ): Promise<CreateStreamResult> {
    return this.adapter.sendCreateStream(inputs)
  }

  /**
   * Parse StreamCreated event from transaction receipt
   */
  parseStreamCreatedEvent(receipt: any): StreamCreatedEvent | null {
    return this.adapter.parseStreamCreatedEvent(receipt)
  }

  /**
   * Get stream contract address for a given chain
   */
  getContractAddress(chainId: number): string {
    return this.adapter.getContractAddress(chainId)
  }

  /**
   * Get NATIVE_TOKEN constant address
   */
  getNativeTokenAddress(): string {
    return this.adapter.getNativeTokenAddress()
  }
}
