"use client";

import { ArrowRight, CircleCheck, Siren, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { postJson } from "./use-poll";

type Outcome = "created" | "existing" | "updated";
type Result = { code: string; outcome: Outcome };

const RESULT_COPY: Record<Outcome, { title: string; body?: string }> = {
  created: { title: "Your token is ready" },
  existing: { title: "You already have a token for this service." },
  updated: {
    title: "Staff have been told about this.",
    body: "If you feel worse, speak to a staff member now.",
  },
};

export function CheckInForm({
  services,
  items,
}: {
  services: { id: string; name: string }[];
  items: { code: string; label: string }[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const attempt = useRef<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a 10-digit phone number.");
      return;
    }
    attempt.current ??= crypto.randomUUID();
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
    else setResult(response.data as Result);
  }

  function startOver() {
    attempt.current = null;
    setResult(null);
    setPhone("");
    setPicked([]);
  }

  if (result) {
    const copy = RESULT_COPY[result.outcome];
    return (
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <CircleCheck className="size-10 text-primary" />
          <div>
            <p className="font-medium">{copy.title}</p>
            {copy.body && <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>}
          </div>
          <p className="font-mono text-5xl font-bold tracking-tight">{result.code}</p>
          <Button render={<Link href={`/t/${result.code}`} />} nativeButton={false} size="lg" className="w-full">
            Track this token <ArrowRight />
          </Button>
          <Button variant="ghost" onClick={startOver}>
            Check in another patient
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Alert variant="destructive">
        <Siren />
        <AlertTitle>If this is an emergency, tell a staff member now. Do not wait for a token.</AlertTitle>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Which service do you need?</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              aria-pressed={serviceId === service.id}
              onClick={() => {
                setServiceId(service.id);
                attempt.current = null;
              }}
              className={cn(
                "rounded-lg border px-3 py-4 text-sm font-medium transition-colors hover:bg-muted",
                serviceId === service.id && "border-primary bg-accent text-accent-foreground",
              )}
            >
              {service.name}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your phone number</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="phone" className="sr-only">
            Phone number
          </Label>
          <Input
            id="phone"
            inputMode="numeric"
            autoComplete="off"
            placeholder="10-digit number"
            className="h-11 text-base"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
              setError(null);
              attempt.current = null;
            }}
          />
          <p className="text-xs text-muted-foreground">
            Used only to prevent duplicate tokens. We store a scrambled version and the last 4 digits, and no name.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anything staff should know about? (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <Label key={item.code} className="flex items-center gap-2 rounded-md border px-3 py-2 font-normal">
              <Checkbox
                checked={picked.includes(item.code)}
                onCheckedChange={(on) => {
                  attempt.current = null;
                  setPicked((list) => (on ? [...list, item.code] : list.filter((c) => c !== item.code)));
                }}
              />
              {item.label}
            </Label>
          ))}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Getting your token..." : "Get my token"}
      </Button>
    </form>
  );
}
