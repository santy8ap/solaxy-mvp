"use client";
import type { DiscoveredWallet, Eip1193Provider } from "./types";

/**
 * Descubre las wallets instaladas en el navegador (EIP-6963). Trust Wallet se
 * anuncia como "com.trustwallet.app" y MetaMask como "io.metamask".
 */
let wallets: DiscoveredWallet[] = [];
const listeners = new Set<() => void>();
let started = false;

interface AnnounceEvent extends Event {
  detail: { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider };
}

function add(w: DiscoveredWallet) {
  if (wallets.some((x) => x.rdns === w.rdns || x.uuid === w.uuid)) return;
  // Trust Wallet primero: es la wallet principal de la demo.
  wallets = [...wallets, w].sort((a, b) => Number(b.rdns.includes("trustwallet")) - Number(a.rdns.includes("trustwallet")));
  for (const l of listeners) l();
}

export function startDiscovery() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", (e) => {
    const { info, provider } = (e as AnnounceEvent).detail;
    add({ uuid: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider });
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  // Wallets antiguas que solo exponen window.ethereum.
  setTimeout(() => {
    const eth = (window as unknown as { ethereum?: Eip1193Provider & { isTrust?: boolean; isTrustWallet?: boolean; isMetaMask?: boolean } }).ethereum;
    if (wallets.length === 0 && eth) {
      const name = eth.isTrust || eth.isTrustWallet ? "Trust Wallet" : eth.isMetaMask ? "MetaMask" : "Wallet del navegador";
      add({ uuid: "legacy", name, icon: "", rdns: "legacy.injected", provider: eth });
    }
  }, 400);
}

export function getWallets() {
  return wallets;
}

export function subscribeWallets(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
