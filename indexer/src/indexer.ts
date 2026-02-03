// Main indexer worker loop

import { PrismaClient } from '@prisma/client'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { processEvents } from './processor'
import { IndexerConfig } from './types'

const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
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

  // Validate config
  if (!config.RPC_URL || !config.CONTRACT_ADDRESS) {
    console.error('Missing required environment variables: RPC_URL, CHAIN_ID, CONTRACT_ADDRESS')
    process.exit(1)
  }

  console.log('Starting indexer with config:', {
    CHAIN_ID: config.CHAIN_ID.toString(),
    CONTRACT_ADDRESS: config.CONTRACT_ADDRESS,
    START_BLOCK: config.START_BLOCK.toString(),
    CONFIRMATIONS: config.CONFIRMATIONS,
    CHUNK_SIZE: config.CHUNK_SIZE,
  })

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
    const startBlock = config.START_BLOCK > 0n ? config.START_BLOCK - 1n : 0n
    indexerState = await prisma.indexerState.create({
      data: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        lastProcessedBlock: startBlock,
      },
    })
    console.log(`Created new indexer state starting at block ${startBlock}`)
  } else {
    console.log(`Resuming from block ${indexerState.lastProcessedBlock}`)
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
        console.log(`Found ${logs.length} events in blocks ${fromBlock}-${toBlock}`)
        
        // Fetch block timestamps for events
        const blockNumbers = [...new Set(logs.map(log => log.blockNumber!))]
        const blocks = await Promise.all(
          blockNumbers.map(blockNum => client.getBlock({ blockNumber: blockNum }))
        )
        const blockTimestampMap = new Map(
          blocks.map(b => [Number(b.number), Number(b.timestamp)])
        )

        // Update timestamps in decoded events
        const logsWithTimestamps = logs.map(log => ({
          ...log,
          _timestamp: blockTimestampMap.get(Number(log.blockNumber!)) || 0,
        }))

        await processEvents(prisma, {
          CHAIN_ID: config.CHAIN_ID,
          CONTRACT_ADDRESS: config.CONTRACT_ADDRESS,
        }, logsWithTimestamps as any)
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

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
