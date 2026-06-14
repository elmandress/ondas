// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contrato del Service Worker (R67). El flujo de actualización ("Hay una nueva versión ·
 * Actualizar") es el canal por el que cada deploy le llega al usuario instalado. Es
 * fácil de romper en silencio (nadie lo prueba en desktop — ahí F5 alcanza). Este test
 * fija los invariantes para que un refactor no vuelva a matar el update sin que se note.
 */
const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

describe("service worker · contrato de actualización", () => {
  it("importa sw-version.js → los bytes del SW cambian por build (dispara updatefound)", () => {
    expect(sw).toMatch(/importScripts\(\s*["']\/sw-version\.js["']\s*\)/);
  });

  it("el import está protegido (try/catch) — un 404 no debe romper la instalación", () => {
    expect(sw).toMatch(/try\s*\{\s*importScripts\(\s*["']\/sw-version\.js["']/);
  });

  it("NO hace skipWaiting() automático en install (rompe el prompt manual)", () => {
    const install = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
    expect(install).not.toMatch(/skipWaiting\s*\(/);
  });

  it("responde al mensaje SKIP_WAITING (lo que dispara el botón Actualizar)", () => {
    expect(sw).toMatch(/SKIP_WAITING/);
    expect(sw).toMatch(/self\.skipWaiting\s*\(/); // sí existe, pero en el handler de message
  });

  it("nunca cachea /api/* (datos en vivo no se congelan)", () => {
    expect(sw).toMatch(/pathname\.startsWith\(\s*["']\/api\/["']\s*\)/);
  });

  it("activate borra caches viejas (un cambio de estrategia no arrastra basura)", () => {
    expect(sw).toMatch(/caches\.delete/);
    expect(sw).toMatch(/const CACHE = "cuando-v\d+"/); // versión de estrategia presente
  });
});

describe("service worker · generador de versión", () => {
  it("gen-sw-version produce un build id estampando self.__SW_BUILD", () => {
    const gen = readFileSync(join(process.cwd(), "scripts", "gen-sw-version.mjs"), "utf8");
    expect(gen).toMatch(/self\.__SW_BUILD/);
    expect(gen).toMatch(/public.*sw-version\.js|sw-version\.js/);
  });
});
