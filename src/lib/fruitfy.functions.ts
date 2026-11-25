import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Fruitfy PIX integration. Credentials are read server-side only.
const BASE_URL = "https://api.fruitfy.io/api";
const PRICE_CENTS = 9700; // R$ 97,00

function fruitfyHeaders(): Record<string, string> {
  const token = process.env["FRUITFY_API_TOKEN"];
  const storeId = process.env["FRUITFY_STORE_ID"];
  if (!token || !storeId) throw new Error("Pagamento PIX ainda não configurado.");
  return {
    Authorization: `Bearer ${token}`,
    "Store-Id": storeId,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "pt_BR",
  };
}

const digits = (v: string) => v.replace(/\D/g, "");

const chargeInput = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  cpf: z.string().transform(digits).pipe(z.string().length(11)),
  phone: z.string().transform(digits).pipe(z.string().min(10).max(13)),
});

export type PixCharge = { orderId: string | null; pixCode: string | null; qrImage: string | null };

// Response shape isn't documented; search common field names defensively.
function findField(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keys.includes(k) && typeof v === "string" && v) return v;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const found = findField(v, keys);
    if (found) return found;
  }
  return null;
}

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => chargeInput.parse(data))
  .handler(async ({ data }): Promise<PixCharge> => {
    const productId = process.env["FRUITFY_PRODUCT_ID"];
    if (!productId) throw new Error("Pagamento PIX ainda não configurado.");
    const phone = data.phone.startsWith("55") ? data.phone : `55${data.phone}`;
    const res = await fetch(`${BASE_URL}/pix/charge`, {
      method: "POST",
      headers: fruitfyHeaders(),
      body: JSON.stringify({ ...data, phone, items: [{ id: productId, value: PRICE_CENTS, quantity: 1 }] }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Fruitfy charge failed", res.status, JSON.stringify(json));
      const msg = (json as { message?: string } | null)?.message;
      throw new Error(msg || "Não foi possível gerar o PIX. Tente novamente.");
    }
    const qr = findField(json, ["qr_code_base64", "qrcode_base64", "qr_code_image", "qrcode_image", "image"]);
    return {
      orderId: findField(json, ["order_uuid", "uuid", "order_id"]),
      pixCode: findField(json, ["pix_code", "copy_paste", "copia_e_cola", "emv", "brcode", "qr_code", "qrcode", "code", "payload"]),
      qrImage: qr ? (qr.startsWith("data:") || qr.startsWith("http") ? qr : `data:image/png;base64,${qr}`) : null,
    };
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ orderId: z.string().min(1).max(64).regex(/^[\w-]+$/) }).parse(data))
  .handler(async ({ data }): Promise<{ status: string }> => {
    const res = await fetch(`${BASE_URL}/order/${data.orderId}`, { headers: fruitfyHeaders() });
    if (!res.ok) return { status: "unknown" };
    const json = (await res.json()) as { data?: { status?: string } };
    return { status: json.data?.status ?? "unknown" };
  });
