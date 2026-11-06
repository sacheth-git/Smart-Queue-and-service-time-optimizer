"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function usePoll<T>(url: string, ms = 2000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const stopped = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) {
        stopped.current = true;
        setNotFound(true);
        setError(false);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as T);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    stopped.current = false;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (!stopped.current) void refresh();
    }, ms);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, ms]);

  return { data, error, loading, notFound, refresh };
}

/** Sends a POST and returns the error message, if there is one. */
export async function postJson(url: string, body: unknown = {}): Promise<{ data?: unknown; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return res.ok ? { data: json } : { error: json.error?.message ?? "Something went wrong." };
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}
