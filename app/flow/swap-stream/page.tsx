'use client'

// Swap-to-Stream Flow Page
// This is the main entry point for the swap-to-stream flow

import { useEffect, useState } from 'react'
import { FlowRuntime, Step, FlowState } from '../lib/runtime'
import { Stepper } from '../components/Stepper'
import { ActionCard } from '../components/ActionCard'
import { DebugPanel } from '../components/DebugPanel'
import { TransactionStatus } from '../components/TransactionStatus'
import { useWagmiChainAdapter } from '../lib/adapters/chain/WagmiChainAdapter'
import { useConnect } from 'wagmi'
import { parseUnits } from 'viem'
import { DEXAdapter } from '../lib/adapters/dex/DEXAdapter'
import { StreamAdapter } from '../lib/adapters/stream/StreamAdapter'
import { IndexerAdapter } from '../lib/adapters/indexer/IndexerAdapter'

export default function SwapStreamPage() {
  const [flowRuntime] = useState(() => new FlowRuntime())
  const [state, setState] = useState<FlowState>(flowRuntime.getState())
  const [debugOpen, setDebugOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'pending' | 'confirmed' | 'failed'>('idle')
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null)

  // Wagmi hooks
  const { connectors, connect } = useConnect()
  const chainAdapter = useWagmiChainAdapter()
  const walletConnection = chainAdapter.getWalletConnection()

  // DEX adapter (recreate when chainId changes)
  const [dexAdapter, setDexAdapter] = useState<DEXAdapter | null>(null)
  
  // Stream adapter (recreate when chainId changes)
  const [streamAdapter, setStreamAdapter] = useState<StreamAdapter | null>(null)
  
  // Indexer adapter (singleton)
  const [indexerAdapter] = useState(() => new IndexerAdapter('/api'))

  useEffect(() => {
    if (state.chainId) {
      setDexAdapter(new DEXAdapter(state.chainId))
      try {
        setStreamAdapter(new StreamAdapter(state.chainId))
      } catch (error) {
        // Contract not deployed on this chain - will show error when trying to create stream
        console.warn('Stream adapter not available:', error)
        setStreamAdapter(null)
      }
    }
  }, [state.chainId])

  // Token balance hooks (hooks must be called unconditionally)
  const tokenInBalance = chainAdapter.useTokenBalance(
    state.tokenIn?.address || '0x0000000000000000000000000000000000000000',
    walletConnection?.address || '0x0000000000000000000000000000000000000000'
  )

  const tokenOutBalance = chainAdapter.useTokenBalance(
    state.tokenOut?.address || '0x0000000000000000000000000000000000000000',
    walletConnection?.address || '0x0000000000000000000000000000000000000000'
  )

  // Allowance hooks
  const tokenInAllowance = chainAdapter.useTokenAllowance(
    state.tokenIn?.address || '0x0000000000000000000000000000000000000000',
    walletConnection?.address || '0x0000000000000000000000000000000000000000',
    state.quote?.spender || '0x0000000000000000000000000000000000000000',
    state.tokenIn && state.amountIn
      ? parseUnits(state.amountIn, state.tokenIn.decimals)
      : undefined
  )

  // Token out allowance for stream contract (check after swap)
  const getStreamContractAddress = (): string => {
    if (!streamAdapter || !state.chainId) return '0x0000000000000000000000000000000000000000'
    try {
      return streamAdapter.getContractAddress(state.chainId)
    } catch {
      return '0x0000000000000000000000000000000000000000'
    }
  }

  const streamContractAddress = getStreamContractAddress()
  const tokenOutAllowance = chainAdapter.useTokenAllowance(
    state.tokenOut?.address || '0x0000000000000000000000000000000000000000',
    walletConnection?.address || '0x0000000000000000000000000000000000000000',
    streamContractAddress,
    state.amountOutReceived || undefined
  )

  // Update tokenIn approval status when allowance changes
  useEffect(() => {
    if (tokenInAllowance.allowance && state.tokenIn) {
      const isSufficient = tokenInAllowance.allowance.isSufficient
      if (!state.approvals || state.approvals.tokenIn.approved !== isSufficient) {
        flowRuntime.updateState({
          approvals: {
            tokenIn: {
              approved: isSufficient,
              allowance: tokenInAllowance.allowance.allowance,
              spender: tokenInAllowance.allowance.spender,
            },
            tokenOut: state.approvals?.tokenOut || {
              approved: false,
              allowance: 0n,
              spender: '',
            },
          },
        })
        setState(flowRuntime.getState())
      }
    }
  }, [tokenInAllowance.allowance, state.tokenIn, state.approvals])

  // Update tokenOut approval status when allowance changes
  useEffect(() => {
    if (tokenOutAllowance.allowance && state.tokenOut && state.amountOutReceived) {
      const isSufficient = tokenOutAllowance.allowance.isSufficient
      if (!state.approvals || state.approvals.tokenOut.approved !== isSufficient) {
        flowRuntime.updateState({
          approvals: {
            tokenIn: state.approvals?.tokenIn || {
              approved: false,
              allowance: 0n,
              spender: '',
            },
            tokenOut: {
              approved: isSufficient,
              allowance: tokenOutAllowance.allowance.allowance,
              spender: streamContractAddress,
            },
          },
        })
        setState(flowRuntime.getState())
      }
    }
  }, [tokenOutAllowance.allowance, state.tokenOut, state.amountOutReceived, state.approvals])

  // Update state when flow runtime changes
  useEffect(() => {
    setState(flowRuntime.getState())
  }, [flowRuntime])

  // Handle WAIT_INDEXED step - poll indexer
  useEffect(() => {
    if (state.step === Step.WAIT_INDEXED && state.streamTxHash && !state.indexedStatus.indexed) {
      let cancelled = false

      const pollIndexer = async () => {
        try {
          const result = await indexerAdapter.waitForIndexed({
            txHash: state.streamTxHash!,
            timeout: 120000, // 2 minutes
          })

          if (cancelled) return

          if (result.success) {
            flowRuntime.updateState({
              streamId: result.streamId,
              indexedStatus: {
                indexed: true,
                indexedAtBlock: result.indexedAtBlock,
                indexedAt: result.indexedAt,
              },
            })
            flowRuntime.transitionTo(Step.DONE)
            setState(flowRuntime.getState())
          } else {
            // Handle error - update error state
            if (result.error === 'TIMEOUT') {
              flowRuntime.updateState({
                error: {
                  message: 'Indexer timeout. Transaction confirmed but indexer is lagging. You can retry or check the dashboard manually.',
                  step: Step.WAIT_INDEXED,
                  recoverable: true,
                },
              })
              flowRuntime.transitionTo(Step.ERROR)
              setState(flowRuntime.getState())
            } else {
              flowRuntime.updateState({
                error: {
                  message: `Indexer error: ${result.message}`,
                  step: Step.WAIT_INDEXED,
                  recoverable: true,
                },
              })
              flowRuntime.transitionTo(Step.ERROR)
              setState(flowRuntime.getState())
            }
          }
        } catch (error) {
          if (cancelled) return
          console.error('Error polling indexer:', error)
        }
      }

      pollIndexer()

      return () => {
        cancelled = true
      }
    }
  }, [state.step, state.streamTxHash, state.indexedStatus.indexed, indexerAdapter, flowRuntime])

  // Sync wallet connection with flow state
  useEffect(() => {
    if (walletConnection && walletConnection.address !== state.walletAddress) {
      flowRuntime.updateState({
        walletAddress: walletConnection.address,
        chainId: walletConnection.chainId,
      })
      if (state.step === Step.CONNECT) {
        flowRuntime.transitionTo(Step.INPUTS)
      }
      setState(flowRuntime.getState())
    }
  }, [walletConnection, state.walletAddress, state.step, flowRuntime])

  // Handle transaction status updates
  const { receipt, isLoading: txLoading, isSuccess: txSuccess, isError: txFailed } = 
    chainAdapter.useWaitForTransaction(currentTxHash || undefined)

  useEffect(() => {
    if (txLoading && currentTxHash) {
      setTxStatus('pending')
    } else if (txSuccess && receipt) {
      setTxStatus('confirmed')
      // Update flow state based on current step
      handleTransactionConfirmed(currentTxHash!, receipt)
    } else if (txFailed) {
      setTxStatus('failed')
      // Handle transaction failure - set error state
      const currentState = flowRuntime.getState()
      flowRuntime.updateState({
        error: {
          message: chainAdapter.txError?.message || 'Transaction failed',
          step: currentState.step,
          recoverable: true,
        },
      })
      flowRuntime.transitionTo(Step.ERROR)
      setState(flowRuntime.getState())
    }
  }, [txLoading, txSuccess, txFailed, receipt, currentTxHash])

  // Handle transaction confirmation
  const handleTransactionConfirmed = (txHash: string, receipt: any) => {
    const currentStep = flowRuntime.getState()
    const currentStepType = currentStep.step

    switch (currentStepType) {
      case Step.APPROVE_IN:
        flowRuntime.updateState({
          approvalInTxHash: txHash,
          approvals: {
            tokenIn: {
              approved: true,
              allowance: BigInt(state.amountIn) * BigInt(1e18), // Approximate
              spender: state.quote?.spender || '',
            },
            tokenOut: {
              approved: false,
              allowance: 0n,
              spender: '',
            },
          },
        })
        setTimeout(() => {
          flowRuntime.transitionTo(Step.SWAP)
          setState(flowRuntime.getState())
        }, 1000)
        break

      case Step.APPROVE_OUT:
        flowRuntime.updateState({
          approvalOutTxHash: txHash,
          approvals: {
            ...state.approvals!,
            tokenOut: {
              approved: true,
              allowance: state.amountOutReceived || BigInt(0),
              spender: '', // Stream contract address
            },
          },
        })
        setTimeout(() => {
          flowRuntime.transitionTo(Step.CREATE_STREAM)
          setState(flowRuntime.getState())
        }, 1000)
        break

      case Step.SWAP:
        // Calculate actual received amount from balance difference
        const balanceBefore = (window as any).__swapBalanceBefore as bigint | undefined
        const balanceAfter = tokenOutBalance.balance?.balance || 0n
        
        // If we have balance snapshots, use the difference
        // Otherwise fall back to expectedOut from quote
        const amountOutReceived = balanceBefore !== undefined && balanceAfter > balanceBefore
          ? balanceAfter - balanceBefore
          : state.quote?.expectedOut || BigInt(0)

        flowRuntime.updateState({
          swapTxHash: txHash,
          amountOutReceived,
        })

        // Clean up stored balance
        delete (window as any).__swapBalanceBefore

        // Refresh tokenOut balance to get accurate amount
        // The balance hook will update automatically, triggering allowance check
        
        // Check allowance for stream contract and transition accordingly
        setTimeout(() => {
          flowRuntime.autoAdvance()
          setState(flowRuntime.getState())
        }, 1000)
        break

      case Step.CREATE_STREAM:
        // Try to parse streamId from receipt
        let parsedStreamId: string | undefined

        if (streamAdapter && receipt) {
          const event = streamAdapter.parseStreamCreatedEvent(receipt)
          if (event) {
            parsedStreamId = event.streamId.toString()
          }
        }

        flowRuntime.updateState({
          streamTxHash: txHash,
          streamId: parsedStreamId || currentStep.streamId, // Use parsed or existing
        })

        // Transition to WAIT_INDEXED regardless (indexer is source of truth)
        // Even if we parsed streamId, we still wait for indexer confirmation
        setTimeout(() => {
          flowRuntime.transitionTo(Step.WAIT_INDEXED)
          setState(flowRuntime.getState())
        }, 1000)
        break
    }

    setCurrentTxHash(null)
    setTxStatus('idle')
  }

  // Handle actions from ActionCard
  const handleAction = async (action: string, data?: any) => {
    try {
      switch (action) {
        case 'connect':
          // Real wallet connection
          if (connectors.length > 0) {
            setTxStatus('signing')
            connect({ connector: connectors[0] })
            // State will be updated via useEffect when wallet connects
          } else {
            throw new Error('No wallet connectors available')
          }
          break

        case 'setTokenIn':
          flowRuntime.updateState({
            tokenIn: {
              address: data,
              symbol: 'USDC',
              decimals: 6,
              chainId: 11155111,
            },
          })
          break

        case 'setTokenOut':
          flowRuntime.updateState({
            tokenOut: {
              address: data,
              symbol: 'DAI',
              decimals: 18,
              chainId: 11155111,
            },
          })
          break

        case 'setAmountIn':
          flowRuntime.updateState({ amountIn: data })
          break

        case 'continue':
          // Auto-advance to next step
          flowRuntime.autoAdvance()
          break

        case 'getQuote':
          // Real quote generation
          if (!dexAdapter || !state.tokenIn || !state.tokenOut || !state.amountIn || !walletConnection) {
            throw new Error('Missing required data for quote. Please connect wallet and select tokens.')
          }

          setTxStatus('pending') // Show loading state
          try {
            const amountInParsed = parseUnits(state.amountIn, state.tokenIn.decimals)
            const quote = await dexAdapter.getQuote({
              tokenIn: state.tokenIn.address,
              tokenOut: state.tokenOut.address,
              amountIn: amountInParsed,
              slippage: state.slippage,
              walletAddress: walletConnection.address,
            })
            flowRuntime.updateState({ quote })
            setTxStatus('idle')
            flowRuntime.autoAdvance()
            setState(flowRuntime.getState())
          } catch (error: any) {
            setTxStatus('idle')
            throw new Error(`Failed to get quote: ${error.message}`)
          }
          break

        case 'refreshQuote':
          // Refresh quote
          if (!dexAdapter || !state.tokenIn || !state.tokenOut || !state.amountIn || !walletConnection) {
            throw new Error('Missing required data for quote. Please connect wallet and select tokens.')
          }

          setTxStatus('pending')
          try {
            const amountInParsed = parseUnits(state.amountIn, state.tokenIn.decimals)
            const newQuote = await dexAdapter.getQuote({
              tokenIn: state.tokenIn.address,
              tokenOut: state.tokenOut.address,
              amountIn: amountInParsed,
              slippage: state.slippage,
              walletAddress: walletConnection.address,
            })
            flowRuntime.updateState({ quote: newQuote })
            setTxStatus('idle')
            setState(flowRuntime.getState())
          } catch (error: any) {
            setTxStatus('idle')
            throw new Error(`Failed to refresh quote: ${error.message}`)
          }
          break

        case 'approve':
          // Real approval transaction
          if (!state.tokenIn && !state.tokenOut) {
            throw new Error('No token selected')
          }

          const tokenAddress = state.step === Step.APPROVE_IN 
            ? state.tokenIn?.address 
            : state.tokenOut?.address

          if (!tokenAddress) {
            throw new Error('Token address not found')
          }

          const spender = state.step === Step.APPROVE_IN
            ? state.quote?.spender || ''
            : '' // Stream contract address - TODO: get from config

          const amount = state.step === Step.APPROVE_IN
            ? parseUnits(state.amountIn, state.tokenIn?.decimals || 18)
            : state.amountOutReceived || BigInt(0)

          if (!spender) {
            throw new Error('Spender address not found')
          }

          setTxStatus('signing')
          const approveTxHash = await chainAdapter.approveToken(
            tokenAddress,
            spender,
            amount
          )
          setCurrentTxHash(approveTxHash)
          setState(flowRuntime.getState())
          break

        case 'swap':
          // Real swap execution
          if (!dexAdapter || !state.quote || !state.tokenIn || !state.tokenOut || !state.amountIn || !walletConnection) {
            throw new Error('Missing required data for swap')
          }

          // Verify quote not stale
          if (!dexAdapter.isQuoteValid(state.quote)) {
            throw new Error('Quote expired. Please refresh the quote.')
          }

          // Verify allowance sufficient
          if (!state.approvals?.tokenIn.approved) {
            throw new Error('Token approval required before swap')
          }

          setTxStatus('signing')

          try {
            // Take balance snapshot before swap
            const balanceBefore = tokenOutBalance.balance?.balance || 0n

            // Optional: Simulate swap first
            const simulation = await dexAdapter.simulateSwap({
              tokenIn: state.tokenIn.address,
              tokenOut: state.tokenOut.address,
              amountIn: parseUnits(state.amountIn, state.tokenIn.decimals),
              minOut: state.quote.minOut,
              recipient: walletConnection.address,
              deadline: state.quote.deadline,
              calldata: state.quote.calldata,
            })

            if (!simulation.success) {
              throw new Error(`Swap simulation failed: ${simulation.revertReason || 'Unknown error'}`)
            }

            // Execute swap
            const swapResult = await dexAdapter.executeSwap({
              tokenIn: state.tokenIn.address,
              tokenOut: state.tokenOut.address,
              amountIn: parseUnits(state.amountIn, state.tokenIn.decimals),
              minOut: state.quote.minOut,
              recipient: walletConnection.address,
              deadline: state.quote.deadline,
              calldata: state.quote.calldata,
            })

            setCurrentTxHash(swapResult.txHash)
            flowRuntime.updateState({
              swapTxHash: swapResult.txHash,
            })
            setState(flowRuntime.getState())

            // Wait for transaction confirmation
            // The useEffect hook will handle the confirmation and update amountOutReceived
            // Store balanceBefore for later calculation
            ;(window as any).__swapBalanceBefore = balanceBefore
          } catch (error: any) {
            setTxStatus('idle')
            setCurrentTxHash(null)
            throw new Error(`Swap failed: ${error.message}`)
          }
          break

        case 'createStream':
          // Real stream creation
          if (!streamAdapter || !state.tokenOut || !state.amountOutReceived || !walletConnection) {
            throw new Error('Missing required data for stream creation')
          }

          // Get recipient from data (user input)
          const recipient = data?.recipient || walletConnection.address // Default to self if not provided

          if (!recipient || !recipient.startsWith('0x')) {
            throw new Error('Invalid recipient address')
          }

          setTxStatus('signing')

          try {
            // Calculate stream parameters
            const now = Math.floor(Date.now() / 1000)
            const start = now // Start immediately
            const end = now + 30 * 24 * 60 * 60 // 30 days default
            const cliff = 0 // No cliff

            // Simulate stream creation first
            const simulation = await streamAdapter.simulateCreateStream({
              recipient,
              token: state.tokenOut.address,
              amount: state.amountOutReceived,
              start,
              end,
              cliff,
              refundable: false,
            })

            if (!simulation.success) {
              throw new Error(`Stream simulation failed: ${simulation.revertReason || 'Unknown error'}`)
            }

            // Send stream creation transaction
            const streamResult = await streamAdapter.sendCreateStream({
              recipient,
              token: state.tokenOut.address,
              amount: state.amountOutReceived,
              start,
              end,
              cliff,
              refundable: false,
            })

            setCurrentTxHash(streamResult.txHash)
            flowRuntime.updateState({
              streamTxHash: streamResult.txHash,
              streamId: streamResult.streamId, // If parsed from event
            })
            setState(flowRuntime.getState())

            // Wait for transaction confirmation
            // The useEffect hook will handle the confirmation and parse streamId from receipt
          } catch (error: any) {
            setTxStatus('idle')
            setCurrentTxHash(null)
            throw new Error(`Stream creation failed: ${error.message}`)
          }
          break

        case 'retry':
          // Retry from error state - smart retry based on context
          flowRuntime.updateState({ error: null })
          
          if (state.error?.step === Step.WAIT_INDEXED && state.streamTxHash) {
            // Retry indexer wait
            flowRuntime.transitionTo(Step.WAIT_INDEXED)
            setState(flowRuntime.getState())
            // The useEffect hook will trigger the poll again
          } else if (state.error?.step === Step.CREATE_STREAM && state.swapTxHash && state.amountOutReceived) {
            // Swap succeeded, retry stream creation
            if (state.approvals?.tokenOut.approved) {
              flowRuntime.transitionTo(Step.CREATE_STREAM)
            } else {
              flowRuntime.transitionTo(Step.APPROVE_OUT)
            }
            setState(flowRuntime.getState())
          } else if (state.error?.step === Step.SWAP && state.quote && !dexAdapter?.isQuoteValid(state.quote)) {
            // Quote expired, refresh quote first
            flowRuntime.transitionTo(Step.QUOTE)
            setState(flowRuntime.getState())
          } else {
            // Generic retry - try current step again
            const recoveryStep = flowRuntime.determineRecoveryStep()
            flowRuntime.transitionTo(recoveryStep)
            setState(flowRuntime.getState())
          }
          break

        case 'recover':
          // Recovery: determine safe step and resume
          const recoveryStep = flowRuntime.determineRecoveryStep()
          flowRuntime.updateState({ error: null })
          flowRuntime.transitionTo(recoveryStep)
          setState(flowRuntime.getState())
          break

        case 'reset':
          flowRuntime.reset()
          break
      }

      setState(flowRuntime.getState())
    } catch (error: any) {
      flowRuntime.updateState({
        error: {
          message: error.message || 'An error occurred',
          step: state.step,
          recoverable: true,
        },
      })
      flowRuntime.transitionTo(Step.ERROR)
      setState(flowRuntime.getState())
    }
  }

  // Get completed steps for stepper
  const getCompletedSteps = (): Step[] => {
    const completed: Step[] = []
    const stepOrder = [
      Step.CONNECT,
      Step.INPUTS,
      Step.QUOTE,
      Step.APPROVE_IN,
      Step.SWAP,
      Step.APPROVE_OUT,
      Step.CREATE_STREAM,
      Step.WAIT_INDEXED,
    ]

    for (const step of stepOrder) {
      if (step === state.step) break
      completed.push(step)
    }

    return completed
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
        Swap to Stream
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-8">
        Swap tokens and create a streaming payment in one flow.
      </p>

      {/* Stepper */}
      <div className="mb-8 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Stepper currentStep={state.step} completedSteps={getCompletedSteps()} />
      </div>

      {/* Action Card */}
      <ActionCard step={state.step} state={state} onAction={handleAction} />

      {/* Transaction Status */}
      {txStatus !== 'idle' && (
        <div className="mt-4">
          <TransactionStatus
            status={txStatus}
            txHash={currentTxHash || undefined}
            error={chainAdapter.txError?.message}
            explorerUrl={currentTxHash ? chainAdapter.getTransactionUrl(currentTxHash, state.chainId || 11155111) : undefined}
            onRetry={() => {
              setTxStatus('idle')
              setCurrentTxHash(null)
              handleAction('approve') // Retry current action
            }}
          />
        </div>
      )}

      {/* Debug Panel */}
      <DebugPanel state={state} isOpen={debugOpen} onToggle={() => setDebugOpen(!debugOpen)} />
    </div>
  )
}
