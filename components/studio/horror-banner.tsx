"use client";

import { useEffect, useState } from "react";

const REPO_URL = "https://github.com/Kiraatlexcorp/griddinity-gen-from-mafia";

/** Original horror-flavoured print puns for the foil banner. One per page load. */
export const HORROR_LINES = [
  "Don't look under the bed. It's full of baseplates.",
  "Whatever you do, don't skip the brim.",
  "The layer shift is coming from inside the printer.",
  "Something is stacking in the dark… 42 mm at a time.",
  "It was a quiet night. Then the nozzle started to ooze.",
  "Every drawer has a secret. Yours is now organised.",
  "Do not open the 3 a.m. print. It warped.",
  "The bins are watching. They want a magnet.",
  "They're coming from inside the drawer.",
  "Don't open the bin. Seriously.",
  "Every screw has a home. Mwahaha.",
] as const;

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

/** Banner copy: first line on the server, a random one after mount. */
export function HorrorBanner() {
  const [line, setLine] = useState<string>(HORROR_LINES[0]);
  useEffect(() => {
    // Picked after hydration so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLine(HORROR_LINES[Math.floor(Math.random() * HORROR_LINES.length)]);
  }, []);
  return (
    <div className="flex h-full items-center gap-1.5 pr-1 pl-3">
      <p className="min-w-0 flex-1 truncate text-center font-heading text-xs leading-none font-semibold tracking-tight text-foreground/90" title={line}>
        {line}
      </p>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Gridfinity Studio on GitHub (opens in a new tab)"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <GithubMark className="size-3.5" />
      </a>
    </div>
  );
}
