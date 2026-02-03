// Wagmi-based Stream Adapter Implementation
// Real stream creation using wagmi

'use client'

import { simulateContract, writeContract, readContract } from '@wagmi/core'
import { decodeEventLog } from 'viem'
import { wagmiConfig } from '@/lib/wagmi'
import StreamingPaymentsABI from './StreamingPayments.json'
import {
  CreateStreamInputs,
  CreateStreamResult,
  SimulateStreamResult,
  StreamCreatedEvent,
} from './types'

// Contract addresses per chain (from streaming-app)
const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x0000000000000000000000000000000000000000', // Sepolia - TODO: Update after deployment
  84532: '0x0000000000000000000000000000000000000000', // Base Sepolia - TODO: Update after deployment
  31337: '0x0000000000000000000000000000000000000000', // Anvil - TODO: Update after deployment
}

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export class WagmiStreamAdapter {
  private chainId: number
  private contractAddress: `0x${string}`

  constructor(chainId: number, contractAddress?: string) {
    this.chainId = chainId
    this.contractAddress = (contractAddress as `0x${string}`) || this.getContractAddress(chainId)
  }

  /**
   * Simulate stream creation to check if it would succeed
   */
  async simulateCreateStream(
    inputs: CreateStreamInputs
  ): Promise<SimulateStreamResult> {
    try {
      const isNative = inputs.token === NATIVE_TOKEN

      if (isNative) {
        // ETH stream - use msg.value
        await simulateContract(wagmiConfig, {
          address: this.contractAddress,
          abi: StreamingPaymentsABI as any,
          functionName: 'createStream',
          args: [
            inputs.recipient as `0x${string}`,
            inputs.token as `0x${string}`,
            inputs.amount,
            BigInt(inputs.start),
            BigInt(inputs.end),
            BigInt(inputs.cliff),
            inputs.refundable,
          ],
          value: inputs.amount,
        })
      } else {
        // ERC20 stream
        await simulateContract(wagmiConfig, {
          address: this.contractAddress,
          abi: StreamingPaymentsABI as any,
          functionName: 'createStream',
          args: [
            inputs.recipient as `0x${string}`,
            inputs.token as `0x${string}`,
            inputs.amount,
            BigInt(inputs.start),
            BigInt(inputs.end),
            BigInt(inputs.cliff),
            inputs.refundable,
          ],
        })
      }

      return { success: true }
    } catch (error: any) {
      // Extract revert reason if available
      let revertReason = error.message || 'Simulation failed'
      
      // Try to parse revert reason from error
      if (error.data || error.reason) {
        revertReason = error.reason || error.data || revertReason
      }

      return {
        success: false,
        revertReason,
      }
    }
  }

  /**
   * Send stream creation transaction
   */
  async sendCreateStream(
    inputs: CreateStreamInputs
  ): Promise<CreateStreamResult> {
    const isNative = inputs.token === NATIVE_TOKEN

    let txHash: `0x${string}`

    if (isNative) {
      // ETH stream
      txHash = await writeContract(wagmiConfig, {
        address: this.contractAddress,
        abi: StreamingPaymentsABI as any,
        functionName: 'createStream',
        args: [
          inputs.recipient as `0x${string}`,
          inputs.token as `0x${string}`,
          inputs.amount,
          BigInt(inputs.start),
          BigInt(inputs.end),
          BigInt(inputs.cliff),
          inputs.refundable,
        ],
        value: inputs.amount,
      })
    } else {
      // ERC20 stream
      txHash = await writeContract(wagmiConfig, {
        address: this.contractAddress,
        abi: StreamingPaymentsABI as any,
        functionName: 'createStream',
        args: [
          inputs.recipient as `0x${string}`,
          inputs.token as `0x${string}`,
          inputs.amount,
          BigInt(inputs.start),
          BigInt(inputs.end),
          BigInt(inputs.cliff),
          inputs.refundable,
        ],
      })
    }

    return {
      txHash,
      // streamId will be parsed from receipt in parseStreamCreatedEvent
    }
  }

  /**
   * Parse StreamCreated event from transaction receipt
   */
  parseStreamCreatedEvent(receipt: any): StreamCreatedEvent | null {
    try {
      if (!receipt || !receipt.logs) {
        return null
      }

      // Find StreamCreated event log
      const eventAbi = (StreamingPaymentsABI as any[]).find(
        (item) => item.type === 'event' && item.name === 'StreamCreated'
      )

      if (!eventAbi) {
        return null
      }

      // Find matching log
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: [eventAbi],
            data: log.data,
            topics: log.topics,
          })

          if (decoded.eventName === 'StreamCreated') {
            return {
              streamId: decoded.args.streamId,
              sender: decoded.args.sender,
              recipient: decoded.args.recipient,
              token: decoded.args.token,
              amount: decoded.args.amount,
              start: decoded.args.start,
              end: decoded.args.end,
              cliff: decoded.args.cliff,
            }
          }
        } catch {
          // Not the right log, continue
          continue
        }
      }

      return null
    } catch (error) {
      console.error('Failed to parse StreamCreated event:', error)
      return null
    }
  }

  /**
   * Get contract address for chain
   */
  getContractAddress(chainId: number): `0x${string}` {
    const address = CONTRACT_ADDRESSES[chainId]
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`StreamingPayments contract not deployed on chain ${chainId}`)
    }
    return address
  }

  /**
   * Get NATIVE_TOKEN constant
   */
  getNativeTokenAddress(): string {
    return NATIVE_TOKEN
  }
}
