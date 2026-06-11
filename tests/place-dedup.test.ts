/**
 * Dedup de lugares del geocoder (lib/place-dedup).
 * Caso real que motivó esto: "Shopping Tres Cruces" (curado, coords terminal) y
 * "Tres Cruces Shopping" (Nominatim, centroide OSM) aparecían JUNTOS en resultados.
 */
import { describe, it, expect } from "vitest";
import { isSamePlace, dedupePlaces } from "@/lib/place-dedup";

// Tres Cruces real: terminal vs shopping a ~150 m
const curatedTresCruces = { name: "Shopping Tres Cruces", lat: -34.8945, lon: -56.1647 };
const osmTresCruces = { name: "Tres Cruces Shopping", lat: -34.8938, lon: -56.1660 };

describe("isSamePlace", () => {
  it("mismo nombre con tokens reordenados a <300m → mismo lugar", () => {
    expect(isSamePlace(curatedTresCruces, osmTresCruces)).toBe(true);
  });

  it("nombre con área tras la coma se ignora para comparar", () => {
    const conBarrio = { ...osmTresCruces, name: "Tres Cruces Shopping, Cordón" };
    expect(isSamePlace(curatedTresCruces, conBarrio)).toBe(true);
  });

  it("acentos y mayúsculas no rompen la igualdad", () => {
    const a = { name: "Estación Central", lat: -34.906, lon: -56.2 };
    const b = { name: "estacion CENTRAL", lat: -34.9062, lon: -56.2001 };
    expect(isSamePlace(a, b)).toBe(true);
  });

  it("mismo punto (<55m) es mismo lugar aunque el nombre difiera", () => {
    const a = { name: "Terminal Tres Cruces", lat: -34.8945, lon: -56.1647 };
    const b = { name: "Tres Cruces", lat: -34.8946, lon: -56.1648 };
    expect(isSamePlace(a, b)).toBe(true);
  });

  it("mismo nombre LEJOS (>300m) NO se fusiona (sucursales de cadena)", () => {
    const devotoCentro = { name: "Devoto", lat: -34.9055, lon: -56.1913 };
    const devotoPocitos = { name: "Devoto", lat: -34.9105, lon: -56.1505 }; // ~3.8 km
    expect(isSamePlace(devotoCentro, devotoPocitos)).toBe(false);
  });

  it("nombres distintos cerca (>55m) NO se fusionan", () => {
    const terminal = { name: "Terminal Tres Cruces", lat: -34.8945, lon: -56.1647 };
    const obelisco = { name: "Obelisco a los Constituyentes", lat: -34.8953, lon: -56.1638 }; // ~120 m
    expect(isSamePlace(terminal, obelisco)).toBe(false);
  });
});

describe("dedupePlaces", () => {
  it("filtra candidatos que duplican lo ya elegido", () => {
    const out = dedupePlaces([curatedTresCruces], [osmTresCruces, { name: "Plaza Independencia", lat: -34.9066, lon: -56.2009 }]);
    expect(out.map((p) => p.name)).toEqual(["Plaza Independencia"]);
  });

  it("también deduplica candidatos entre sí", () => {
    const out = dedupePlaces([], [curatedTresCruces, osmTresCruces]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Shopping Tres Cruces"); // conserva el primero (curado)
  });
});
