import { describe, it, expect } from "vitest";
import { resolveTheme } from "@/lib/theme";

describe("resolveTheme — dark-only (R67)", () => {
  it("auto → dark", () => {
    expect(resolveTheme("auto")).toBe("dark");
  });

  it("dark → dark", () => {
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("light → dark (tema light deprecado)", () => {
    expect(resolveTheme("light")).toBe("dark");
  });
});
