# Analytics Dashboard

Analytics dashboard and "Swap to Stream" dApp for Streaming Payments smart contracts.

## Quickstart

Get the entire stack running in exactly 5 commands:

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Edit .env with your RPC URL, chain ID, and contract address
# Required: RPC_URL, CHAIN_ID, CONTRACT_ADDRESS
# Optional: START_BLOCK (defaults to 0)

# 3. Start the stack (Postgres + Indexer + Web)
make up

# 4. Wait for services to be ready (~10 seconds)
docker-compose logs -f

# 5. Open http://localhost:3000
```

That's it! The stack includes:
- **Postgres** database (port 5432)
- **Indexer** worker (processes blockchain events)
- **Web app** (Next.js dashboard + dApp flow)

## Environment Variables

Edit `.env` with your configuration:

```bash
# Required
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111
CONTRACT_ADDRESS=0x1234...

# Optional
START_BLOCK=5000000  # Block where contract was deployed
CONFIRMATIONS=12     # Wait 12 blocks before indexing
CHUNK_SIZE=1000      # Process 1000 blocks at a time
POLL_INTERVAL_MS=5000  # Check for new blocks every 5 seconds
```

## Commands

```bash
# Start stack
make up
# or: npm run stack:up

# Stop stack
make down
# or: npm run stack:down

# Reindex from START_BLOCK (resets indexer state)
make reindex
# or: npm run stack:reindex

# View logs
docker-compose logs -f

# View indexer logs only
docker-compose logs -f indexer

# View web logs only
docker-compose logs -f web
```

## Reindexing

To reset the indexer and reprocess from `START_BLOCK`:

```bash
make reindex
```

This deletes the indexer state for your chain/contract combination and starts fresh from `START_BLOCK`.

## Development

For local development without Docker:

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma migrate dev

# Run indexer (in one terminal)
npm run indexer

# Run web app (in another terminal)
npm run dev
```

## Architecture

- **Postgres**: Stores indexed events, streams, and withdrawals
- **Indexer**: Polls blockchain, decodes events, writes to Postgres
- **Web App**: Next.js dashboard + "Swap to Stream" dApp flow

## Dashboard

- `/dashboard` - Overview metrics
- `/dashboard/streams` - All streams
- `/dashboard/streams/[streamId]` - Stream details
- `/dashboard/leaderboard` - Top senders/recipients
- `/flow/swap-stream` - Swap to Stream dApp flow

## Troubleshooting

**Indexer not processing blocks:**
- Check `docker-compose logs indexer`
- Verify `RPC_URL` is accessible
- Check `CONTRACT_ADDRESS` is correct
- Ensure `START_BLOCK` is set correctly

**Database connection errors:**
- Ensure Postgres is running: `docker-compose ps`
- Check `DATABASE_URL` in `.env`

**Web app not loading:**
- Check `docker-compose logs web`
- Ensure migrations ran: `docker-compose exec web npx prisma migrate status`
