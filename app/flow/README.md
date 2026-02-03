# Swap-to-Stream Flow

This module implements a complete swap-to-stream flow that allows users to swap tokens and create a streaming payment in one seamless process.

## Architecture

### Directory Structure

```
app/flow/
├── swap-stream/          # Main flow page route
├── components/           # React components for flow UI
└── lib/
    ├── runtime/         # State machine and flow logic
    │   ├── types.ts     # FlowState, Step enum, etc.
    │   └── FlowRuntime.ts # State machine implementation
    └── adapters/        # External service adapters
        ├── chain/       # Wallet, ERC20, transactions
        ├── dex/         # DEX quoting and swapping
        ├── stream/      # Stream creation
        └── indexer/     # Indexer API integration
```

## Modules

### Flow Runtime (`lib/runtime/`)

**Single Responsibility**: State machine + transitions

- Manages flow state (Step, FlowState)
- Handles state persistence (localStorage)
- Validates transitions
- Resumes at safe step on page load

**Key Features**:
- State persistence across page refreshes
- Smart resume logic (e.g., if stream tx exists but not indexed → resume at WAIT_INDEXED)
- Transition validation

### Chain Adapter (`lib/adapters/chain/`)

**Single Responsibility**: Wallet, ERC20 reads, transaction sending

**Operations**:
- `connectWallet()` - Connect wallet
- `switchChain()` - Switch to correct chain
- `getTokenBalance()` - Read ERC20 balance
- `getAllowance()` - Read ERC20 allowance
- `approve()` - Send approval transaction
- `sendTransaction()` - Send generic transaction
- `waitForTransaction()` - Wait for confirmation

### DEX Adapter (`lib/adapters/dex/`)

**Single Responsibility**: Quote generation and swap execution

**Operations**:
- `getQuote()` - Generate swap quote
- `executeSwap()` - Execute swap transaction
- `simulateSwap()` - Simulate swap (optional)
- `isQuoteValid()` - Check quote expiry

### Stream Adapter (`lib/adapters/stream/`)

**Single Responsibility**: Simulate, create, and parse stream transactions

**Operations**:
- `simulateCreateStream()` - Simulate stream creation
- `sendCreateStream()` - Send stream creation transaction
- `parseStreamCreatedEvent()` - Parse event from receipt

### Indexer Adapter (`lib/adapters/indexer/`)

**Single Responsibility**: Call indexer API wait endpoint

**Operations**:
- `waitForIndexed()` - Poll until transaction indexed
- `checkIndexed()` - Single check without polling

## Flow Steps

1. **CONNECT** - Connect wallet
2. **INPUTS** - Select tokens and enter amount
3. **QUOTE** - Get DEX quote
4. **APPROVE_IN** - Approve tokenIn for DEX (if needed)
5. **SWAP** - Execute swap
6. **APPROVE_OUT** - Approve tokenOut for stream contract (if needed)
7. **CREATE_STREAM** - Create stream with swapped tokens
8. **WAIT_INDEXED** - Wait for indexer to process stream
9. **DONE** - Flow complete
10. **ERROR** - Error state with recovery options

## State Persistence

Flow state is persisted to `localStorage` after every transition. On page load, the flow resumes at the safest step:

- If stream tx exists but not indexed → resume at WAIT_INDEXED
- If swap tx exists but stream tx doesn't → resume at APPROVE_OUT or CREATE_STREAM
- Otherwise resume at current step

## API Endpoints

### `GET /api/wait?txHash=...`

Polls Postgres until StreamCreated event is found for the given transaction hash.

**Query Parameters**:
- `txHash` (required) - Transaction hash to wait for
- `timeout` (optional) - Timeout in milliseconds (default: 30000)

**Response**:
```json
{
  "success": true,
  "streamId": "123...",
  "indexedAtBlock": 12345678,
  "indexedAt": "2024-01-01T00:00:00Z"
}
```

## Implementation Status

### Phase 1: ✅ Complete
- Directory structure created
- Placeholder functions with TODOs
- Type definitions
- Basic state machine

### Phase 2: ✅ Complete
- ✅ Enhanced FlowRuntime with transition rules and validation
- ✅ Step transition logic (skip approvals, handle stale quotes, recovery)
- ✅ Stepper progress header component
- ✅ Action card component for current step CTA
- ✅ Debug panel component showing current state
- ✅ Integrated components into swap-stream page
- ✅ Mocked actions for testing flow
- ✅ State persistence with BigInt serialization

### Phase 3: ✅ Complete
- Real wallet connection using wagmi
- ERC20 balance and allowance reading
- Approval transactions with lifecycle tracking
- Transaction status UI with explorer links

### Phase 4: ✅ Complete
- Uniswap V2 DEX adapter implementation
- Real quote generation from on-chain pool reserves
- Quote validation and staleness checking
- Quote UI with expectedOut, minOut, slippage, warnings
- Support for ETH and ERC20 token swaps

### Phase 5: ✅ Complete
- Real swap execution using DEX adapter
- Balance snapshot before/after swap to compute actual received amount
- Swap validation (allowance check, quote staleness check)
- Optional swap simulation before execution
- Automatic flow transition based on allowance status

### Phase 6: ✅ Complete
- Real stream creation using StreamingPayments contract
- Stream simulation before creation (catches revert reasons)
- StreamCreated event parsing from receipt
- Stream creation UI with recipient input
- Support for ERC20 and ETH streams

### Phase 7: ✅ Complete
- Enhanced /api/wait endpoint with better error handling
- Real indexer adapter with API polling
- WAIT_INDEXED step with automatic polling
- Timeout handling and error recovery UI
- Navigation to stream detail page on success
- Unique feature: bridges on-chain → indexer → dashboard

### Phase 8: ✅ Complete
- Enhanced recovery logic in FlowRuntime with comprehensive recovery step determination
- Smart retry logic that handles different failure scenarios
- Recovery UI with context-aware messages for:
  - Swap succeeded but stream creation failed
  - Stream created but indexing failed
  - Quote expired
  - Approval failed
- Transaction failure handling with automatic error state
- Refresh mid-flow recovery (already working via localStorage)
- Partial approvals skip logic (already working)
- DEX quote expiry check before swap (already implemented)

## Next Steps

1. Implement Phase 2: Build UX and state machine with mocked actions
2. Implement Phase 3: Real wallet + ERC20 interactions
3. Implement Phase 4: DEX quoting
4. Implement Phase 5: Execute swap
5. Implement Phase 6: Create stream
6. Implement Phase 7: Wait for indexing
7. Implement Phase 8: Failure recovery
