"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const pct = (v: number) => `${Number((v * 100).toFixed(3))}%`;

/** Iridescent foil surface: pointer- and scroll-reactive layered gradients. Static under reduced motion. */
export function IridescentFoil({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pointer = { x: 0.5, y: 0.5 };
    let frame: number | null = null;

    const paint = () => {
      frame = null;
      const rect = el.getBoundingClientRect();
      const span = window.innerHeight + rect.height;
      const scroll = span > 0 ? clamp((window.innerHeight - rect.top) / span, 0, 1) : 0;
      const { x, y } = pointer;
      const s = el.style;
      s.setProperty("--foil-shift", pct(0.82 * scroll + (x - 0.5) * 0.18));
      s.setProperty("--foil-y-shift", pct(0.28 * scroll + (y - 0.5) * 0.12));
      s.setProperty("--glare-x", pct(x));
      s.setProperty("--glare-y", pct(y));
      s.setProperty("--pointer-x", pct(x));
      s.setProperty("--pointer-y", pct(y));
      s.setProperty("--shine-angle", `${Number((105 + 80 * scroll + (x - 0.5) * 28).toFixed(3))}deg`);
      s.setProperty("--shine-opacity", `${Number((0.56 + 0.24 * Math.abs(x - 0.5) + 0.12 * scroll).toFixed(3))}`);
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(paint);
    };
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.x = rect.width > 0 ? clamp((event.clientX - rect.left) / rect.width, 0.08, 0.92) : 0.5;
      pointer.y = rect.height > 0 ? clamp((event.clientY - rect.top) / rect.height, 0.08, 0.92) : 0.5;
      schedule();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    // Capture so scrolling the sidebar (not just the window) moves the foil too.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={cn("foil-surface", className)}>
      <span aria-hidden className="foil-foil" />
      <span aria-hidden className="foil-film" />
      <span aria-hidden className="foil-pearl" />
      <div className="foil-content">{children}</div>
      <span aria-hidden className="foil-shine" />
      <span aria-hidden className="foil-glare" />
    </div>
  );
}
