import { describe, it, expect } from "vitest";
import { jsonLdHtml } from "@/lib/jsonld";

describe("jsonLdHtml · seguridad (anti-XSS en <script ld+json>)", () => {
  it("escapa </script> para que no rompa el bloque ni inyecte código", () => {
    const out = jsonLdHtml({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c");
  });

  it("escapa & y los separadores de línea U+2028/U+2029", () => {
    const out = jsonLdHtml({ a: "Tom & Jerry", b: "x y z" });
    expect(out).not.toContain("&");
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });

  it("sigue siendo JSON válido tras des-escapar (Google lo parsea)", () => {
    const data = { "@type": "BusStop", name: "Av Brasil & Coronel <Alegre>" };
    const out = jsonLdHtml(data);
    // El navegador interpreta \uXXXX dentro del JSON → debe re-parsear al objeto original.
    expect(JSON.parse(out)).toEqual(data);
  });
});
