// Wait API endpoint
// Polls Postgres until StreamCreated event is found for given txHash

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const txHash = searchParams.get('txHash')
    const timeout = parseInt(searchParams.get('timeout') || '60000') // Default 60s
    const pollInterval = parseInt(searchParams.get('pollInterval') || '2000') // Default 2s

    if (!txHash) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'txHash parameter required' },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    let pollCount = 0

    // Poll until found or timeout
    while (Date.now() - startTime < timeout) {
      pollCount++

      try {
        // Find StreamCreated event with matching transaction hash
        const event = await prisma.event.findFirst({
          where: {
            transactionHash: txHash.toLowerCase(),
            eventType: 'StreamCreated',
          },
          include: {
            stream: true,
          },
        })

        if (event && event.stream) {
          return NextResponse.json({
            success: true,
            streamId: event.stream.id,
            indexedAtBlock: Number(event.blockNumber),
            indexedAt: event.createdAt.toISOString(),
            pollCount, // For debugging
          })
        }

        // Check if transaction exists but event type is different (error case)
        const anyEvent = await prisma.event.findFirst({
          where: {
            transactionHash: txHash.toLowerCase(),
          },
        })

        if (anyEvent && anyEvent.eventType !== 'StreamCreated') {
          return NextResponse.json(
            {
              success: false,
              error: 'NOT_FOUND',
              message: `Transaction found but event type is ${anyEvent.eventType}, not StreamCreated`,
            },
            { status: 404 }
          )
        }
      } catch (dbError) {
        console.error('Database error during poll:', dbError)
        // Continue polling on DB errors
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    // Timeout
    return NextResponse.json(
      {
        success: false,
        error: 'TIMEOUT',
        message: `Transaction not indexed within ${timeout}ms timeout period`,
        pollCount,
      },
      { status: 408 }
    )
  } catch (error) {
    console.error('Error in wait endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to check indexer status',
      },
      { status: 500 }
    )
  }
}
