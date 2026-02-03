// DEX Adapter Types
// Types for DEX quoting and swapping

export interface QuoteInputs {
  tokenIn: string // Token address
  tokenOut: string // Token address
  amountIn: bigint
  slippage: number // Slippage tolerance (e.g., 0.5 for 0.5%)
  walletAddress: string // User's wallet address
  deadline?: number // Optional deadline timestamp
}

export interface QuoteOutputs {
  expectedOut: bigint // Expected output amount
  minOut: bigint // Minimum output amount (after slippage)
  spender: string // Address that needs approval (router)
  calldata: string // Swap transaction payload
  expiry: number // Timestamp when quote expires
  deadline: number // Deadline for swap transaction
  // Optional warnings
  lowLiquidity?: boolean
  highImpact?: boolean
  impactPercentage?: number
  // Additional info
  path?: string[] // Swap path (for multi-hop swaps)
}

export interface SwapInputs {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  minOut: bigint
  recipient: string // Where to send output tokens
  deadline: number
  calldata: string // From quote
  path?: string[] // Swap path (optional, can be derived from calldata)
}

export interface SwapResult {
  txHash: string
  expectedOut: bigint
  minOut: bigint
}
