"use client";

import { useEffect, type RefObject } from "react";
import { useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { mainnet, base, arbitrum, optimism, polygon, bsc } from "viem/chains";
import {
  executeSafeEthTransfer,
  executeSafeErc20Transfer,
} from "@rhinestone/deposit-modal";
import type { WithdrawSignParams } from "@rhinestone/deposit-modal";

const VIEM_CHAINS_BY_ID: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  56: bsc,
};

export function EmbeddedWithdrawHandler({
  signRef,
  onAddressChange,
}: {
  signRef: RefObject<((params: WithdrawSignParams) => Promise<{ txHash: Hex }>) | null>;
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
      params: WithdrawSignParams,
    ): Promise<{ txHash: Hex }> => {
      const embeddedWallet = getEmbeddedConnectedWallet(wallets);
      if (!embeddedWallet) {
        throw new Error(
          "No Privy embedded wallet found. Please log in first.",
        );
      }

      const chain = VIEM_CHAINS_BY_ID[params.chainId];
      if (!chain) {
        throw new Error(`Unsupported chain ${params.chainId}`);
      }

      await embeddedWallet.switchChain(params.chainId);
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

      const result = params.isNative
        ? await executeSafeEthTransfer({
            walletClient: privyWalletClient,
            publicClient: privyPublicClient,
            safeAddress: params.safeAddress,
            recipient: params.recipient,
            amount: params.amount,
            chainId: params.chainId,
          })
        : await executeSafeErc20Transfer({
            walletClient: privyWalletClient,
            publicClient: privyPublicClient,
            safeAddress: params.safeAddress,
            tokenAddress: params.tokenAddress,
            recipient: params.recipient,
            amount: params.amount,
            chainId: params.chainId,
          });

      return { txHash: result.txHash };
    };
    return () => {
      signRef.current = null;
    };
  }, [wallets, signRef]);

  return null;
}
