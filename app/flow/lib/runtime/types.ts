// Flow Runtime Types
// State machine types for swap-to-stream flow

export enum Step {
  CONNECT = 'CONNECT',
  INPUTS = 'INPUTS',
  QUOTE = 'QUOTE',
  APPROVE_IN = 'APPROVE_IN',
  SWAP = 'SWAP',
  APPROVE_OUT = 'APPROVE_OUT',
  CREATE_STREAM = 'CREATE_STREAM',
  WAIT_INDEXED = 'WAIT_INDEXED',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  chainId: number
}

export interface ApprovalStatus {
  tokenIn: {
    approved: boolean
    allowance: bigint
    spender: string // DEX router address
  }
  tokenOut: {
    approved: boolean
    allowance: bigint
    spender: string // Stream contract address
  }
}

export interface QuoteResult {
  expectedOut: bigint
  minOut: bigint
  spender: string // Address that needs approval
  calldata: string // Swap transaction payload
  expiry: number // Timestamp when quote expires
  deadline?: number // Optional deadline for swap
}

export interface FlowState {
  // Current step
  step: Step
  
  // Token selection
  tokenIn: TokenInfo | null
  tokenOut: TokenInfo | null
  amountIn: string // User input as string
  slippage: number // Slippage tolerance (e.g., 0.5 for 0.5%)
  
  // Approval status
  approvals: ApprovalStatus | null
  
  // Quote data
  quote: QuoteResult | null
  
  // Transaction hashes
  approvalInTxHash: string | null
  swapTxHash: string | null
  approvalOutTxHash: string | null
  streamTxHash: string | null
  
  // Computed values
  amountOutReceived: bigint | null // Actual amount received from swap
  
  // Stream data
  streamId: string | null
  indexedStatus: {
    indexed: boolean
    indexedAtBlock: number | null
    indexedAt?: string // ISO timestamp
  }
  
  // Error state
  error: {
    message: string
    step: Step
    recoverable: boolean
  } | null
  
  // Metadata
  walletAddress: string | null
  chainId: number | null
  createdAt: number
  updatedAt: number
}

export interface TransitionResult {
  success: boolean
  nextStep?: Step
  error?: string
  stateUpdate?: Partial<FlowState>
}
