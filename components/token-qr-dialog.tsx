"use client";

import { TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isLocalOnlyHost, trackUrl } from "@/lib/queue/track-link";

type Props = { code: string; open: boolean; onOpenChange: (open: boolean) => void };

/** Only rendered after check-in, so it always runs in the browser. */
export function TokenQrDialog({ code, open, onOpenChange }: Props) {
  const { origin, hostname } = window.location;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-center">
        <DialogHeader className="items-center">
          <DialogTitle className="font-mono text-4xl font-bold tracking-tight">{code}</DialogTitle>
          <DialogDescription className="text-base text-foreground">
            Scan to track your queue status live on your mobile device
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-72 rounded-xl border border-slate-200 bg-white p-3">
          <QRCodeSVG
            value={trackUrl(origin, code)}
            size={256}
            level="M"
            marginSize={2}
            title={`QR code for token ${code}`}
            className="h-auto w-full"
          />
        </div>
        {isLocalOnlyHost(hostname) && (
          <Alert variant="destructive" className="text-left">
            <TriangleAlert />
            <AlertTitle>This code will not open on a phone yet.</AlertTitle>
            <AlertDescription>
              This page is open on localhost. Open it using this computer&apos;s network address instead, such as
              http://192.168.1.10:3000/check-in, then check in again.
            </AlertDescription>
          </Alert>
        )}
        <DialogClose render={<Button variant="outline" size="lg" className="w-full" />}>Done</DialogClose>
      </DialogContent>
    </Dialog>
  );
}
