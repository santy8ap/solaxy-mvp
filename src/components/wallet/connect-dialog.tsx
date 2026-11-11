"use client";
import { QRCodeSVG } from "qrcode.react";
import { Dialog } from "@/components/ui/dialog";
import { useState, useSyncExternalStore } from "react";
import { useAppConfig } from "@/lib/client/use-app-config";
import { WC_PROJECT_ID, useWallet } from "@/lib/wallet/context";
import { getWallets, subscribeWallets } from "@/lib/wallet/discovery";

const EMPTY: never[] = [];

export function Modal({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: React.ReactNode; wide?: boolean }) {
  return <Dialog open={open} onClose={onClose} title={title}>{children}</Dialog>;
}

function Option({ title, note, icon, onClick, disabled = false }: { title: string; note: string; icon: React.ReactNode; onClick(): void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-4 rounded-none border border-silicon-600/70 bg-silicon-950/40 p-4 text-left transition-colors hover:border-sun-400/60 hover:bg-silicon-800 disabled:opacity-50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-none bg-silicon-700">{icon}</span>
      <span>
        <span className="block font-semibold text-silver-50">{title}</span>
        <span className="block text-sm text-silver-400">{note}</span>
      </span>
    </button>
  );
}

export function ConnectWalletDialog() {
  const wallet = useWallet();
  const { config } = useAppConfig();
  const injected = useSyncExternalStore(subscribeWallets, getWallets, () => EMPTY);
  const [uri, setUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setUri(null);
    wallet.closeConnect();
  };

  return (
    <Modal open={wallet.connectOpen} onClose={close} title={uri ? "Escanea con Trust Wallet" : "Conecta tu wallet"}>
      {uri ? (
        <div className="text-center">
          <div className="mx-auto w-fit rounded-none bg-white p-4">
            <QRCodeSVG value={uri} size={232} level="M" bgColor="#ffffff" fgColor="#141414" />
          </div>
          <p className="mx-auto mt-4 max-w-[34ch] text-sm text-silver-300">
            Abre Trust Wallet en tu celular, toca el ícono de escanear y apunta a este código.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <a href={`https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`} className="btn btn-sun !py-2.5 text-sm">
              Abrir Trust Wallet
            </a>
            <button
              type="button"
              className="btn btn-ghost !py-2.5 text-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(uri).then(() => setCopied(true));
              }}
            >
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </button>
          </div>
          <button type="button" onClick={() => setUri(null)} className="mt-5 text-sm text-silver-400 hover:text-silver-50">
            Elegir otra wallet
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {injected.map((w) => (
            <Option
              key={w.uuid}
              title={w.name}
              note="Extensión de este navegador"
              // eslint-disable-next-line @next/next/no-img-element
              icon={w.icon ? <img src={w.icon} alt="" className="h-7 w-7" /> : <span className="font-bold text-sun-300">W</span>}
              onClick={() => void wallet.connectInjected(w)}
              disabled={wallet.status === "connecting"}
            />
          ))}
          <Option
            title="Trust Wallet en tu celular"
            note={WC_PROJECT_ID ? "Conexión con código QR (WalletConnect)" : "Requiere configurar el Project ID de Reown"}
            icon={<span className="text-lg font-bold text-[#adadad]">QR</span>}
            onClick={() => void wallet.connectWalletConnect(setUri)}
            disabled={!WC_PROJECT_ID || wallet.status === "connecting"}
          />
          {config?.demoMode && (
            <Option
              title="Wallet de demostración"
              note="Firma de verdad, sin fondos. Ideal para la presentación"
              icon={<span className="text-lg font-bold text-dusk-300">D</span>}
              onClick={() => void wallet.connectDemo()}
            />
          )}
          {injected.length === 0 && (
            <p className="pt-1 text-sm text-silver-400">
              No encontramos extensiones de wallet en este navegador. Puedes instalar Trust Wallet o MetaMask, o usar el QR.
            </p>
          )}
          {wallet.error && (
            <p role="alert" className="rounded-none border border-alert-400/40 bg-alert-400/10 p-3 text-sm text-alert-400">
              {wallet.error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
