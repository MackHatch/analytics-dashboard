// Reindex script - resets indexer state for current chain/contract
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const chainId = BigInt(process.env.CHAIN_ID)
  const contractAddress = process.env.CONTRACT_ADDRESS.toLowerCase()

  if (!chainId || !contractAddress) {
    console.error('Missing required environment variables: CHAIN_ID, CONTRACT_ADDRESS')
    process.exit(1)
  }

  console.log(`Resetting indexer state for chain ${chainId}, contract ${contractAddress}...`)

  const result = await prisma.indexerState.deleteMany({
    where: {
      chainId,
      contractAddress,
    },
  })

  console.log(`✓ Deleted ${result.count} indexer state record(s)`)
  console.log('Indexer will restart and begin from START_BLOCK')
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
