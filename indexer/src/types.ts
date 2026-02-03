// Type definitions for indexer

export interface IndexerConfig {
  RPC_URL: string
  CHAIN_ID: bigint
  CONTRACT_ADDRESS: `0x${string}`
  START_BLOCK: bigint
  CONFIRMATIONS: number
  CHUNK_SIZE: number
  POLL_INTERVAL_MS: number
}

export interface DecodedEvent {
  eventName: string
  args: any
  streamId?: string
  blockNumber: number
  timestamp: number
}

export interface StreamCreatedArgs {
  streamId: bigint
  sender: string
  recipient: string
  token: string
  amount: bigint
  start: bigint
  end: bigint
  cliff: bigint
}

export interface WithdrawnArgs {
  streamId: bigint
  recipient: string
  amount: bigint
}

export interface CanceledArgs {
  streamId: bigint
  sender: string
  refunded: boolean
}

export interface TransferredArgs {
  streamId: bigint
  previousRecipient: string
  newRecipient: string
}
