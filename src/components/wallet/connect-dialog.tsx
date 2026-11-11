"use client";
import { QRCodeSVG } from "qrcode.react";
import { useState, useSyncExternalStore } from "react";
import { WC_PROJECT_ID, useWallet } from "@/lib/wallet/context";
import { getWallets, subscribeWallets } from "@/lib/wallet/discovery";
import { ErrorNote } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

const EMPTY: never[] = [];

function Option({ title, note, icon, onClick, disabled = false }: { title: string; note: string; icon: React.ReactNode; onClick(): void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-4 border-b border-line py-4 text-left transition-colors hover:bg-ink/5 disabled:opacity-40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-line-strong">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-mute">{note}</span>
      </span>
    </button>
  );
}

export function ConnectWalletDialog() {
  const wallet = useWallet();
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
          <div className="mx-auto w-fit bg-white p-4">
            <QRCodeSVG value={uri} size={232} level="M" bgColor="#ffffff" fgColor="#050505" />
          </div>
          <p className="mx-auto mt-5 max-w-[34ch] text-sm leading-relaxed text-fog">Abre Trust Wallet en tu celular, toca el ícono de escanear y apunta a este código.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={`https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`} className="btn btn-solid">
              Abrir Trust Wallet
            </a>
            <button type="button" className="btn btn-ghost" onClick={() => void navigator.clipboard?.writeText(uri).then(() => setCopied(true))}>
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </button>
          </div>
          <button type="button" onClick={() => setUri(null)} className="link mt-6 text-sm text-fog">
            Elegir otra wallet
          </button>
        </div>
      ) : (
        <div className="border-t border-line-strong">
          {injected.map((w) => (
            <Option
              key={w.uuid}
              title={w.name}
              note="Extensión de este navegador"
              // eslint-disable-next-line @next/next/no-img-element
              icon={w.icon ? <img src={w.icon} alt="" className="h-6 w-6" /> : <span className="text-sm font-medium">W</span>}
              onClick={() => void wallet.connectInjected(w)}
              disabled={wallet.status === "connecting"}
            />
          ))}
          <Option
            title="Trust Wallet en tu celular"
            note={WC_PROJECT_ID ? "Conexión con código QR (WalletConnect)" : "La conexión por QR todavía no está configurada"}
            icon={<span className="num text-xs">QR</span>}
            onClick={() => void wallet.connectWalletConnect(setUri)}
            disabled={!WC_PROJECT_ID || wallet.status === "connecting"}
          />
          {injected.length === 0 && <p className="pt-4 text-sm leading-relaxed text-mute">No encontramos extensiones de wallet en este navegador. Puedes instalar Trust Wallet o MetaMask, o usar el código QR.</p>}
          {wallet.error && <ErrorNote className="mt-5">{wallet.error}</ErrorNote>}
        </div>
      )}
    </Modal>
  );
}
