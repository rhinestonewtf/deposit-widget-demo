"use client";

import { useEffect, type RefObject } from "react";
import { useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import {
  createWalletClient,
  createPublicClient,
  custom,
  hexToBytes,
  http,
  toHex,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { mainnet, base, arbitrum, optimism, polygon, bsc } from "viem/chains";
import type { SafeTransactionRequest } from "@rhinestone/deposit-modal";

const VIEM_CHAINS_BY_ID: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  56: bsc,
};

const EXEC_TRANSACTION_ABI = [
  {
    type: "function",
    name: "execTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

export function EmbeddedWithdrawHandler({
  signRef,
  onAddressChange,
}: {
  signRef: RefObject<
    ((request: SafeTransactionRequest) => Promise<{ txHash: Hex }>) | null
  >;
  onAddressChange?: (address: Address | null) => void;
}) {
  const { wallets } = useWallets();

  useEffect(() => {
    const embeddedWallet = getEmbeddedConnectedWallet(wallets);
    onAddressChange?.((embeddedWallet?.address as Address | undefined) ?? null);
  }, [wallets, onAddressChange]);

  useEffect(
    () => () => {
      onAddressChange?.(null);
    },
    [onAddressChange],
  );

  useEffect(() => {
    signRef.current = async (
      request: SafeTransactionRequest,
    ): Promise<{ txHash: Hex }> => {
      const embeddedWallet = getEmbeddedConnectedWallet(wallets);
      if (!embeddedWallet) {
        throw new Error("No Privy embedded wallet found. Please log in first.");
      }

      const chain = VIEM_CHAINS_BY_ID[request.chainId];
      if (!chain) {
        throw new Error(`Unsupported chain ${request.chainId}`);
      }

      await embeddedWallet.switchChain(request.chainId);
      const provider = await embeddedWallet.getEthereumProvider();

      const privyWalletClient = createWalletClient({
        account: embeddedWallet.address as Address,
        chain,
        transport: custom(provider),
      });

      const privyPublicClient = createPublicClient({
        chain,
        transport: http(),
      });

      console.log(
        "[withdraw] signing safeTxHash via raw provider.request (personal_sign)",
      );
      console.log("[withdraw] safeTxHash:", request.safeTxHash);
      console.log("[withdraw] signer:", embeddedWallet.address);

      // Call personal_sign directly on the provider to bypass Privy's
      // SignRequestScreen UI, which crashes after signing completes.
      const rawSignature = (await provider.request({
        method: "personal_sign",
        params: [request.safeTxHash, embeddedWallet.address],
      })) as Hex;

      console.log("[withdraw] got signature:", rawSignature);

      // Adjust v by +4 for Safe's eth_sign verification path.
      // Safe checks v > 30 and verifies via
      // keccak256("\x19Ethereum Signed Message:\n32" + hash).
      const sigBytes = hexToBytes(rawSignature);
      sigBytes[64] += 4;
      const signature = toHex(sigBytes);

      console.log("[withdraw] adjusted signature (v+4):", signature);

      // Submit execTransaction on-chain (integrators would use a relayer here)
      const { message } = request.typedData;
      console.log(
        "[withdraw] submitting execTransaction to Safe:",
        request.safeAddress,
      );

      const txHash = await privyWalletClient.writeContract({
        chain,
        address: request.safeAddress,
        abi: EXEC_TRANSACTION_ABI,
        functionName: "execTransaction",
        args: [
          message.to,
          message.value,
          message.data,
          message.operation,
          message.safeTxGas,
          message.baseGas,
          message.gasPrice,
          message.gasToken,
          message.refundReceiver,
          signature,
        ],
      });

      console.log("[withdraw] execTransaction txHash:", txHash);

      await privyPublicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("[withdraw] transaction confirmed");

      return { txHash };
    };
    return () => {
      signRef.current = null;
    };
  }, [wallets, signRef]);

  return null;
}
