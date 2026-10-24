"use client";

import { useCallback, useRef, useState } from "react";

/** One status toast at a time, using the shared P22 motion (rise + blur in, fade out). */
export function useToast() {
  const [toast, setToast] = useState<{ message: string; open: boolean }>({ message: "", open: false });
  const timer = useRef<number | null>(null);
  const show = useCallback((message: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast({ message, open: true });
    timer.current = window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 2200);
  }, []);
  return { toast, show };
}

export function Toast({ message, open }: { message: string; open: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-open={open}
      className="motion-toast pointer-events-none fixed bottom-6 left-1/2 z-50 flex h-11 items-center rounded-full bg-popover px-4 text-sm font-medium text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      {message}
    </div>
  );
}
