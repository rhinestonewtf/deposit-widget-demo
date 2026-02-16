"use client";

import { useEffect, type RefObject } from "react";
import { useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { hexToBytes, toHex, type Address, type Hex } from "viem";
import type { SafeTransactionRequest } from "@rhinestone/deposit-modal/safe";

export function EmbeddedWithdrawHandler({
  signRef,
  onAddressChange,
}: {
  signRef: RefObject<
    ((request: SafeTransactionRequest) => Promise<{ signature: Hex }>) | null
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
    ): Promise<{ signature: Hex }> => {
      const embeddedWallet = getEmbeddedConnectedWallet(wallets);
      if (!embeddedWallet) {
        throw new Error("No Privy embedded wallet found. Please log in first.");
      }

      await embeddedWallet.switchChain(request.chainId);
      const provider = await embeddedWallet.getEthereumProvider();

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

      return { signature };
    };
    return () => {
      signRef.current = null;
    };
  }, [wallets, signRef]);

  return null;
}
