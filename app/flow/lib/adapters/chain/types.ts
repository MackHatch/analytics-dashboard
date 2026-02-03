// Chain Adapter Types
// Types for wallet, ERC20, and transaction operations

export interface WalletConnection {
  address: string
  chainId: number
  isConnected: boolean
}

export interface TokenBalance {
  token: string
  balance: bigint
  decimals: number
  formatted: string
}

export interface Allowance {
  token: string
  owner: string
  spender: string
  allowance: bigint
  isSufficient: boolean
}

export interface TransactionStatus {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  confirmations: number
  blockNumber?: number
  error?: string
}

export interface TransactionReceipt {
  hash: string
  blockNumber: number
  blockHash: string
  confirmations: number
  status: 'success' | 'reverted'
  gasUsed: bigint
  logs: any[]
}
