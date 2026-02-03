import { StreamList } from '@/components/StreamList'
import { prisma } from '@/lib/db'

export default async function StreamsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const where: any = {}

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

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
        All Streams
      </h1>
      <StreamList
        streams={formatted}
        pagination={{
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }}
      />
    </div>
  )
}
