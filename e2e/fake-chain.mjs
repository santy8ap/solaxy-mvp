// BNB Chain falsa para pruebas locales y e2e: nodo JSON-RPC mínimo (lo que usa viem para verificar)
// y precios falsos de CoinGecko. La wallet inyectada en el navegador "envía" transacciones con POST /__send.
// Uso: FAKE_CHAIN_PORT=4020 USDT_CONTRACT=0x55d3… node e2e/fake-chain.mjs
import { createHash } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.FAKE_CHAIN_PORT ?? 4020);
const CHAIN_ID = Number(process.env.FAKE_CHAIN_ID ?? 56);
const USDT = (process.env.USDT_CONTRACT ?? "0x55d398326f99059fF775485246999027B3197955").toLowerCase();
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const START_BLOCK = 50_000_000;
const startedAt = Date.now();
/** Un bloque nuevo cada segundo: así llegan las confirmaciones solas. */
const latest = () => START_BLOCK + Math.floor((Date.now() - startedAt) / 1000);
const hex = (n) => `0x${BigInt(n).toString(16)}`;
const h32 = (s) => `0x${createHash("sha256").update(String(s)).digest("hex")}`;
const pad = (addr) => `0x${"0".repeat(24)}${addr.slice(2).toLowerCase()}`;
const txs = new Map();
let nonce = 0;

function block(n) {
  return {
    number: hex(n),
    hash: h32(`block-${n}`),
    parentHash: h32(`block-${n - 1}`),
    nonce: "0x0000000000000000",
    sha3Uncles: h32("uncles"),
    logsBloom: `0x${"0".repeat(512)}`,
    transactionsRoot: h32(`txroot-${n}`),
    stateRoot: h32(`state-${n}`),
    receiptsRoot: h32(`receipts-${n}`),
    miner: "0x0000000000000000000000000000000000000000",
    difficulty: "0x2",
    totalDifficulty: hex(n * 2),
    extraData: "0x",
    size: "0x400",
    gasLimit: hex(140_000_000),
    gasUsed: "0x0",
    timestamp: hex(Math.floor((startedAt + (n - START_BLOCK) * 1000) / 1000)),
    transactions: [],
    uncles: [],
    baseFeePerGas: "0x0",
    mixHash: h32(`mix-${n}`),
  };
}

function txObject(t) {
  return {
    hash: t.hash,
    nonce: hex(t.nonce),
    blockHash: h32(`block-${t.block}`),
    blockNumber: hex(t.block),
    transactionIndex: "0x0",
    from: t.from,
    to: t.to,
    value: hex(t.value),
    gas: hex(60_000),
    gasPrice: hex(1_000_000_000),
    input: t.data ?? "0x",
    type: "0x0",
    chainId: hex(CHAIN_ID),
    v: hex(CHAIN_ID * 2 + 35),
    r: h32(`r-${t.hash}`),
    s: h32(`s-${t.hash}`),
  };
}

function receipt(t) {
  const logs = [];
  if (t.token) {
    logs.push({
      address: USDT,
      topics: [TRANSFER_TOPIC, pad(t.from), pad(t.token.to)],
      data: `0x${t.token.amount.toString(16).padStart(64, "0")}`,
      blockNumber: hex(t.block),
      transactionHash: t.hash,
      transactionIndex: "0x0",
      blockHash: h32(`block-${t.block}`),
      logIndex: "0x0",
      removed: false,
    });
  }
  return {
    transactionHash: t.hash,
    transactionIndex: "0x0",
    blockHash: h32(`block-${t.block}`),
    blockNumber: hex(t.block),
    from: t.from,
    to: t.to,
    cumulativeGasUsed: hex(50_000),
    gasUsed: hex(50_000),
    effectiveGasPrice: hex(1_000_000_000),
    contractAddress: null,
    logs,
    logsBloom: `0x${"0".repeat(512)}`,
    status: t.reverted ? "0x0" : "0x1",
    type: "0x0",
  };
}

function rpc(method, params) {
  switch (method) {
    case "eth_chainId":
      return hex(CHAIN_ID);
    case "net_version":
      return String(CHAIN_ID);
    case "eth_blockNumber":
      return hex(latest());
    case "eth_getBlockByNumber": {
      const tag = params?.[0];
      const n = tag === "latest" || tag === "pending" ? latest() : Number(BigInt(tag));
      return block(n);
    }
    case "eth_getTransactionByHash": {
      const t = txs.get(String(params?.[0]).toLowerCase());
      return t ? txObject(t) : null;
    }
    case "eth_getTransactionReceipt": {
      const t = txs.get(String(params?.[0]).toLowerCase());
      return t && t.block <= latest() ? receipt(t) : null;
    }
    case "eth_getBalance":
      return hex(10n ** 20n);
    default:
      throw Object.assign(new Error(`Método no soportado: ${method}`), { code: -32601 });
  }
}

/** La wallet falsa del navegador llama aquí para "enviar" una transacción. */
function send({ from, to, value, data }) {
  const t = { hash: h32(`tx-${++nonce}-${Date.now()}`), from: from.toLowerCase(), to: to.toLowerCase(), value: BigInt(value ?? "0x0"), data: data ?? "0x", nonce, block: latest() + 1 };
  if (data && data.startsWith("0xa9059cbb")) {
    // transfer(address,uint256) de un token BEP-20
    const recipient = `0x${data.slice(10 + 24, 10 + 64)}`;
    const amount = BigInt(`0x${data.slice(10 + 64, 10 + 128)}`);
    if (t.to === USDT) t.token = { to: recipient, amount };
  }
  txs.set(t.hash, t);
  console.log(`[fake-chain] tx ${t.hash.slice(0, 12)}… ${t.token ? `USDT ${t.token.amount}` : `BNB ${t.value}`} → bloque ${t.block}`);
  return t.hash;
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  let raw = "";
  for await (const c of req) raw += c;
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json", ...cors });
    res.end(JSON.stringify(body));
  };
  if (url.pathname.startsWith("/coingecko/simple/price")) {
    return json(200, { tether: { cop: Number(process.env.FAKE_USDT_COP ?? 4000) }, binancecoin: { cop: Number(process.env.FAKE_BNB_COP ?? 2_800_000) } });
  }
  if (req.method === "POST" && url.pathname === "/__send") {
    try {
      return json(200, { hash: send(JSON.parse(raw)) });
    } catch (e) {
      return json(400, { error: e.message });
    }
  }
  if (req.method === "POST" && url.pathname === "/rpc") {
    const body = JSON.parse(raw || "{}");
    const handle = (call) => {
      try {
        return { jsonrpc: "2.0", id: call.id, result: rpc(call.method, call.params) };
      } catch (e) {
        return { jsonrpc: "2.0", id: call.id, error: { code: e.code ?? -32000, message: e.message } };
      }
    };
    return json(200, Array.isArray(body) ? body.map(handle) : handle(body));
  }
  json(404, { error: "no encontrado" });
});
server.listen(PORT, () => console.log(`[fake-chain] escuchando en http://localhost:${PORT} (chainId ${CHAIN_ID})`));
