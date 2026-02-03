// Stream Adapter Types
// Types for stream creation and parsing

export interface CreateStreamInputs {
  recipient: string
  token: string // Token address (or NATIVE_TOKEN constant)
  amount: bigint
  start: number // Unix timestamp
  end: number // Unix timestamp
  cliff: number // Unix timestamp (0 for no cliff)
  refundable: boolean
}

export interface CreateStreamResult {
  txHash: string
  streamId?: string // Parsed from event if available
}

export interface SimulateStreamResult {
  success: boolean
  revertReason?: string
}

export interface StreamCreatedEvent {
  streamId: bigint
  sender: string
  recipient: string
  token: string
  amount: bigint
  start: bigint
  end: bigint
  cliff: bigint
}
