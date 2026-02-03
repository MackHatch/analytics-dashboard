import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    console.error('Error fetching streams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    )
  }
}
