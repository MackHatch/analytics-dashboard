// Wagmi-based Chain Adapter Implementation
// Real wallet, ERC20, and transaction operations using wagmi

'use client'

import {
  useAccount,
  useChainId,
  useSwitchChain,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { erc20Abi, formatUnits, parseUnits } from 'viem'
import {
  WalletConnection,
  TokenBalance,
  Allowance,
  TransactionStatus,
  TransactionReceipt,
} from './types'

export function useWagmiChainAdapter() {
  const account = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: txHash, isPending, error: txError } = useWriteContract()

  // Get wallet connection
  const getWalletConnection = (): WalletConnection | null => {
    if (!account.address) return null
    return {
      address: account.address,
      chainId,
      isConnected: account.isConnected,
    }
  }

  // Connect wallet (handled by wagmi connectors)
  const connectWallet = async (): Promise<WalletConnection> => {
    if (!account.isConnected) {
      throw new Error('Please connect wallet using wagmi connector')
    }
    return getWalletConnection()!
  }

  // Switch chain
  const switchToChain = async (targetChainId: number): Promise<boolean> => {
    try {
      await switchChain({ chainId: targetChainId })
      return true
    } catch (error) {
      console.error('Failed to switch chain:', error)
      return false
    }
  }

  // Get token balance
  const useTokenBalance = (tokenAddress: string, walletAddress: string) => {
    const { data: balance, isLoading } = useBalance({
      address: walletAddress as `0x${string}`,
      token: tokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ? (tokenAddress as `0x${string}`) : undefined,
    })

    return {
      balance: balance ? {
        token: tokenAddress,
        balance: BigInt(balance.value),
        decimals: balance.decimals,
        formatted: balance.formatted,
      } : null,
      isLoading,
    }
  }

  // Get allowance
  const useTokenAllowance = (
    tokenAddress: string,
    owner: string,
    spender: string,
    amount?: bigint
  ) => {
    const { data: allowance, isLoading } = useReadContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
    })

    return {
      allowance: allowance ? {
        token: tokenAddress,
        owner,
        spender,
        allowance: BigInt(allowance),
        isSufficient: amount ? BigInt(allowance) >= amount : true,
      } : null,
      isLoading,
    }
  }

  // Approve token
  const approveToken = async (
    tokenAddress: string,
    spender: string,
    amount: bigint
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      writeContract(
        {
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender as `0x${string}`, amount],
        },
        {
          onSuccess: (hash) => {
            resolve(hash)
          },
          onError: (error) => {
            reject(error)
          },
        }
      )
    })
  }

  // Wait for transaction
  const useWaitForTransaction = (hash: string | undefined) => {
    const { data: receipt, isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
      hash: hash as `0x${string}` | undefined,
    })

    return {
      receipt: receipt ? {
        hash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash,
        confirmations: receipt.status === 'success' ? 1 : 0,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed,
        logs: receipt.logs,
      } : null,
      isLoading,
      isSuccess,
      isError,
    }
  }

  // Send generic transaction (using sendTransaction from wagmi)
  // Note: For generic calls, you'd use useSendTransaction hook instead
  // This is a placeholder - actual implementation would use useSendTransaction
  const sendTransaction = async (
    to: string,
    data: string,
    value?: bigint
  ): Promise<string> => {
    // This would need to use useSendTransaction hook
    // For now, throw error to indicate it needs proper implementation
    throw new Error('Generic transaction sending requires useSendTransaction hook')
  }

  // Get transaction explorer URL
  const getTransactionUrl = (txHash: string, chainId: number): string => {
    const explorers: Record<number, string> = {
      11155111: 'https://sepolia.etherscan.io/tx/', // Sepolia
      84532: 'https://sepolia.basescan.org/tx/', // Base Sepolia
      31337: `http://localhost:8545/tx/`, // Anvil (not a real explorer)
    }
    return `${explorers[chainId] || 'https://etherscan.io/tx/'}${txHash}`
  }

  return {
    // Wallet
    getWalletConnection,
    connectWallet,
    switchToChain,
    account,
    chainId,

    // ERC20
    useTokenBalance,
    useTokenAllowance,
    approveToken,

    // Transactions
    sendTransaction,
    useWaitForTransaction,
    getTransactionUrl,

    // Transaction state
    txHash,
    isPending,
    txError,
  }
}
