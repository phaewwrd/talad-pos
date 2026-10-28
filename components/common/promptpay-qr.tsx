"use client";

import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** PromptPay QR for an exact amount (Thai QR standard payload). */
export function PromptPayQr({
  promptpayId,
  amount,
  size = 240,
  label,
}: {
  promptpayId: string;
  amount: string;
  size?: number;
  label: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Display only: the amount is a 2dp string from the server engine.
    const payload = generatePayload(promptpayId, { amount: Number(amount) });
    QRCode.toDataURL(payload, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((url) => !cancelled && setSrc(url));
    return () => {
      cancelled = true;
    };
  }, [promptpayId, amount, size]);

  if (!src)
    return (
      <Skeleton className="rounded-2xl" style={{ width: size, height: size }} />
    );
  return (
    // biome-ignore lint/performance/noImgElement: generated data URL
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      className="rounded-2xl border bg-white p-2"
    />
  );
}
