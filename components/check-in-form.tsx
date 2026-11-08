"use client";

import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Check,
  CircleCheck,
  FlaskConical,
  Lock,
  Phone,
  Pill,
  Plus,
  QrCode,
  Siren,
  Stethoscope,
  Ticket,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { newIdempotencyKey } from "@/lib/queue/idempotency-key";
import { cn } from "@/lib/utils";
import { TokenQrDialog } from "./token-qr-dialog";
import { postJson } from "./use-poll";

type Outcome = "created" | "existing" | "updated";
type Result = { code: string; outcome: Outcome };
type Step = 1 | 2 | 3;

const RESULT_COPY: Record<Outcome, { title: string; body?: string }> = {
  created: { title: "Your token is ready" },
  existing: { title: "You already have a token for this service." },
  updated: {
    title: "Staff have been told about this.",
    body: "If you feel worse, speak to a staff member now.",
  },
};

const SERVICE_CARDS: Record<string, { icon: LucideIcon; description: string }> = {
  general: { icon: Stethoscope, description: "See a doctor for a check-up or a new health problem." },
  pediatrics: { icon: Baby, description: "Care for babies, children and teenagers." },
  lab: { icon: FlaskConical, description: "Blood tests and samples your doctor has asked for." },
  pharmacy: { icon: Pill, description: "Collect the medicines on your prescription." },
};

const STEPS = ["Service", "Phone number", "Details"];

const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white shadow-[0_10px_22px_-12px_rgb(21_158_154/0.9)] transition hover:bg-brand-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none";
const ghostButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 font-semibold text-navy shadow-sm transition hover:border-slate-300 active:scale-[0.98]";

function Stepper({ step }: { step: Step }) {
  return (
    <ol aria-label="Progress" className="mt-7 mb-5 grid grid-cols-3">
      {STEPS.map((label, index) => {
        const n = index + 1;
        const complete = n < step;
        const current = n === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className="relative flex min-w-0 flex-col items-center gap-2"
          >
            {index > 0 && (
              <span aria-hidden="true" className="absolute top-[17px] right-1/2 h-[3px] w-full rounded-full bg-line">
                <span
                  className={cn(
                    "block h-full rounded-full bg-brand transition-[width] duration-500",
                    n <= step ? "w-full" : "w-0",
                  )}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 flex size-9 items-center justify-center rounded-full border-2 text-[15px] font-bold transition-colors duration-300",
                complete && "border-brand bg-brand text-white",
                current && "border-brand bg-white text-brand shadow-[0_0_0_5px_rgb(21_158_154/0.14)]",
                !complete && !current && "border-line bg-white text-slate-400",
              )}
            >
              {complete ? <Check className="size-[18px] animate-in zoom-in-50 duration-300" strokeWidth={3} /> : n}
            </span>
            <span
              className={cn(
                "text-center text-xs font-semibold sm:text-[13px]",
                complete || current ? "text-navy" : "text-slate-400",
              )}
            >
              {label}
              {complete && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({ step, title, hint, optional }: { step: Step; title: string; hint: string; optional?: boolean }) {
  return (
    <>
      <p className="text-xs font-bold tracking-[0.08em] text-brand uppercase">Step {step} of 3</p>
      <h2 className="mt-1.5 flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-balance">
        {title}
        {optional && (
          <span className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs font-semibold tracking-normal text-navy-soft">
            Optional
          </span>
        )}
      </h2>
      <p className="mt-1.5 text-navy-soft">{hint}</p>
    </>
  );
}

export function CheckInForm({
  services,
  items,
  networkAddress,
}: {
  services: { id: string; name: string }[];
  items: { code: string; label: string }[];
  networkAddress: string | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showQr, setShowQr] = useState(false);
  const attempt = useRef<string | null>(null);

  const serviceName = services.find((s) => s.id === serviceId)?.name ?? "";

  function chooseService(id: string) {
    setServiceId(id);
    attempt.current = null;
  }

  function submitPhone(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError(true);
      return;
    }
    setStep(3);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !serviceId) return;
    attempt.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    const response = await postJson("/api/check-in", {
      serviceId,
      phone,
      itemCodes: picked,
      idempotencyKey: attempt.current,
    });
    setBusy(false);
    if (response.error) setError(response.error);
    else {
      setResult(response.data as Result);
      setShowQr(true);
    }
  }

  function startOver() {
    attempt.current = null;
    setResult(null);
    setShowQr(false);
    setServiceId(null);
    setPhone("");
    setPicked([]);
    setError(null);
    setStep(1);
  }

  if (result) {
    const copy = RESULT_COPY[result.outcome];
    return (
      <div className="mx-auto w-full max-w-[760px]">
        <div className="animate-in rounded-[20px] border border-line bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgb(16_42_67/0.05),0_8px_24px_-8px_rgb(16_42_67/0.14)] duration-300 fade-in slide-in-from-bottom-2">
          <span className="mx-auto flex size-14 animate-in items-center justify-center rounded-full bg-mint text-brand duration-500 zoom-in-50">
            <CircleCheck className="size-8" />
          </span>
          <p className="mt-3.5 text-lg font-semibold">{copy.title}</p>
          {copy.body && <p className="mt-1 text-sm text-navy-soft">{copy.body}</p>}
          <p className="mt-1.5 font-mono text-[clamp(2.75rem,9vw,4rem)] leading-tight font-bold tracking-tight">
            {result.code}
          </p>
          <p className="text-navy-soft">{serviceName}</p>
          <div className="mx-auto mt-6 flex max-w-[360px] flex-col gap-2.5">
            <Link href={`/t/${result.code}`} className={primaryButton}>
              Track this token <ArrowRight className="size-5" />
            </Link>
            <button type="button" className={ghostButton} onClick={() => setShowQr(true)}>
              <QrCode className="size-5" /> Show QR code
            </button>
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg p-2 font-semibold text-navy-soft hover:text-navy"
            >
              <Plus className="size-4" /> Check in another patient
            </button>
          </div>
        </div>
        <TokenQrDialog code={result.code} networkAddress={networkAddress} open={showQr} onOpenChange={setShowQr} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <p className="flex items-center gap-2.5 rounded-xl border border-[#f6cdd1] bg-emergency-soft px-4 py-3 text-[15px] font-semibold text-[#9b2c33]">
        <Siren className="size-5 shrink-0 text-emergency" />
        If this is an emergency, tell a staff member now. Do not wait for a token.
      </p>

      <Stepper step={step} />

      <div className="rounded-[20px] border border-line bg-white p-5 shadow-[0_1px_2px_rgb(16_42_67/0.05),0_8px_24px_-8px_rgb(16_42_67/0.14)] sm:p-7">
        {step === 1 && (
          <div key="service" className="animate-in duration-300 fade-in slide-in-from-bottom-2">
            <StepHeading
              step={1}
              title="Which service do you need?"
              hint="Choose one. You can change it before you get your token."
            />
            <div role="radiogroup" aria-label="Service" className="mt-5 grid gap-3.5 sm:grid-cols-2">
              {services.map((service) => {
                const card = SERVICE_CARDS[service.id] ?? { icon: Stethoscope, description: "" };
                const Icon = card.icon;
                const selected = serviceId === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseService(service.id)}
                    className={cn(
                      "relative flex min-w-0 items-start gap-3.5 rounded-2xl border p-[18px] text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985]",
                      selected
                        ? "pq-select border-brand bg-mint shadow-[0_0_0_1px_var(--color-brand),0_10px_24px_-14px_rgb(21_158_154/0.8)]"
                        : "border-line bg-white hover:border-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-colors duration-300",
                        selected ? "bg-brand text-white" : "bg-mint text-brand",
                      )}
                    >
                      <Icon className="size-6" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1 pr-6">
                      <span className="text-[17px] font-bold">{service.name}</span>
                      {card.description && (
                        <span className="text-sm leading-snug text-navy-soft">{card.description}</span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-3.5 right-3.5 flex size-6 items-center justify-center rounded-full bg-brand text-white transition-[transform,opacity] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]",
                        selected ? "scale-100 opacity-100" : "scale-0 opacity-0",
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" disabled={!serviceId} onClick={() => setStep(2)} className={primaryButton}>
                Continue <ArrowRight className="size-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form key="phone" onSubmit={submitPhone} className="animate-in duration-300 fade-in slide-in-from-bottom-2">
            <StepHeading step={2} title="Your phone number" hint="We use it only to stop duplicate tokens." />
            <label
              htmlFor="phone"
              className={cn(
                "mt-5 flex h-[60px] items-center gap-3 rounded-[14px] border bg-white px-[18px] text-slate-400 transition focus-within:text-brand focus-within:shadow-[0_0_0_4px_rgb(21_158_154/0.15)]",
                phoneError ? "border-emergency" : "border-line focus-within:border-brand",
              )}
            >
              <Phone className="size-5" />
              <span className="sr-only">Phone number</span>
              <input
                id="phone"
                autoFocus
                inputMode="numeric"
                autoComplete="off"
                placeholder="10-digit number"
                aria-invalid={phoneError}
                aria-describedby="phone-note"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setPhoneError(false);
                  attempt.current = null;
                }}
                className="min-w-0 flex-1 bg-transparent font-mono text-[22px] font-semibold tracking-[0.08em] text-navy outline-none placeholder:font-sans placeholder:text-[17px] placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              />
            </label>
            {phoneError && (
              <p role="alert" className="mt-2.5 text-sm font-semibold text-[#b23a43]">
                Enter a 10-digit phone number.
              </p>
            )}
            <p id="phone-note" className="mt-3 flex items-center gap-2 text-sm text-navy-soft">
              <Lock className="size-4 shrink-0 text-brand" />
              We store a scrambled version and the last 4 digits, and no name.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className={ghostButton} onClick={() => setStep(1)}>
                <ArrowLeft className="size-5" /> Back
              </button>
              <button type="submit" className={primaryButton}>
                Continue <ArrowRight className="size-5" />
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form key="details" onSubmit={submit} className="animate-in duration-300 fade-in slide-in-from-bottom-2">
            <StepHeading
              step={3}
              title="Anything staff should know?"
              hint="Tick anything that applies. A staff member will review it."
              optional
            />
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {items.map((item) => {
                const checked = picked.includes(item.code);
                return (
                  <label
                    key={item.code}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 font-medium transition-colors",
                      checked ? "border-brand bg-mint" : "border-line hover:border-slate-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        attempt.current = null;
                        const on = e.target.checked;
                        setPicked((list) => (on ? [...list, item.code] : list.filter((c) => c !== item.code)));
                      }}
                      className="size-5 shrink-0 accent-brand"
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-4 rounded-xl bg-canvas px-3.5 py-3 text-sm text-navy-soft">
              <b className="text-navy">{serviceName}</b> · phone ending {phone.slice(-4)}
            </p>
            {error && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-emergency-soft px-3.5 py-3 text-sm font-medium text-[#9b2c33]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className={ghostButton} onClick={() => setStep(2)}>
                <ArrowLeft className="size-5" /> Back
              </button>
              <button type="submit" disabled={busy} className={primaryButton}>
                <Ticket className="size-5" /> {busy ? "Getting your token..." : "Get my token"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
