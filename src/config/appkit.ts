import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
	type AppKitNetwork,
	arbitrum,
	arbitrumSepolia,
	base,
	baseSepolia,
	mainnet,
	optimism,
	optimismSepolia,
	sepolia,
} from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/vue";

const appBaseUrl = import.meta.env.VITE_PUBLIC_APP_BASE_URL;
if (!appBaseUrl) {
	throw new Error("VITE_PUBLIC_APP_BASE_URL is not set");
}

// 1. Get projectId from https://dashboard.reown.com
const projectId = import.meta.env.VITE_PUBLIC_REOWN_PROJECT_ID;
if (!projectId) {
	throw new Error("VITE_PUBLIC_REOWN_PROJECT_ID is not set");
}

// 2. Create a metadata object
const metadata = {
	name: "Deposit Widget Demo",
	description:
		"Demo Application that shows Rhinestone Deposit Widget in action",
	url: appBaseUrl,
	icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// 3. Set the networks
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
	mainnet,
	arbitrum,
	base,
	optimism,
	sepolia,
	arbitrumSepolia,
	baseSepolia,
	optimismSepolia,
];

// 4. Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
	networks,
	projectId,
});

// Export the Wagmi config for use in other components
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// 5. Create the modal
createAppKit({
	adapters: [wagmiAdapter],
	networks,
	projectId,
	metadata,
	features: {
		analytics: false,
	},
});
