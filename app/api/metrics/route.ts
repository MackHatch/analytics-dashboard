import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
