// Event processor - handles decoding and database writes

import { PrismaClient } from '@prisma/client'
import { Log } from 'viem'
import { decodeEvent } from './decoder'
import { DecodedEvent, StreamCreatedArgs, WithdrawnArgs, CanceledArgs, TransferredArgs } from './types'

interface IndexerConfig {
  CHAIN_ID: bigint
  CONTRACT_ADDRESS: string
}

interface LogWithTimestamp extends Log {
  _timestamp?: number
}

export async function processEvents(
  prisma: PrismaClient,
  config: IndexerConfig,
  logs: LogWithTimestamp[]
) {
  for (const log of logs) {
    try {
      // Decode event
      const decoded = decodeEvent(log)
      if (!decoded) continue

      // Use timestamp from log if available, otherwise use decoded timestamp
      const timestamp = log._timestamp || decoded.timestamp || 0

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
          args: decoded.args as any,
          timestamp: BigInt(timestamp),
        },
        update: {}, // No-op if exists
      })

      // Process event type-specific logic
      switch (decoded.eventName) {
        case 'StreamCreated':
          await handleStreamCreated(prisma, config, decoded)
          break
        case 'Withdrawn':
          await handleWithdrawn(prisma, config, decoded, eventId, timestamp)
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
  eventId: string,
  timestamp: number
) {
  const args = decoded.args as WithdrawnArgs
  
  // Check if withdrawal already exists (idempotent)
  const existingWithdrawal = await prisma.withdrawal.findUnique({
    where: { eventId },
  })

  if (!existingWithdrawal) {
    // Create withdrawal record first
    await prisma.withdrawal.create({
      data: {
        chainId: config.CHAIN_ID,
        contractAddress: config.CONTRACT_ADDRESS.toLowerCase(),
        streamId: args.streamId.toString(),
        recipient: args.recipient.toLowerCase(),
        amount: BigInt(args.amount),
        eventId,
        blockNumber: BigInt(decoded.blockNumber),
        timestamp: BigInt(timestamp),
      },
    })
  }

  // Update stream withdrawn amount (sum all withdrawals)
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
