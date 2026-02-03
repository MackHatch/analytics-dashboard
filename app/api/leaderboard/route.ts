import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
