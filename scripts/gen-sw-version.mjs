/**
 * Genera public/sw-version.js con un identificador ÚNICO por build.
 *
 * EL BUG QUE ARREGLA (P0): el navegador solo detecta una actualización del Service
 * Worker si los BYTES de sw.js (o de un script que importa) cambian. Nuestros deploys
 * de solo-código no tocan sw.js → el navegador nunca veía un SW nuevo → el prompt
 * "Hay una nueva versión · Actualizar" NUNCA aparecía → los usuarios instalados
 * quedaban pegados a la versión vieja sin enterarse.
 *
 * sw.js hace `importScripts("/sw-version.js")`. Como Chrome 68+ re-descarga también los
 * scripts importados en el chequeo de update, cambiar ESTE archivo por build alcanza para
 * que el navegador detecte el SW nuevo. sw.js queda estable (no se ensucia el git);
 * sw-version.js es generado y va en .gitignore.
 *
 * Corre como `prebuild` (antes de `next build`), local y en Netlify.
 */
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

function buildId() {
  // Netlify expone COMMIT_REF; si no, hash corto de git; si no, timestamp.
  const ref = process.env.COMMIT_REF;
  let git = "";
  try { git = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* sin git */ }
  const base = ref || git || "nogit";
  return `${base}-${Date.now()}`;
}

const id = buildId();
const out = join(process.cwd(), "public", "sw-version.js");
// CLAVE: cambiar self.__SW_BUILD por build es lo que dispara el `updatefound`.
writeFileSync(out, `// Generado por scripts/gen-sw-version.mjs — NO editar a mano.\nself.__SW_BUILD = ${JSON.stringify(id)};\n`, "utf8");
console.log(`[sw-version] public/sw-version.js → __SW_BUILD=${id}`);
