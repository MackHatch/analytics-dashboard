// Chain Adapter
// Single responsibility: wallet, ERC20 reads, transaction sending

import {
  WalletConnection,
  TokenBalance,
  Allowance,
  TransactionStatus,
  TransactionReceipt,
} from './types'

export class ChainAdapter {
  // TODO: Initialize with wallet provider (wagmi, ethers, etc.)
  constructor() {
    // Placeholder
  }

  // Wallet operations
  async connectWallet(): Promise<WalletConnection> {
    // TODO: Implement wallet connection
    // - Connect wallet (MetaMask, WalletConnect, etc.)
    // - Get address and chainId
    // - Return connection info
    throw new Error('Not implemented: connectWallet')
  }

  async disconnectWallet(): Promise<void> {
    // TODO: Implement wallet disconnection
    throw new Error('Not implemented: disconnectWallet')
  }

  async getWalletConnection(): Promise<WalletConnection | null> {
    // TODO: Get current wallet connection status
    throw new Error('Not implemented: getWalletConnection')
  }

  async switchChain(chainId: number): Promise<boolean> {
    // TODO: Prompt user to switch to correct chain
    // - Check current chain
    // - If wrong, prompt switch
    // - Return success/failure
    throw new Error('Not implemented: switchChain')
  }

  // ERC20 read operations
  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string
  ): Promise<TokenBalance> {
    // TODO: Read ERC20 balance
    // - Call balanceOf(tokenAddress, walletAddress)
    // - Get decimals
    // - Format and return
    throw new Error('Not implemented: getTokenBalance')
  }

  async getAllowance(
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<Allowance> {
    // TODO: Read ERC20 allowance
    // - Call allowance(tokenAddress, owner, spender)
    // - Check if sufficient for intended amount
    // - Return allowance info
    throw new Error('Not implemented: getAllowance')
  }

  // ERC20 approval operations
  async approve(
    tokenAddress: string,
    spender: string,
    amount: bigint
  ): Promise<TransactionStatus> {
    // TODO: Send approval transaction
    // - Build approve calldata
    // - Send transaction
    // - Track lifecycle: signing → pending → confirmed → failed
    // - Return transaction status
    throw new Error('Not implemented: approve')
  }

  async waitForTransaction(
    txHash: string,
    confirmations: number = 1
  ): Promise<TransactionReceipt> {
    // TODO: Wait for transaction confirmation
    // - Poll transaction status
    // - Wait for required confirmations
    // - Return receipt or throw on failure
    throw new Error('Not implemented: waitForTransaction')
  }

  // Transaction operations
  async sendTransaction(
    to: string,
    data: string,
    value?: bigint
  ): Promise<TransactionStatus> {
    // TODO: Send generic transaction
    // - Build transaction
    // - Send and track lifecycle
    // - Return transaction status
    throw new Error('Not implemented: sendTransaction')
  }

  async getTransactionReceipt(
    txHash: string
  ): Promise<TransactionReceipt | null> {
    // TODO: Get transaction receipt
    // - Fetch receipt from chain
    // - Parse logs
    // - Return receipt or null if not found
    throw new Error('Not implemented: getTransactionReceipt')
  }

  // Utility: Get transaction explorer URL
  getTransactionUrl(txHash: string, chainId: number): string {
    // TODO: Return explorer URL based on chainId
    // - Etherscan for mainnet/sepolia
    // - Basescan for Base
    // - etc.
    throw new Error('Not implemented: getTransactionUrl')
  }
}
