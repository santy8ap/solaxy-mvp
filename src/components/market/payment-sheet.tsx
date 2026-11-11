"use client";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { postJson, refetch } from "@/lib/client/use-json";
import { formatAsset, formatCop, formatKw, shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/wallet/context";
import { Modal } from "@/components/wallet/connect-dialog";

export interface PayOption {
  id: string;
  asset: "USDT" | "BNB" | "ETH" | "BTC";
  network: string;
  chainId: number | null;
  label: string;
  method: "wallet" | "qr";
}

export const PAY_OPTIONS: PayOption[] = [
  { id: "usdt-bsc", asset: "USDT", network: "BNB Smart Chain (BEP-20)", chainId: 56, label: "USDT en BNB Smart Chain", method: "wallet" },
  { id: "usdt-eth", asset: "USDT", network: "Ethereum (ERC-20)", chainId: 1, label: "USDT en Ethereum", method: "wallet" },
  { id: "bnb", asset: "BNB", network: "BNB Smart Chain", chainId: 56, label: "BNB", method: "wallet" },
  { id: "eth", asset: "ETH", network: "Ethereum", chainId: 1, label: "Ether", method: "wallet" },
  { id: "btc", asset: "BTC", network: "Bitcoin", chainId: null, label: "Bitcoin con código QR", method: "qr" },
];

export interface PurchaseRequest {
  kw?: number;
  listingId?: string;
  title: string;
  pay: PayOption;
}

interface OrderRes {
  orderId: string;
  message: string;
  kw: number;
  amountCop: number;
  assetAmount: number;
  asset: string;
  network: string;
}

type Phase = "creating" | "signing" | "qr" | "sending" | "confirming" | "done" | "error";

const STEPS = ["Orden creada", "Firma en tu wallet", "Pago enviado", "Confirmaciones de la red", "Energía asignada"];

function phaseIndex(phase: Phase) {
  switch (phase) {
    case "creating":
      return 0;
    case "signing":
    case "qr":
      return 1;
    case "sending":
      return 2;
    case "confirming":
      return 3;
    case "done":
      return 5;
    default:
      return -1;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Burst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 54 + (i % 3) * 18;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            style={
              {
                background: i % 3 === 0 ? "#b7b7b7" : i % 3 === 1 ? "#bcbcbc" : "#e4e4e4",
                "--bx": `${Math.cos(angle) * dist}px`,
                "--by": `${Math.sin(angle) * dist}px`,
                animation: `burst 900ms cubic-bezier(0.22,1,0.36,1) ${i * 12}ms both`,
              } as React.CSSProperties
            }
          />
        );
      })}
      <style>{`@keyframes burst { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 1 } 100% { transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1); opacity: 0 } }`}</style>
    </span>
  );
}

/** Compra paso a paso: orden → firma en la wallet → envío → confirmaciones → energía asignada. */
export function PaymentSheet({ request, onClose }: { request: PurchaseRequest | null; onClose(): void }) {
  const wallet = useWallet();
  const [phase, setPhase] = useState<Phase>("creating");
  const [order, setOrder] = useState<OrderRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirms, setConfirms] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const started = useRef<string | null>(null);

  const finish = useCallback(async (o: OrderRes, proof: { signature?: string; simulated?: boolean }) => {
    setPhase("sending");
    const confirmP = postJson<{ txHash: string }>(`/api/orders/${o.orderId}/confirm`, proof);
    await wait(900);
    setPhase("confirming");
    for (let c = 1; c <= 3; c++) {
      await wait(650);
      setConfirms(c);
    }
    const res = await confirmP;
    setTxHash(res.txHash);
    setPhase("done");
    void refetch("/api/portfolio");
    void refetch("/api/market");
  }, []);

  const run = useCallback(async () => {
    if (!request) return;
    setPhase("creating");
    setError(null);
    setConfirms(0);
    setTxHash(null);
    setSignature(null);
    try {
      const o = await postJson<OrderRes>("/api/orders", {
        kw: request.listingId ? undefined : request.kw,
        listingId: request.listingId,
        asset: request.pay.asset,
        network: request.pay.network,
        chainId: request.pay.chainId,
        walletAddress: request.pay.method === "wallet" ? (wallet.address ?? undefined) : undefined,
        walletName: request.pay.method === "wallet" ? (wallet.name ?? "Wallet") : "Pago QR (demo)",
        method: request.pay.method,
      });
      setOrder(o);
      await wait(500);
      if (request.pay.method === "qr") {
        setPhase("qr");
        return;
      }
      setPhase("signing");
      const sig = await wallet.signMessage(o.message);
      setSignature(sig);
      await finish(o, { signature: sig });
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [request, wallet, finish]);

  useEffect(() => {
    if (!request) {
      started.current = null;
      return;
    }
    const key = `${request.listingId ?? request.kw}-${request.pay.id}`;
    if (started.current === key) return;
    started.current = key;
    void run();
  }, [request, run]);

  const busy = phase !== "done" && phase !== "error" && phase !== "qr";
  const idx = phaseIndex(phase);

  return (
    <Modal open={!!request} onClose={busy ? () => {} : onClose} title={phase === "done" ? "¡Listo! Ya es tuya" : request?.title ?? "Compra"} wide>
      {request && (
        <div>
          <div className="rounded-none border border-silicon-600/60 bg-silicon-950/40 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-silver-400">Energía</span>
              <span className="num font-semibold text-silver-50">{order ? formatKw(order.kw) : request.kw ? formatKw(request.kw) : "—"}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <span className="text-silver-400">Total</span>
              <span className="num font-semibold text-silver-50">{order ? formatCop(order.amountCop) : "—"}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <span className="text-silver-400">Pagas</span>
              <span className="num text-silver-100">{order ? `${formatAsset(order.assetAmount, order.asset)}, ${order.network}` : request.pay.label}</span>
            </div>
            {request.pay.method === "wallet" && (
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <span className="text-silver-400">Desde</span>
                <span className="num text-silver-100">
                  {wallet.name}, {shortAddress(wallet.address)}
                </span>
              </div>
            )}
          </div>

          {phase === "qr" && order && (
            <div className="mt-5 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto rounded-none bg-white p-3">
                <QRCodeSVG value={`SOLAXY-DEMO ${order.orderId} ${order.assetAmount.toFixed(6)} BTC (no enviar fondos)`} size={168} fgColor="#141414" />
              </div>
              <div>
                <p className="text-sm text-silver-300">
                  En producción aquí verías la dirección de pago de Bitcoin. En esta demo el código no es una dirección real: no envíes fondos.
                </p>
                <button type="button" className="btn btn-sun mt-4 w-full" onClick={() =>
                    void finish(order, { simulated: true }).catch((e: Error) => {
                      setError(e.message);
                      setPhase("error");
                    })
                  }>
                  Simular pago recibido
                </button>
              </div>
            </div>
          )}

          <ol className="mt-6 space-y-4">
            {STEPS.map((s, i) => {
              const done = i < idx;
              const active = i === idx && busy;
              const detail =
                i === 0 && order
                  ? `Orden ${order.orderId}`
                  : i === 1 && signature
                    ? `Firma ${signature.slice(0, 10)}…${signature.slice(-6)} verificada`
                    : i === 1 && phase === "signing"
                      ? "Revisa tu wallet y aprueba la firma (no mueve fondos)"
                      : i === 1 && request.pay.method === "qr" && done
                        ? "Pago por QR simulado"
                        : i === 3 && (phase === "confirming" || done)
                          ? `${Math.min(3, phase === "done" ? 3 : confirms)} de 3 confirmaciones`
                          : i === 4 && txHash
                            ? `Transacción ${txHash.slice(0, 10)}…${txHash.slice(-6)} (simulada)`
                            : null;
              return (
                <li key={s} className="flex gap-3">
                  <span
                    className={`relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      done || (i === 4 && phase === "done") ? "border-leaf-400 bg-leaf-400/15 text-leaf-300" : active ? "border-sun-400 text-sun-300" : "border-silicon-500 text-silver-500"
                    }`}
                  >
                    {done || (i === 4 && phase === "done") ? <Check size={15} /> : active ? <Loader2 size={15} className="animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                    {i === 4 && phase === "done" && <Burst />}
                  </span>
                  <div>
                    <div className={done || active || (i === 4 && phase === "done") ? "font-medium text-silver-50" : "text-silver-400"}>{s}</div>
                    {detail && <div className="num text-sm text-silver-400">{detail}</div>}
                  </div>
                </li>
              );
            })}
          </ol>

          {phase === "error" && (
            <div className="mt-5 rounded-none border border-alert-400/40 bg-alert-400/10 p-3 text-sm text-alert-400" role="alert">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {phase === "error" && (
              <button type="button" className="btn btn-sun" onClick={() => void run()}>
                Intentar de nuevo
              </button>
            )}
            {phase === "done" && (
              <Link href="/panel" className="btn btn-sun" onClick={onClose}>
                Ver mis ganancias
              </Link>
            )}
            {!busy && (
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {phase === "done" ? "Seguir comprando" : "Cerrar"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
