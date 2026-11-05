// Wallet EIP-6963 falsa para e2e (se inyecta con page.addInitScript). Firma nada: "envía" las
// transacciones a la cadena falsa (e2e/fake-chain.mjs) y devuelve el hash, como haría MetaMask.
(() => {
  const CHAIN = window.__FAKE_CHAIN_URL || "http://localhost:4020";
  const address = window.__FAKE_WALLET || "0x9999999999999999999999999999999999999999";
  let chainId = window.__FAKE_START_CHAIN || "0x1";
  const listeners = {};
  const emit = (ev, v) => (listeners[ev] || []).forEach((f) => f(v));
  const provider = {
    isMetaMask: true,
    async request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [address];
        case "eth_chainId":
          return chainId;
        case "eth_getBalance":
          return "0x56bc75e2d63100000";
        case "wallet_switchEthereumChain":
          chainId = params[0].chainId;
          emit("chainChanged", chainId);
          return null;
        case "wallet_addEthereumChain":
          return null;
        case "eth_sendTransaction": {
          const tx = params[0];
          const r = await fetch(`${CHAIN}/__send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(tx) });
          const j = await r.json();
          if (!r.ok) throw Object.assign(new Error(j.error), { code: -32000 });
          return j.hash;
        }
        default:
          throw Object.assign(new Error(`No soportado: ${method}`), { code: 4200 });
      }
    },
    on(ev, f) {
      (listeners[ev] = listeners[ev] || []).push(f);
    },
    removeListener(ev, f) {
      listeners[ev] = (listeners[ev] || []).filter((x) => x !== f);
    },
  };
  const info = { uuid: "e2e-fake-wallet", name: "Wallet de prueba", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E", rdns: "co.solaxy.e2e" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();
