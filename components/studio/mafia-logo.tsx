export function MafiaLogo({ className }: { className?: string }) {
  // ACMIE badge (original ACME artwork with the banner text changed to ACMIE) (app/icon.svg and app/favicon.ico match). Original badge: a maroon starburst with a cream outline and a tilted maroon banner with cream lettering. Drawn for this app.
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="ACMIE">
      <polygon
        points="32.00,2.00 37.56,7.63 45.02,4.97 47.59,12.45 55.45,13.30 54.52,21.15 61.25,25.32 57.00,32.00 61.25,38.68 54.52,42.85 55.45,50.70 47.59,51.55 45.02,59.03 37.56,56.37 32.00,62.00 26.44,56.37 18.98,59.03 16.41,51.55 8.55,50.70 9.48,42.85 2.75,38.68 7.00,32.00 2.75,25.32 9.48,21.15 8.55,13.30 16.41,12.45 18.98,4.97 26.44,7.63"
        fill="#800020"
        stroke="#F5E6D3"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#F5E6D3" strokeWidth={1.5} strokeDasharray="2 2.6" />
      <g transform="rotate(-9 32 32)">
        <rect x="5" y="23" width="54" height="18" rx="3.5" fill="#800020" stroke="#F5E6D3" strokeWidth={2.5} />
        <text
          x="32"
          y="36.6"
          textAnchor="middle"
          fontFamily="var(--font-hubot-sans), 'Arial Black', Impact, sans-serif"
          fontWeight={900}
          fontSize={12.5}
          textLength={46}
          lengthAdjust="spacingAndGlyphs"
          fill="#F5E6D3"
          stroke="#800020"
          strokeWidth={2.2}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          ACMIE
        </text>
      </g>
    </svg>
  );
}
