/**
 * Serializa JSON-LD para incrustar en un script de tipo ld+json de forma SEGURA.
 * JSON.stringify NO escapa < > & (un valor con </script> podria romper el bloque e
 * inyectar codigo = XSS). Convertimos esos chars y los separadores U+2028/U+2029 a su
 * secuencia de escape JSON. Defense-in-depth: hoy los datos son oficiales (GTFS), pero
 * un dato raro o comprometido no debe poder ejecutar nada.
 *
 * El backslash se construye con fromCharCode(92) para que ningun formateador lo colapse.
 */
const BS = String.fromCharCode(92); // "\"
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, BS + "u003c")
    .replace(/>/g, BS + "u003e")
    .replace(/&/g, BS + "u0026")
    .replace(new RegExp(LS, "g"), BS + "u2028")
    .replace(new RegExp(PS, "g"), BS + "u2029");
}
