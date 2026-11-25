import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Loader2, LockKeyhole } from "lucide-react";
import { createPixCharge, getOrderStatus, type PixCharge } from "@/lib/fruitfy.functions";

export interface PixPaymentProps {
  customer: { name: string; email: string; cpf: string; phone: string };
}

export function PixPayment({ customer }: PixPaymentProps) {
  const createFn = useServerFn(createPixCharge);
  const statusFn = useServerFn(getOrderStatus);
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const orderId = charge?.orderId;
    if (!orderId || paid) return;
    const timer = setInterval(async () => {
      try {
        const { status } = await statusFn({ data: { orderId } });
        if (status === "paid") setPaid(true);
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [charge?.orderId, paid, statusFn]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      setCharge(await createFn({ data: customer }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o PIX.");
    } finally {
      setLoading(false);
    }
  }

  if (paid) {
    return (
      <div className="mt-6 rounded-2xl border border-accent bg-accent/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-accent" />
        <p className="mt-3 font-display text-2xl font-bold">Pagamento confirmado!</p>
        <p className="mt-1 text-sm text-muted-foreground">Obrigado! Você receberá os detalhes do envio por e-mail.</p>
      </div>
    );
  }

  if (charge) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-background/50 p-5 text-center">
        {charge.qrImage && <img src={charge.qrImage} alt="QR Code PIX" className="mx-auto size-56 rounded-xl bg-card p-2" />}
        {charge.pixCode && (
          <>
            <p className="mt-4 text-sm font-semibold">PIX copia e cola</p>
            <textarea readOnly value={charge.pixCode} className="mt-2 h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-xs" />
            <button type="button" onClick={() => { void navigator.clipboard.writeText(charge.pixCode ?? ""); setCopied(true); }} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">
              <Copy className="size-4" /> {copied ? "Copiado!" : "Copiar código"}
            </button>
          </>
        )}
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aguardando confirmação do pagamento…</p>
      </div>
    );
  }

  return (
    <>
      {error && <p role="alert" className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <button type="button" onClick={generate} disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-bold text-primary-foreground shadow-lg transition hover:brightness-110 disabled:opacity-60">
        {loading ? <><Loader2 className="size-5 animate-spin" /> Gerando PIX…</> : <><LockKeyhole className="size-4" /> Gerar PIX de R$ 97,00</>}
      </button>
    </>
  );
}
