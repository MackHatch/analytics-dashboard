// Flow Runtime - State Machine + Transitions
// Single responsibility: manage flow state and transitions

import { Step, FlowState, TransitionResult } from './types'

const STORAGE_KEY = 'swap-stream-flow-state'

export class FlowRuntime {
  private state: FlowState

  constructor(initialState?: FlowState) {
    if (initialState) {
      this.state = initialState
    } else {
      this.state = this.getInitialState()
      // Try to restore from localStorage
      const restored = this.restoreState()
      if (restored) {
        this.state = restored
      }
    }
  }

  private getInitialState(): FlowState {
    return {
      step: Step.CONNECT,
      tokenIn: null,
      tokenOut: null,
      amountIn: '',
      slippage: 0.5, // Default 0.5%
      approvals: null,
      quote: null,
      approvalInTxHash: null,
      swapTxHash: null,
      approvalOutTxHash: null,
      streamTxHash: null,
      amountOutReceived: null,
      streamId: null,
      indexedStatus: {
        indexed: false,
        indexedAtBlock: null,
      },
      error: null,
      walletAddress: null,
      chainId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  getState(): FlowState {
    return { ...this.state }
  }

  // Persist state to localStorage
  persistState(): void {
    try {
      // Serialize BigInt values as strings
      const serialized = JSON.stringify(this.state, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString()
        }
        return value
      })
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch (error) {
      console.error('Failed to persist flow state:', error)
    }
  }

  // Restore state from localStorage
  restoreState(): FlowState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null

      // Parse and restore BigInt values
      const parsed = JSON.parse(stored, (key, value) => {
        // Restore BigInt values (check if string represents a bigint)
        if (
          typeof value === 'string' &&
          (key === 'expectedOut' ||
            key === 'minOut' ||
            key === 'allowance' ||
            key === 'amountOutReceived' ||
            key === 'amount' ||
            key === 'start' ||
            key === 'end' ||
            key === 'cliff' ||
            key === 'expiry' ||
            key === 'deadline')
        ) {
          try {
            return BigInt(value)
          } catch {
            return value
          }
        }
        return value
      }) as FlowState

      // Validate and restore, resuming at safest step
      return this.resumeAtSafeStep(parsed)
    } catch (error) {
      console.error('Failed to restore flow state:', error)
      return null
    }
  }

  // Determine safest step to resume at based on current state
  private resumeAtSafeStep(state: FlowState): FlowState {
    // If stream tx exists but no index result → resume WAIT_INDEXED
    if (state.streamTxHash && !state.indexedStatus.indexed) {
      return { ...state, step: Step.WAIT_INDEXED }
    }

    // If swap tx exists but stream tx doesn't → resume APPROVE_OUT/CREATE_STREAM
    if (state.swapTxHash && !state.streamTxHash) {
      // Check if approval needed
      if (state.approvals?.tokenOut.approved) {
        return { ...state, step: Step.CREATE_STREAM }
      } else {
        return { ...state, step: Step.APPROVE_OUT }
      }
    }

    // Otherwise resume at current step
    return state
  }

  // Update state and persist
  updateState(updates: Partial<FlowState>): void {
    this.state = {
      ...this.state,
      ...updates,
      updatedAt: Date.now(),
    }
    this.persistState()
  }

  // Transition to next step
  transitionTo(step: Step, updates?: Partial<FlowState>): TransitionResult {
    // Validate transition
    const validation = this.validateTransition(this.state.step, step)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      }
    }

    // Update state
    this.updateState({
      step,
      ...updates,
    })

    return {
      success: true,
      nextStep: step,
    }
  }

  // Validate if transition is allowed
  private validateTransition(from: Step, to: Step): { valid: boolean; error?: string } {
    // Define valid transitions
    const validTransitions: Record<Step, Step[]> = {
      [Step.CONNECT]: [Step.INPUTS, Step.ERROR],
      [Step.INPUTS]: [Step.QUOTE, Step.ERROR],
      [Step.QUOTE]: [Step.APPROVE_IN, Step.SWAP, Step.ERROR], // Skip approve if allowance sufficient
      [Step.APPROVE_IN]: [Step.SWAP, Step.ERROR],
      [Step.SWAP]: [Step.APPROVE_OUT, Step.CREATE_STREAM, Step.ERROR], // Skip approve if allowance sufficient
      [Step.APPROVE_OUT]: [Step.CREATE_STREAM, Step.ERROR],
      [Step.CREATE_STREAM]: [Step.WAIT_INDEXED, Step.ERROR],
      [Step.WAIT_INDEXED]: [Step.DONE, Step.ERROR],
      [Step.DONE]: [], // Terminal state
      [Step.ERROR]: [Step.CONNECT, Step.INPUTS, Step.QUOTE, Step.APPROVE_IN, Step.SWAP, Step.APPROVE_OUT, Step.CREATE_STREAM], // Recovery transitions
    }

    const allowed = validTransitions[from] || []
    if (!allowed.includes(to)) {
      return {
        valid: false,
        error: `Invalid transition from ${from} to ${to}`,
      }
    }

    return { valid: true }
  }

  // Determine next step based on current state and conditions
  determineNextStep(): Step | null {
    const state = this.state

    switch (state.step) {
      case Step.CONNECT:
        return state.walletAddress ? Step.INPUTS : null

      case Step.INPUTS:
        return state.tokenIn && state.tokenOut && state.amountIn ? Step.QUOTE : null

      case Step.QUOTE:
        if (!state.quote) return null
        // Check if quote is stale
        if (!this.isQuoteValid(state.quote)) {
          return Step.QUOTE // Force re-quote
        }
        // Check if approval needed
        if (state.approvals?.tokenIn.approved) {
          return Step.SWAP // Skip approval
        }
        return Step.APPROVE_IN

      case Step.APPROVE_IN:
        if (state.approvalInTxHash) {
          return Step.SWAP
        }
        return null

      case Step.SWAP:
        if (state.swapTxHash && state.amountOutReceived) {
          // Check if approval needed for stream contract
          // Note: This check happens after swap confirmation, so allowance should be updated
          if (state.approvals?.tokenOut.approved) {
            return Step.CREATE_STREAM // Skip approval
          }
          return Step.APPROVE_OUT
        }
        return null

      case Step.APPROVE_OUT:
        if (state.approvalOutTxHash) {
          return Step.CREATE_STREAM
        }
        return null

      case Step.CREATE_STREAM:
        if (state.streamTxHash) {
          return Step.WAIT_INDEXED
        }
        return null

      case Step.WAIT_INDEXED:
        if (state.indexedStatus.indexed && state.streamId) {
          return Step.DONE
        }
        return null

      case Step.DONE:
        return null // Terminal

      case Step.ERROR:
        // Recovery logic - determine where to resume
        return this.determineRecoveryStep()

      default:
        return null
    }
  }

  // Check if quote is still valid
  private isQuoteValid(quote: any): boolean {
    if (!quote || !quote.expiry) return false
    return Date.now() < quote.expiry
  }

  // Determine recovery step after error (public for recovery actions)
  determineRecoveryStep(): Step {
    const state = this.state

    // If swap succeeded but stream failed → allow retry create stream
    if (state.swapTxHash && !state.streamTxHash && state.amountOutReceived) {
      // Swap completed successfully, can retry stream creation
      if (state.approvals?.tokenOut.approved) {
        return Step.CREATE_STREAM
      }
      return Step.APPROVE_OUT
    }

    // If swap succeeded but approval failed → retry approval
    if (state.swapTxHash && state.amountOutReceived && !state.approvals?.tokenOut.approved) {
      return Step.APPROVE_OUT
    }

    // If quote exists but stale → re-quote
    if (state.quote && !this.isQuoteValid(state.quote)) {
      return Step.QUOTE
    }

    // If approval failed but we have quote → retry approval
    if (state.quote && state.step === Step.APPROVE_IN && !state.approvalInTxHash) {
      return Step.APPROVE_IN
    }

    if (state.quote && state.step === Step.APPROVE_OUT && !state.approvalOutTxHash) {
      return Step.APPROVE_OUT
    }

    // If we have swap hash but no amount received → wait for swap confirmation
    if (state.swapTxHash && !state.amountOutReceived) {
      return Step.SWAP
    }

    // Otherwise resume from current step or go back to a safe step
    // If we're at an error step, try to go back to the last successful step
    if (state.step === Step.ERROR) {
      // Try to determine safest resume point
      if (state.streamTxHash) {
        return Step.WAIT_INDEXED
      }
      if (state.swapTxHash) {
        return state.approvals?.tokenOut.approved ? Step.CREATE_STREAM : Step.APPROVE_OUT
      }
      if (state.quote) {
        return state.approvals?.tokenIn.approved ? Step.SWAP : Step.APPROVE_IN
      }
      return Step.QUOTE
    }

    return state.step
  }

  // Auto-advance to next step if conditions are met
  autoAdvance(): TransitionResult {
    const nextStep = this.determineNextStep()
    if (nextStep) {
      return this.transitionTo(nextStep)
    }
    return { success: false, error: 'No valid next step' }
  }

  // Clear state (for reset/start over)
  reset(): void {
    this.state = this.getInitialState()
    this.persistState()
  }

  // Clear persisted state
  clearPersisted(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear persisted state:', error)
    }
  }
}
