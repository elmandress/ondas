import { describe, it, expect } from "vitest";
import { resolveTheme } from "@/lib/theme";

describe("resolveTheme — dark-first", () => {
  it("auto → siempre dark (identidad de marca)", () => {
    expect(resolveTheme("auto")).toBe("dark");
  });

  it("dark → dark", () => {
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("light → light", () => {
    expect(resolveTheme("light")).toBe("light");
  });
});
