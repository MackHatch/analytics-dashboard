import { createConfig, http } from '@wagmi/core'
import { sepolia, baseSepolia } from '@wagmi/core/chains'
import { injected, metaMask } from '@wagmi/connectors'

// Anvil local chain configuration
const anvil = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
} as const

// Configure chains
const chains = [sepolia, baseSepolia, anvil] as const

// Create wagmi config
export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [anvil.id]: http(),
  },
})
