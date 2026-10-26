import { describe, expect, it } from "vitest";
import { HALLOWEEN_LINE, HORROR_LINES } from "@/components/studio/horror-banner";

describe("banner lines", () => {
  it.each([...HORROR_LINES, HALLOWEEN_LINE])("%s fits in 40 chars", (line) => {
    expect(line.length).toBeLessThanOrEqual(40);
  });
});
