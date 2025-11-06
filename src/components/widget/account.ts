import { RhinestoneSDK } from "@rhinestone/sdk";
import type { Address, Hex } from "viem";
import { privateKeyToAccount, toAccount } from "viem/accounts";

const appBaseUrl = import.meta.env.VITE_PUBLIC_APP_BASE_URL;
if (!appBaseUrl) {
	throw new Error("VITE_PUBLIC_APP_BASE_URL is not set");
}

async function createAccount(ownerAddress: Address, signerPk: Hex) {
	const rhinestone = new RhinestoneSDK({
		endpointUrl: `${appBaseUrl}/api`,
	});

	const ownerAccount = toAccount({
		address: ownerAddress,
		signMessage: async () => {
			throw new Error("Not implemented");
		},
		signTransaction: async () => {
			throw new Error("Not implemented");
		},
		signTypedData: async () => {
			throw new Error("Not implemented");
		},
	});

	const signerAccount = getSignerAccount(signerPk);

	const account = await rhinestone.createAccount({
		owners: {
			type: "ecdsa",
			accounts: [ownerAccount, signerAccount],
		},
	});

	return account;
}

function getSignerAccount(signerPk: Hex) {
	return privateKeyToAccount(signerPk);
}

export { createAccount, getSignerAccount };
