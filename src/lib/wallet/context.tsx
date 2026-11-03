"use client";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatEther, toHex } from "viem";
import { postJson } from "@/lib/client/use-json";
import { demoAccount } from "./demo";
import { startDiscovery } from "./discovery";
import { CHAINS, type DiscoveredWallet, type Eip1193Provider, type WalletKind, type WalletState } from "./types";

const LAST = "solaxy:wallet-ultima";
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

interface WalletApi extends WalletState {
  connectInjected(w: DiscoveredWallet): Promise<void>;
  connectWalletConnect(onUri: (uri: string) => void): Promise<void>;
  connectDemo(): Promise<void>;
  disconnect(): Promise<void>;
  signMessage(message: string): Promise<`0x${string}`>;
  /** Abre el diálogo para elegir wallet */
  openConnect(): void;
  closeConnect(): void;
  connectOpen: boolean;
}

const Ctx = createContext<WalletApi | null>(null);

const initial: WalletState = { status: "disconnected", kind: null, name: null, icon: null, address: null, chainId: null, balance: null, error: null };

function readLast(): { kind: WalletKind; rdns?: string } | null {
  try {
    const raw = window.localStorage.getItem(LAST);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeLast(v: { kind: WalletKind; rdns?: string } | null) {
  try {
    if (v) window.localStorage.setItem(LAST, JSON.stringify(v));
    else window.localStorage.removeItem(LAST);
  } catch {
    /* sin almacenamiento */
  }
}

function friendlyError(err: unknown) {
  const e = err as { code?: number; message?: string };
  if (e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "")) return "Cancelaste la solicitud en la wallet.";
  if (e?.code === -32002) return "Ya hay una solicitud abierta en tu wallet. Revísala.";
  return e?.message?.slice(0, 160) ?? "No se pudo completar la acción en la wallet.";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(initial);
  const [connectOpen, setConnectOpen] = useState(false);
  const providerRef = useRef<Eip1193Provider | null>(null);
  const wcRef = useRef<(Eip1193Provider & { disconnect(): Promise<void>; session?: unknown }) | null>(null);

  const finish = useCallback(async (kind: WalletKind, provider: Eip1193Provider | null, meta: { name: string; icon: string; rdns?: string }, address: `0x${string}`) => {
    let chainId: number | null = null;
    let balance: string | null = null;
    if (provider) {
      try {
        chainId = Number(await provider.request({ method: "eth_chainId" }));
        const wei = (await provider.request({ method: "eth_getBalance", params: [address, "latest"] })) as string;
        balance = `${Number(formatEther(BigInt(wei))).toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${CHAINS[chainId]?.symbol ?? "ETH"}`;
      } catch {
        /* la wallet no reporta saldo: no es crítico */
      }
    }
    providerRef.current = provider;
    setState({ status: "connected", kind, name: meta.name, icon: meta.icon, address, chainId, balance, error: null });
    writeLast({ kind, rdns: meta.rdns });
    postJson("/api/wallets", { address, walletName: meta.name, chainId }).catch(() => {});
  }, []);

  const connectInjected = useCallback(
    async (w: DiscoveredWallet) => {
      setState((s) => ({ ...s, status: "connecting", error: null }));
      try {
        const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
        if (!accounts?.[0]) throw new Error("La wallet no compartió ninguna cuenta.");
        await finish("injected", w.provider, { name: w.name, icon: w.icon, rdns: w.rdns }, accounts[0] as `0x${string}`);
        setConnectOpen(false);
      } catch (err) {
        setState((s) => ({ ...s, status: "disconnected", error: friendlyError(err) }));
      }
    },
    [finish],
  );

  const connectWalletConnect = useCallback(
    async (onUri: (uri: string) => void) => {
      if (!WC_PROJECT_ID) {
        setState((s) => ({ ...s, error: "Falta NEXT_PUBLIC_REOWN_PROJECT_ID en .env.local para conectar por QR (ver README)." }));
        return;
      }
      setState((s) => ({ ...s, status: "connecting", error: null }));
      try {
        const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
        const provider = await EthereumProvider.init({
          projectId: WC_PROJECT_ID,
          showQrModal: false,
          optionalChains: [56, 1],
          metadata: {
            name: "Solaxy",
            description: "Invierte en energía solar",
            url: window.location.origin,
            icons: [`${window.location.origin}/icon.svg`],
          },
        });
        provider.on("display_uri", onUri);
        await provider.connect();
        const address = provider.accounts[0] as `0x${string}`;
        wcRef.current = provider as unknown as Eip1193Provider & { disconnect(): Promise<void> };
        await finish("walletconnect", provider as unknown as Eip1193Provider, { name: "Trust Wallet (celular)", icon: "" }, address);
        setConnectOpen(false);
      } catch (err) {
        setState((s) => ({ ...s, status: "disconnected", error: friendlyError(err) }));
      }
    },
    [finish],
  );

  const connectDemo = useCallback(async () => {
    const acct = demoAccount();
    await finish("demo", null, { name: "Wallet de demostración", icon: "" }, acct.address);
    setState((s) => ({ ...s, chainId: 56, balance: "Sin fondos (demo)" }));
    setConnectOpen(false);
  }, [finish]);

  const disconnect = useCallback(async () => {
    try {
      await wcRef.current?.disconnect();
    } catch {
      /* ya desconectada */
    }
    wcRef.current = null;
    providerRef.current = null;
    writeLast(null);
    setState(initial);
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<`0x${string}`> => {
      if (state.status !== "connected" || !state.address) throw new Error("Conecta una wallet primero.");
      if (state.kind === "demo") return demoAccount().signMessage({ message });
      const provider = providerRef.current;
      if (!provider) throw new Error("La wallet se desconectó. Conéctala de nuevo.");
      try {
        return (await provider.request({ method: "personal_sign", params: [toHex(message), state.address] })) as `0x${string}`;
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    },
    [state.status, state.address, state.kind],
  );

  // Reconexión silenciosa al volver al panel.
  useEffect(() => {
    startDiscovery();
    const last = readLast();
    if (!last) return;
    if (last.kind === "demo") {
      void connectDemo();
      return;
    }
    if (last.kind === "injected") {
      const t = setTimeout(async () => {
        const { getWallets } = await import("./discovery");
        const w = getWallets().find((x) => x.rdns === last.rdns) ?? getWallets()[0];
        if (!w) return;
        try {
          const accounts = (await w.provider.request({ method: "eth_accounts" })) as string[];
          if (accounts?.[0]) await finish("injected", w.provider, { name: w.name, icon: w.icon, rdns: w.rdns }, accounts[0] as `0x${string}`);
        } catch {
          /* el usuario la conectará de nuevo */
        }
      }, 600);
      return () => clearTimeout(t);
    }
  }, [connectDemo, finish]);

  const api = useMemo<WalletApi>(
    () => ({
      ...state,
      connectInjected,
      connectWalletConnect,
      connectDemo,
      disconnect,
      signMessage,
      openConnect: () => setConnectOpen(true),
      closeConnect: () => setConnectOpen(false),
      connectOpen,
    }),
    [state, connectInjected, connectWalletConnect, connectDemo, disconnect, signMessage, connectOpen],
  );

  return <Ctx value={api}>{children}</Ctx>;
}

export function useWallet() {
  const v = use(Ctx);
  if (!v) throw new Error("useWallet debe usarse dentro de WalletProvider");
  return v;
}
