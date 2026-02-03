// Uniswap V2 DEX Adapter
// Implements quote generation and swap execution for Uniswap V2

'use client'

import { readContract, simulateContract, writeContract } from '@wagmi/core'
import { parseUnits, formatUnits, encodeFunctionData, decodeFunctionData } from 'viem'
import { QuoteInputs, QuoteOutputs, SwapInputs, SwapResult } from './types'
import { wagmiConfig } from '@/lib/wagmi'

// Uniswap V2 Router ABI (simplified)
const UNISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETH',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'reserveIn', type: 'uint256' },
      { name: 'reserveOut', type: 'uint256' },
    ],
    name: 'getAmountOut',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const

// Uniswap V2 Router addresses by chain
const UNISWAP_V2_ROUTER: Record<number, `0x${string}`> = {
  1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Mainnet
  11155111: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008', // Sepolia (Uniswap V2 Sepolia)
  84532: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // Base Sepolia (Uniswap V2)
  31337: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Anvil (use mainnet address)
}

// Uniswap V2 Factory for getting pair addresses
const UNISWAP_V2_FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const UNISWAP_V2_FACTORY: Record<number, `0x${string}`> = {
  1: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  11155111: '0x7E0987E5b3a30e3f2828572Bb659A548460a3003', // Sepolia
  84532: '0x8909Dc5e7d2B5C6C0C5C5C5C5C5C5C5C5C5C5C5C5', // Base Sepolia (placeholder)
  31337: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
}

// Pair ABI for getting reserves
const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export class UniswapV2Adapter {
  private chainId: number
  private routerAddress: `0x${string}`
  private factoryAddress: `0x${string}`

  constructor(chainId: number) {
    this.chainId = chainId
    this.routerAddress = UNISWAP_V2_ROUTER[chainId] || UNISWAP_V2_ROUTER[1]
    this.factoryAddress = UNISWAP_V2_FACTORY[chainId] || UNISWAP_V2_FACTORY[1]
  }

  /**
   * Get quote for swapping tokens
   */
  async getQuote(inputs: QuoteInputs): Promise<QuoteOutputs> {
    const { tokenIn, tokenOut, amountIn, slippage, walletAddress, deadline } = inputs

    // Get pair address
    const pairAddress = await this.getPairAddress(tokenIn, tokenOut)
    if (!pairAddress) {
      throw new Error('No liquidity pool found for this token pair')
    }

    // Get reserves
    const reserves = await this.getReserves(pairAddress, tokenIn, tokenOut)
    if (!reserves) {
      throw new Error('Failed to get pool reserves')
    }

    // Calculate expected output using Uniswap V2 formula
    const expectedOut = this.calculateAmountOut(
      amountIn,
      reserves.reserveIn,
      reserves.reserveOut
    )

    // Calculate minimum output with slippage
    const slippageBps = BigInt(Math.floor(slippage * 100)) // Convert to basis points
    const minOut = (expectedOut * (BigInt(10000) - slippageBps)) / BigInt(10000)

    // Build swap path
    const path: `0x${string}`[] = [tokenIn as `0x${string}`, tokenOut as `0x${string}`]

    // Determine swap function and build calldata
    const isETHIn = tokenIn === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    const isETHOut = tokenOut === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

    let functionName: string
    let calldata: `0x${string}`

    const swapDeadline = deadline || BigInt(Math.floor(Date.now() / 1000) + 1800) // Default 30 min

    if (isETHIn) {
      functionName = 'swapExactETHForTokens'
      calldata = encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [minOut, path, walletAddress as `0x${string}`, swapDeadline],
      })
    } else if (isETHOut) {
      functionName = 'swapExactTokensForETH'
      calldata = encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [amountIn, minOut, path, walletAddress as `0x${string}`, swapDeadline],
      })
    } else {
      functionName = 'swapExactTokensForTokens'
      calldata = encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [amountIn, minOut, path, walletAddress as `0x${string}`, swapDeadline],
      })
    }

    // Check for low liquidity / high impact
    const impactPercentage = this.calculateImpact(amountIn, reserves.reserveIn)
    const lowLiquidity = reserves.reserveIn < parseUnits('1000', 18) // Less than 1000 tokens
    const highImpact = impactPercentage > 1 // More than 1% impact

    return {
      expectedOut,
      minOut,
      spender: this.routerAddress,
      calldata,
      expiry: Date.now() + 30000, // 30 seconds
      deadline: Number(swapDeadline),
      lowLiquidity,
      highImpact,
      impactPercentage,
    }
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(inputs: SwapInputs): Promise<SwapResult> {
    // Verify quote not stale (check deadline)
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (inputs.deadline < Number(now)) {
      throw new Error('Quote expired. Please get a new quote.')
    }

    // Try to decode calldata to get function name and args
    let functionName: string
    let args: any[]
    let value: bigint | undefined

    try {
      const decoded = decodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        data: inputs.calldata as `0x${string}`,
      })
      functionName = decoded.functionName
      args = decoded.args as any[]
    } catch {
      // Fallback: determine function from calldata signature
      const isETHIn = inputs.calldata.startsWith('0x7ff36ab5') // swapExactETHForTokens
      const isETHOut = inputs.calldata.startsWith('0x18cbafe5') // swapExactTokensForETH

      const path = inputs.path || [inputs.tokenIn as `0x${string}`, inputs.tokenOut as `0x${string}`]

      if (isETHIn) {
        functionName = 'swapExactETHForTokens'
        args = [inputs.minOut, path, inputs.recipient as `0x${string}`, BigInt(inputs.deadline)]
        value = inputs.amountIn
      } else if (isETHOut) {
        functionName = 'swapExactTokensForETH'
        args = [inputs.amountIn, inputs.minOut, path, inputs.recipient as `0x${string}`, BigInt(inputs.deadline)]
      } else {
        functionName = 'swapExactTokensForTokens'
        args = [inputs.amountIn, inputs.minOut, path, inputs.recipient as `0x${string}`, BigInt(inputs.deadline)]
      }
    }

    // Execute swap
    const txHash = await writeContract(wagmiConfig, {
      address: this.routerAddress,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: functionName as any,
      args,
      value,
    })

    return {
      txHash,
      expectedOut: inputs.minOut, // Will be updated after confirmation with actual received amount
      minOut: inputs.minOut,
    }
  }

  /**
   * Simulate swap to check if it would succeed
   */
  async simulateSwap(inputs: SwapInputs): Promise<{ success: boolean; revertReason?: string }> {
    try {
      const isETHIn = inputs.calldata.startsWith('0x7ff36ab5')
      const isETHOut = inputs.calldata.startsWith('0x18cbafe5')

      if (isETHIn) {
        await simulateContract(wagmiConfig, {
          address: this.routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [
            inputs.minOut,
            [inputs.tokenIn as `0x${string}`, inputs.tokenOut as `0x${string}`],
            inputs.recipient as `0x${string}`,
            BigInt(inputs.deadline),
          ],
          value: inputs.amountIn,
        })
      } else if (isETHOut) {
        await simulateContract(wagmiConfig, {
          address: this.routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [
            inputs.amountIn,
            inputs.minOut,
            [inputs.tokenIn as `0x${string}`, inputs.tokenOut as `0x${string}`],
            inputs.recipient as `0x${string}`,
            BigInt(inputs.deadline),
          ],
        })
      } else {
        await simulateContract(wagmiConfig, {
          address: this.routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [
            inputs.amountIn,
            inputs.minOut,
            [inputs.tokenIn as `0x${string}`, inputs.tokenOut as `0x${string}`],
            inputs.recipient as `0x${string}`,
            BigInt(inputs.deadline),
          ],
        })
      }

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        revertReason: error.message || 'Simulation failed',
      }
    }
  }

  /**
   * Check if quote is still valid
   */
  isQuoteValid(quote: QuoteOutputs): boolean {
    return Date.now() < quote.expiry
  }

  /**
   * Get router address
   */
  getRouterAddress(): string {
    return this.routerAddress
  }

  // Private helper methods

  private async getPairAddress(tokenA: string, tokenB: string): Promise<`0x${string}` | null> {
    try {
      const pair = await readContract(wagmiConfig, {
        address: this.factoryAddress,
        abi: UNISWAP_V2_FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA as `0x${string}`, tokenB as `0x${string}`],
      })
      return pair as `0x${string}` || null
    } catch {
      return null
    }
  }

  private async getReserves(
    pairAddress: `0x${string}`,
    tokenIn: string,
    tokenOut: string
  ): Promise<{ reserveIn: bigint; reserveOut: bigint } | null> {
    try {
      const [reserves, token0] = await Promise.all([
        readContract(wagmiConfig, {
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'getReserves',
        }),
        readContract(wagmiConfig, {
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'token0',
        }),
      ])

      const isToken0In = token0.toLowerCase() === tokenIn.toLowerCase()
      return {
        reserveIn: isToken0In ? reserves[0] : reserves[1],
        reserveOut: isToken0In ? reserves[1] : reserves[0],
      }
    } catch {
      return null
    }
  }

  private calculateAmountOut(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint
  ): bigint {
    // Uniswap V2 formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    const amountInWithFee = amountIn * BigInt(997)
    const numerator = amountInWithFee * reserveOut
    const denominator = reserveIn * BigInt(1000) + amountInWithFee
    return numerator / denominator
  }

  private calculateImpact(amountIn: bigint, reserveIn: bigint): number {
    if (reserveIn === 0n) return 100
    const impact = (Number(amountIn) / Number(reserveIn)) * 100
    return impact
  }
}
