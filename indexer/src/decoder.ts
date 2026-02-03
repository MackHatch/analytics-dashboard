// Event decoder using viem

import { Log, decodeEventLog } from 'viem'
import StreamingPaymentsABI from './StreamingPayments.json'
import { DecodedEvent } from './types'

export function decodeEvent(log: Log): DecodedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: StreamingPaymentsABI as any,
      data: log.data,
      topics: log.topics,
    })

    // Extract streamId from indexed topics if present
    let streamId: string | undefined
    if (decoded.args && 'streamId' in decoded.args) {
      streamId = decoded.args.streamId.toString()
    }

    return {
      eventName: decoded.eventName,
      args: decoded.args,
      streamId,
      blockNumber: Number(log.blockNumber!),
      timestamp: 0, // Will fetch from block if needed
    }
  } catch (error) {
    console.error('Failed to decode event:', error)
    return null
  }
}
