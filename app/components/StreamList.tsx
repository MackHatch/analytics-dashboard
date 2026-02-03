import { StreamCard } from './StreamCard'

interface Stream {
  id: string
  sender: string
  recipient: string
  token: string
  amount: string
  withdrawn: string
  canceled: boolean
  withdrawalCount: number
  start: string
  end: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface StreamListProps {
  streams: Stream[]
  pagination: Pagination
}

export function StreamList({ streams, pagination }: StreamListProps) {
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Showing {streams.length} of {pagination.total} streams
        </p>
        <div className="flex gap-2">
          {pagination.page > 1 && (
            <a
              href={`/dashboard/streams?page=${pagination.page - 1}`}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Previous
            </a>
          )}
          {pagination.page < pagination.totalPages && (
            <a
              href={`/dashboard/streams?page=${pagination.page + 1}`}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Next
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((stream) => (
          <StreamCard key={stream.id} {...stream} />
        ))}
      </div>

      {streams.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-600 dark:text-zinc-400">
            No streams found
          </p>
        </div>
      )}
    </div>
  )
}
