# Streaming Payments Analytics Dashboard - Implementation Plan

## Overview
Index blockchain events from StreamingPayments contract into Postgres, then build a Next.js dashboard to visualize and analyze the data.

---

## 1. Data Model (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Track indexing progress per chain + contract
model IndexerState {
  id                String   @id @default(cuid())
  chainId          BigInt   // e.g., 11155111 (Sepolia)
  contractAddress  String   // Contract address (lowercase)
  lastProcessedBlock BigInt // Last block successfully processed
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([chainId, contractAddress])
  @@index([chainId, contractAddress])
}

// Normalized stream state (derived from events)
model Stream {
  id              String   @id // streamId as hex string
  chainId         BigInt
  contractAddress String
  
  // Stream properties
  sender          String   // address
  recipient       String   // address
  token           String   // token address (or NATIVE_TOKEN constant)
  start           BigInt   // timestamp
  end             BigInt   // timestamp
  cliff           BigInt   // timestamp (0 if no cliff)
  amount          BigInt   // total amount in wei
  withdrawn       BigInt   // total withdrawn so far
  canceled        Boolean  @default(false)
  refundable      Boolean
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  events          Event[]
  withdrawals     Withdrawal[]

  @@unique([chainId, contractAddress, id])
  @@index([sender])
  @@index([recipient])
  @@index([token])
  @@index([chainId, contractAddress])
}

// Raw decoded events (immutable log)
model Event {
  id              String   @id // txHash:logIndex (unique identifier)
  chainId         BigInt
  contractAddress String
  streamId        String?  // nullable (FeeUpdated has no streamId)
  
  // Block data
  blockNumber     BigInt
  blockHash       String
  transactionHash String
  logIndex        Int
  transactionIndex Int
  
  // Event data
  eventType       String   // "StreamCreated" | "Withdrawn" | "Canceled" | "Transferred" | "FeeUpdated"
  args            Json     // Decoded event args as JSON
  
  // Timestamps
  timestamp       BigInt   // block timestamp
  createdAt       DateTime @default(now())
  
  // Relations
  stream          Stream?  @relation(fields: [chainId, contractAddress, streamId], references: [chainId, contractAddress, id])

  @@unique([chainId, contractAddress, transactionHash, logIndex])
  @@index([streamId])
  @@index([blockNumber])
  @@index([eventType])
  @@index([chainId, contractAddress])
}

// Withdrawal records (for analytics)
model Withdrawal {
  id              String   @id @default(cuid())
  chainId         BigInt
  contractAddress String
  streamId        String
  
  // Withdrawal data
  recipient       String   // address
  amount          BigInt   // amount withdrawn (including fees)
  eventId         String   // Reference to Event.id
  
  // Timestamps
  blockNumber     BigInt
  timestamp       BigInt
  createdAt       DateTime @default(now())
  
  // Relations
  stream          Stream   @relation(fields: [chainId, contractAddress, streamId], references: [chainId, contractAddress, id])
  event           Event    @relation(fields: [eventId], references: [id])

  @@index([streamId])
  @@index([recipient])
  @@index([timestamp])
  @@index([chainId, contractAddress])
}
```

---

## 2. Indexer Worker Architecture

### File Structure
```
analytics-dashboard/
├── indexer/
│   ├── src/
│   │   ├── indexer.ts          # Main worker loop
│   │   ├── rpc.ts              # RPC client utilities
│   │   ├── decoder.ts          # Event decoding logic
│   │   ├── processor.ts        # Event processing & DB writes
│   │   └── types.ts            # TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── .env.example
```

### Pseudocode: Main Indexer Loop

```typescript
// indexer/src/indexer.ts

import { PrismaClient } from '@prisma/client'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { decodeLogs, processEvents } from './processor'

const prisma = new PrismaClient()

interface IndexerConfig {
  RPC_URL: string
  CHAIN_ID: bigint
  CONTRACT_ADDRESS: `0x${string}`
  START_BLOCK: bigint
  CONFIRMATIONS: number
  CHUNK_SIZE: number
  POLL_INTERVAL_MS: number
}

async function main() {
  // Load config from env
  const config: IndexerConfig = {
    RPC_URL: process.env.RPC_URL!,
    CHAIN_ID: BigInt(process.env.CHAIN_ID!),
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS as `0x${string}`,
    START_BLOCK: BigInt(process.env.START_BLOCK || '0'),
    CONFIRMATIONS: parseInt(process.env.CONFIRMATIONS || '12'),
    CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE || '1000'),
    POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
  }

  // Initialize RPC client
  const client = createPublicClient({
    transport: http(config.RPC_URL),
  })

  // Get or create IndexerState
  let indexerState = await prisma.indexerState.findUnique({
    where: {
      chainId_contractAddress: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
      },
    },
  })

  if (!indexerState) {
    indexerState = await prisma.indexerState.create({
      data: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        lastProcessedBlock: config.START_BLOCK - 1n,
      },
    })
  }

  // Main loop
  while (true) {
    try {
      // Get latest block
      const latestBlock = await client.getBlockNumber()
      const targetBlock = latestBlock - BigInt(config.CONFIRMATIONS)

      // Check if we need to process
      if (indexerState.lastProcessedBlock >= targetBlock) {
        console.log(`Up to date. Latest: ${latestBlock}, Target: ${targetBlock}, Last: ${indexerState.lastProcessedBlock}`)
        await sleep(config.POLL_INTERVAL_MS)
        continue
      }

      // Process in chunks
      let fromBlock = indexerState.lastProcessedBlock + 1n
      const toBlock = min(fromBlock + BigInt(config.CHUNK_SIZE) - 1n, targetBlock)

      console.log(`Processing blocks ${fromBlock} to ${toBlock}`)

      // Get logs for all events
      const logs = await client.getLogs({
        address: config.CONTRACT_ADDRESS,
        fromBlock,
        toBlock,
        events: [
          parseAbiItem('event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, address token, uint256 amount, uint256 start, uint256 end, uint256 cliff)'),
          parseAbiItem('event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount)'),
          parseAbiItem('event Canceled(uint256 indexed streamId, address indexed sender, bool refunded)'),
          parseAbiItem('event Transferred(uint256 indexed streamId, address indexed previousRecipient, address indexed newRecipient)'),
          parseAbiItem('event FeeUpdated(address indexed feeRecipient, uint256 feeRate)'),
        ],
      })

      // Decode and process events
      if (logs.length > 0) {
        await processEvents(prisma, config, logs)
      }

      // Update indexer state
      indexerState = await prisma.indexerState.update({
        where: { id: indexerState.id },
        data: { lastProcessedBlock: toBlock },
      })

      console.log(`Processed ${logs.length} events, updated to block ${toBlock}`)

    } catch (error) {
      console.error('Indexer error:', error)
      await sleep(config.POLL_INTERVAL_MS)
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

main().catch(console.error)
```

### Pseudocode: Event Processor

```typescript
// indexer/src/processor.ts

import { PrismaClient } from '@prisma/client'
import { Log } from 'viem'
import { decodeEvent } from './decoder'

interface IndexerConfig {
  CHAIN_ID: bigint
  CONTRACT_ADDRESS: string
}

export async function processEvents(
  prisma: PrismaClient,
  config: IndexerConfig,
  logs: Log[]
) {
  for (const log of logs) {
    try {
      // Decode event
      const decoded = decodeEvent(log)
      if (!decoded) continue

      // Create unique event ID: txHash:logIndex
      const eventId = `${log.transactionHash}:${log.logIndex}`

      // Upsert event (idempotent)
      await prisma.event.upsert({
        where: {
          chainId_contractAddress_transactionHash_logIndex: {
            chainId: config.CHAIN_ID,
            contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
          },
        },
        create: {
          id: eventId,
          chainId: config.CHAIN_ID,
          contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
          streamId: decoded.streamId || null,
          blockNumber: BigInt(log.blockNumber!),
          blockHash: log.blockHash!,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
          transactionIndex: log.transactionIndex!,
          eventType: decoded.eventName,
          args: decoded.args,
          timestamp: decoded.timestamp,
        },
        update: {}, // No-op if exists
      })

      // Process event type-specific logic
      switch (decoded.eventName) {
        case 'StreamCreated':
          await handleStreamCreated(prisma, config, decoded)
          break
        case 'Withdrawn':
          await handleWithdrawn(prisma, config, decoded, eventId)
          break
        case 'Canceled':
          await handleCanceled(prisma, config, decoded)
          break
        case 'Transferred':
          await handleTransferred(prisma, config, decoded)
          break
        case 'FeeUpdated':
          // No stream update needed
          break
      }
    } catch (error) {
      console.error(`Error processing log ${log.transactionHash}:${log.logIndex}:`, error)
      // Continue processing other events
    }
  }
}

async function handleStreamCreated(
  prisma: PrismaClient,
  config: IndexerConfig,
  decoded: DecodedEvent
) {
  const args = decoded.args as StreamCreatedArgs
  
  await prisma.stream.upsert({
    where: {
      chainId_contractAddress_id: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        id: args.streamId.toString(),
      },
    },
    create: {
      id: args.streamId.toString(),
      chainId: config.CHAIN_ID,
      contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
      sender: args.sender.toLowerCase(),
      recipient: args.recipient.toLowerCase(),
      token: args.token.toLowerCase(),
      start: BigInt(args.start),
      end: BigInt(args.end),
      cliff: BigInt(args.cliff),
      amount: BigInt(args.amount),
      withdrawn: 0n,
      canceled: false,
      refundable: false, // Not in event, will update from contract if needed
    },
    update: {
      // Update if stream already exists (shouldn't happen, but idempotent)
      sender: args.sender.toLowerCase(),
      recipient: args.recipient.toLowerCase(),
      token: args.token.toLowerCase(),
      start: BigInt(args.start),
      end: BigInt(args.end),
      cliff: BigInt(args.cliff),
      amount: BigInt(args.amount),
    },
  })
}

async function handleWithdrawn(
  prisma: PrismaClient,
  config: IndexerConfig,
  decoded: DecodedEvent,
  eventId: string
) {
  const args = decoded.args as WithdrawnArgs
  
  // Update stream withdrawn amount
  const stream = await prisma.stream.findUnique({
    where: {
      chainId_contractAddress_id: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        id: args.streamId.toString(),
      },
    },
  })

  if (stream) {
    // Calculate new withdrawn total (sum all withdrawals)
    const totalWithdrawn = await prisma.withdrawal.aggregate({
      where: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        streamId: args.streamId.toString(),
      },
      _sum: { amount: true },
    })

    await prisma.stream.update({
      where: {
        chainId_contractAddress_id: {
          chainId: config.CHAIN_ID,
          contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
          id: args.streamId.toString(),
        },
      },
      data: {
        withdrawn: totalWithdrawn._sum.amount || 0n,
      },
    })
  }

  // Create withdrawal record
  await prisma.withdrawal.create({
    data: {
      chainId: config.CHAIN_ID,
      contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
      streamId: args.streamId.toString(),
      recipient: args.recipient.toLowerCase(),
      amount: BigInt(args.amount),
      eventId,
      blockNumber: BigInt(decoded.blockNumber),
      timestamp: BigInt(decoded.timestamp),
    },
  })
}

async function handleCanceled(
  prisma: PrismaClient,
  config: IndexerConfig,
  decoded: DecodedEvent
) {
  const args = decoded.args as CanceledArgs
  
  await prisma.stream.update({
    where: {
      chainId_contractAddress_id: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        id: args.streamId.toString(),
      },
    },
    data: {
      canceled: true,
    },
  })
}

async function handleTransferred(
  prisma: PrismaClient,
  config: IndexerConfig,
  decoded: DecodedEvent
) {
  const args = decoded.args as TransferredArgs
  
  await prisma.stream.update({
    where: {
      chainId_contractAddress_id: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        id: args.streamId.toString(),
      },
    },
    data: {
      recipient: args.newRecipient.toLowerCase(),
    },
  })
}
```

### Pseudocode: Event Decoder

```typescript
// indexer/src/decoder.ts

import { Log, decodeEventLog } from 'viem'
import StreamingPaymentsABI from '../abis/StreamingPayments.json'

export interface DecodedEvent {
  eventName: string
  args: any
  streamId?: string
  blockNumber: number
  timestamp: number
}

export function decodeEvent(log: Log): DecodedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: StreamingPaymentsABI,
      data: log.data,
      topics: log.topics,
    })

    // Extract streamId from indexed topics if present
    let streamId: string | undefined
    if (decoded.args.streamId) {
      streamId = decoded.args.streamId.toString()
    }

    return {
      eventName: decoded.eventName,
      args: decoded.args,
      streamId,
      blockNumber: Number(log.blockNumber!),
      timestamp: 0, // Will fetch from block if needed
    }
  } catch (error) {
    console.error('Failed to decode event:', error)
    return null
  }
}
```

---

## 3. Next.js Dashboard Structure

### File Structure
```
analytics-dashboard/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                    # Dashboard overview
│   │   ├── streams/
│   │   │   ├── page.tsx                # Stream list
│   │   │   └── [streamId]/
│   │   │       └── page.tsx            # Stream detail
│   │   └── layout.tsx                   # Dashboard layout
│   ├── api/
│   │   ├── metrics/
│   │   │   └── route.ts                # GET /api/metrics
│   │   ├── streams/
│   │   │   └── route.ts                # GET /api/streams
│   │   └── leaderboard/
│   │       └── route.ts                # GET /api/leaderboard
│   ├── components/
│   │   ├── StreamCard.tsx
│   │   ├── StreamList.tsx
│   │   ├── MetricsCard.tsx
│   │   └── LeaderboardTable.tsx
│   ├── lib/
│   │   └── db.ts                       # Prisma client
│   └── page.tsx                         # Home/redirect
├── prisma/
└── package.json
```

### Pseudocode: API Routes

```typescript
// app/api/metrics/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chainId = searchParams.get('chainId')
  const contractAddress = searchParams.get('contractAddress')

  // Build where clause
  const where: any = {}
  if (chainId) where.chainId = BigInt(chainId)
  if (contractAddress) where.contractAddress = contractAddress.toLowerCase()

  // Total streams
  const totalStreams = await prisma.stream.count({ where })

  // Active streams (not canceled, end > now)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const activeStreams = await prisma.stream.count({
    where: {
      ...where,
      canceled: false,
      end: { gt: now },
    },
  })

  // Total volume (sum of all stream amounts)
  const volumeResult = await prisma.stream.aggregate({
    where,
    _sum: { amount: true },
  })
  const totalVolume = volumeResult._sum.amount || 0n

  // Total withdrawn
  const withdrawnResult = await prisma.stream.aggregate({
    where,
    _sum: { withdrawn: true },
  })
  const totalWithdrawn = withdrawnResult._sum.withdrawn || 0n

  // Unique senders/recipients
  const uniqueSenders = await prisma.stream.findMany({
    where,
    select: { sender: true },
    distinct: ['sender'],
  })
  const uniqueRecipients = await prisma.stream.findMany({
    where,
    select: { recipient: true },
    distinct: ['recipient'],
  })

  // Recent activity (events in last 24h)
  const oneDayAgo = BigInt(Math.floor(Date.now() / 1000) - 86400)
  const recentEvents = await prisma.event.count({
    where: {
      ...where,
      timestamp: { gte: oneDayAgo },
    },
  })

  return NextResponse.json({
    totalStreams,
    activeStreams,
    totalVolume: totalVolume.toString(),
    totalWithdrawn: totalWithdrawn.toString(),
    uniqueSenders: uniqueSenders.length,
    uniqueRecipients: uniqueRecipients.length,
    recentEvents,
  })
}
```

```typescript
// app/api/streams/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chainId = searchParams.get('chainId')
  const contractAddress = searchParams.get('contractAddress')
  const sender = searchParams.get('sender')
  const recipient = searchParams.get('recipient')
  const status = searchParams.get('status') // 'active' | 'completed' | 'canceled'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  // Build where clause
  const where: any = {}
  if (chainId) where.chainId = BigInt(chainId)
  if (contractAddress) where.contractAddress = contractAddress.toLowerCase()
  if (sender) where.sender = sender.toLowerCase()
  if (recipient) where.recipient = recipient.toLowerCase()

  // Status filter
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (status === 'active') {
    where.canceled = false
    where.end = { gt: now }
  } else if (status === 'completed') {
    where.canceled = false
    where.end = { lte: now }
  } else if (status === 'canceled') {
    where.canceled = true
  }

  // Fetch streams
  const [streams, total] = await Promise.all([
    prisma.stream.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { withdrawals: true },
        },
      },
    }),
    prisma.stream.count({ where }),
  ])

  // Format response
  const formatted = streams.map(stream => ({
    id: stream.id,
    chainId: stream.chainId.toString(),
    sender: stream.sender,
    recipient: stream.recipient,
    token: stream.token,
    start: stream.start.toString(),
    end: stream.end.toString(),
    cliff: stream.cliff.toString(),
    amount: stream.amount.toString(),
    withdrawn: stream.withdrawn.toString(),
    canceled: stream.canceled,
    refundable: stream.refundable,
    withdrawalCount: stream._count.withdrawals,
    createdAt: stream.createdAt.toISOString(),
    updatedAt: stream.updatedAt.toISOString(),
  }))

  return NextResponse.json({
    streams: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
```

```typescript
// app/api/leaderboard/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chainId = searchParams.get('chainId')
  const contractAddress = searchParams.get('contractAddress')
  const type = searchParams.get('type') || 'senders' // 'senders' | 'recipients'

  // Build where clause
  const where: any = {}
  if (chainId) where.chainId = BigInt(chainId)
  if (contractAddress) where.contractAddress = contractAddress.toLowerCase()

  if (type === 'senders') {
    // Leaderboard by total sent
    const result = await prisma.stream.groupBy({
      by: ['sender'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    })

    return NextResponse.json(
      result.map(r => ({
        address: r.sender,
        totalAmount: r._sum.amount?.toString() || '0',
        streamCount: r._count.id,
      }))
    )
  } else {
    // Leaderboard by total received (withdrawn)
    const result = await prisma.withdrawal.groupBy({
      by: ['recipient'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    })

    return NextResponse.json(
      result.map(r => ({
        address: r.recipient,
        totalAmount: r._sum.amount?.toString() || '0',
        withdrawalCount: r._count.id,
      }))
    )
  }
}
```

### Pseudocode: Dashboard Pages

```typescript
// app/dashboard/page.tsx

import { MetricsCard } from '@/components/MetricsCard'
import Link from 'next/link'

export default async function DashboardPage() {
  const metrics = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/metrics`, {
    cache: 'no-store',
  }).then(r => r.json())

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Streaming Payments Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricsCard title="Total Streams" value={metrics.totalStreams} />
        <MetricsCard title="Active Streams" value={metrics.activeStreams} />
        <MetricsCard title="Total Volume" value={formatTokenAmount(metrics.totalVolume)} />
        <MetricsCard title="Total Withdrawn" value={formatTokenAmount(metrics.totalWithdrawn)} />
        <MetricsCard title="Unique Senders" value={metrics.uniqueSenders} />
        <MetricsCard title="Unique Recipients" value={metrics.uniqueRecipients} />
      </div>

      <div className="flex gap-4">
        <Link href="/dashboard/streams" className="px-4 py-2 bg-blue-500 text-white rounded">
          View All Streams
        </Link>
      </div>
    </div>
  )
}
```

```typescript
// app/dashboard/streams/page.tsx

import { StreamList } from '@/components/StreamList'

export default async function StreamsPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = parseInt(searchParams.page || '1')
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/streams?page=${page}`,
    { cache: 'no-store' }
  )
  const data = await response.json()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">All Streams</h1>
      <StreamList streams={data.streams} pagination={data.pagination} />
    </div>
  )
}
```

```typescript
// app/dashboard/streams/[streamId]/page.tsx

import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'

export default async function StreamDetailPage({ params }: { params: { streamId: string } }) {
  const stream = await prisma.stream.findUnique({
    where: { id: params.streamId },
    include: {
      events: {
        orderBy: { blockNumber: 'desc' },
        take: 50,
      },
      withdrawals: {
        orderBy: { timestamp: 'desc' },
      },
    },
  })

  if (!stream) {
    notFound()
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Stream #{stream.id}</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="font-semibold">Sender</h2>
          <p className="font-mono text-sm">{stream.sender}</p>
        </div>
        <div>
          <h2 className="font-semibold">Recipient</h2>
          <p className="font-mono text-sm">{stream.recipient}</p>
        </div>
        <div>
          <h2 className="font-semibold">Amount</h2>
          <p>{formatTokenAmount(stream.amount.toString())}</p>
        </div>
        <div>
          <h2 className="font-semibold">Withdrawn</h2>
          <p>{formatTokenAmount(stream.withdrawn.toString())}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Withdrawals</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th>Amount</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {stream.withdrawals.map(w => (
            <tr key={w.id}>
              <td>{formatTokenAmount(w.amount.toString())}</td>
              <td>{new Date(Number(w.timestamp) * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 4. Environment Variables

```bash
# .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/streaming_analytics"

# Indexer
RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
CHAIN_ID=11155111
CONTRACT_ADDRESS="0x..."
START_BLOCK=0
CONFIRMATIONS=12
CHUNK_SIZE=1000
POLL_INTERVAL_MS=5000

# Next.js
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

---

## 5. Implementation Steps

1. **Setup Prisma**
   - Install Prisma: `npm install prisma @prisma/client`
   - Create schema file
   - Run migrations: `npx prisma migrate dev`

2. **Create Indexer**
   - Setup TypeScript project in `indexer/`
   - Install dependencies: viem, @prisma/client
   - Implement indexer loop
   - Test with local Anvil

3. **Build Next.js Dashboard**
   - Create API routes
   - Build dashboard pages
   - Create UI components
   - Add Tailwind styling

4. **Deploy**
   - Deploy indexer as background worker (PM2, systemd, or cloud service)
   - Deploy Next.js app (Vercel, Railway, etc.)
   - Setup database (managed Postgres)

---

## 6. Key Considerations

- **Idempotency**: Event IDs (txHash:logIndex) ensure no duplicate processing
- **Error Handling**: Indexer should continue on individual event errors
- **Performance**: Use chunked processing and database indexes
- **Real-time**: Consider WebSocket subscriptions for live updates (future)
- **Multi-chain**: IndexerState supports multiple chains/contracts
- **Data Integrity**: Use transactions for related updates (stream + withdrawal)
