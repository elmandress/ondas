"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/brand/Icons";
import { LogoMark } from "@/components/brand/Logo";
import { useThemeMode, setMode, type ThemeMode } from "@/lib/theme";
import { useTextSize, setTextSize, type TextSize } from "@/lib/text-size";
import { isVoiceEnabled, setVoiceEnabled, voiceSupported, speak } from "@/lib/voice-alerts";
import { FARE_VIGENCIA, URBAN_FARES, SUBURBAN_FARES } from "@/lib/fare";
import { useAuth, signInWithEmail, signOut } from "@/lib/auth";

const CLOSE_MS = 340;
const APP_VERSION = "0.8";
const UPDATED = "mayo 2026";
const CONTACT = "neptuno.rossello@gmail.com";

type View = "main" | "comofunciona" | "privacidad" | "terminos" | "datos" | "derechos";

/**
 * Menú de configuración / info / legal (la "tuerquita" del Inicio).
 * Incluye Política de Privacidad, Términos y descargo de responsabilidad, y detalle
 * de datos — redactados en base a la Ley 18.331 (Protección de Datos Personales, UY),
 * Art. 72 de la Constitución y la URCDP. Contenedor de las features futuras de Guille.
 */
export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  const titles: Record<View, string> = {
    main: "Ajustes e info",
    comofunciona: "Cómo funciona Cuándo",
    privacidad: "Política de Privacidad",
    terminos: "Términos y responsabilidad",
    datos: "Qué datos usamos",
    derechos: "Tus derechos como pasajero",
  };

  return (
    <>
      <div className={`sheet-backdrop mobile-only ${open ? "open" : ""}`} onClick={handleClose} />
      <div className={`bottom-sheet ${open ? "open" : ""}`}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          {view === "main" ? (
            <div className="icon"><LogoMark size={24} ring="var(--accent)" dot="var(--accent)" /></div>
          ) : (
            <button className="icon-btn sm" onClick={() => setView("main")} aria-label="Volver">
              <span style={{ transform: "rotate(180deg)", display: "grid" }}><Icons.Chevron size={18} /></span>
            </button>
          )}
          <div className="text">
            <div className="eyebrow">{view === "main" ? `Cuándo · v${APP_VERSION}` : "Cuándo"}</div>
            <div className="name">{titles[view]}</div>
          </div>
          <div className="actions">
            <button className="icon-btn sm" onClick={handleClose} aria-label="Cerrar"><Icons.Close size={18} /></button>
          </div>
        </div>

        <div className="sheet-arrivals scrollbar-none" style={{ paddingBottom: 8 }}>
          {view === "main" && <MainView go={setView} />}
          {view === "comofunciona" && <ComoFuncionaView />}
          {view === "derechos" && <DerechosView />}
          {view === "privacidad" && <PrivacyView />}
          {view === "terminos" && <TermsView />}
          {view === "datos" && <DataView />}
        </div>
      </div>
    </>
  );
}

function MainView({ go }: { go: (v: View) => void }) {
  return (
    <>
      <AccountSection />

      <Section title="Apariencia">
        <ThemeChooser />
        <div style={{ height: 14 }} />
        <TextSizeChooser />
      </Section>

      <Section title="Accesibilidad">
        <VoiceAlertChooser />
      </Section>

      <Section title="Entender la app">
        <NavRow icon={<Icons.Bus size={18} />} title="Cómo funciona Cuándo" sub="De dónde sacamos los datos y cómo los calculamos" onClick={() => go("comofunciona")} />
        <NavRow icon={<Icons.Wheelchair size={18} />} title="Tarifas y tus derechos" sub="Precios del boleto, pases libres, asientos y convivencia" onClick={() => go("derechos")} />
      </Section>

      <Section title="Privacidad">
        <Row icon={<Icons.Crosshair size={18} />} title="Tu ubicación es tuya" sub="El GPS solo se usa si lo permitís. No la guardamos ni te seguimos." />
        <Row icon={<Icons.Star size={18} />} title="Sin cuenta, sin login" sub="Tus favoritos y recientes viven solo en tu teléfono." />
        <AnalyticsToggle />
      </Section>

      <Section title="Funciones activas">
        <Row icon={<Icons.Bus size={18} />} title="Tiempo real (cuando hay GPS)" sub="Llegadas en vivo del STM; si la API se cae, mostramos el horario." />
        <Row icon={<Icons.Walk size={18} />} title="Caminatas reales por la vereda" sub="Seguimos las calles ignorando el sentido (un peatón no tiene mano única)." />
        <Row icon={<Icons.Clock size={18} />} title="Aviso de hora pico" sub="Te avisamos en la franja 7–9 / 17–20 hábiles. Orientativo, con base real." />
        <Row icon={<Icons.Wheelchair size={18} />} title="Accesibilidad y aire acondicionado" sub="Dato oficial por ómnibus (piso bajo / AC) cuando la API lo informa." />
        <Row icon={<Icons.Wifi size={18} />} title="WiFi en líneas eléctricas" sub="Solo en líneas confirmadas 100% eléctricas (CA1·CE1, D1·DE1, 14·E14)." />
        <Row icon={<Icons.Route size={18} />} title="Taxi/Uber sugerido de noche" sub="Opción secundaria: si el último tramo a pie es de noche y poco transitado, te lo ofrecemos." />
      </Section>

      <Section title="En camino">
        <Row icon={<Icons.Pin size={18} />} title="Rutas guardadas por dirección" sub="Guardar 'casa → trabajo' por direcciones, con origen editable." dim />
      </Section>

      <Section title="Legal">
        <NavRow icon={<Icons.Star size={18} />} title="Política de Privacidad" onClick={() => go("privacidad")} />
        <NavRow icon={<Icons.Warn size={18} />} title="Términos y responsabilidad" onClick={() => go("terminos")} />
        <NavRow icon={<Icons.Bus size={18} />} title="Qué datos usamos" onClick={() => go("datos")} />
      </Section>

      <Section title="Datos del transporte">
        <Row icon={<Icons.Bus size={18} />} title="Datos oficiales del STM" sub="Intendencia de Montevideo · en tiempo real cuando está disponible." />
        <LinkRow href="https://www.montevideo.gub.uy/transporte-y-stm" title="Sitio del STM Montevideo" />
        <LinkRow href="https://montevideo.gub.uy/buzon-ciudadano" title="Reportar al Buzón Ciudadano IM" />
      </Section>

      <div style={{ padding: "8px 22px 2px", font: "var(--font-small)", color: "var(--text-3)", textAlign: "center" }}>
        Cuándo · v{APP_VERSION} · {UPDATED}<br />Contacto: {CONTACT}
      </div>
      <div style={{ padding: "10px 22px 18px", font: "var(--font-small)", color: "var(--text-3)", textAlign: "center" }}>
        Hecho en Montevideo 🇺🇾 · El bondi te espera. Vos no.
      </div>
    </>
  );
}

// ─── Cómo funciona Cuándo (transparencia / "cómo funcionamos") ─────────
function ComoFuncionaView() {
  return (
    <Legal>
      <P muted>En una: tomamos los datos oficiales del transporte de <b>todo Uruguay</b> y te los mostramos
        claros y rápidos. Cuando no podemos saber algo con certeza, te lo decimos — preferimos ser
        honestos antes que inventar.</P>

      <H>De dónde salen los datos</H>
      <P><b>Montevideo:</b> información oficial del <b>STM (Intendencia de Montevideo)</b> — la API en vivo
        de posiciones y llegadas + el <b>GTFS oficial</b> (líneas, paradas, recorridos y horarios).</P>
      <P><b>Canelones metropolitano</b> (Las Piedras, Pando, Costa de Oro…): el <b>GTFS metropolitano
        oficial del MTOP</b> (paradas, recorridos y horarios).</P>
      <P><b>Interior, en vivo:</b> los sistemas de seguimiento públicos de cada ciudad/empresa
        — <b>Maldonado (CODESA), San Carlos, Paysandú (COPAY) y Rocha</b> — que publican la posición
        GPS de sus buses. Mostramos esa posición real, con su próxima parada y ocupación.</P>
      <P><b>Entre departamentos:</b> los <b>horarios oficiales interdepartamentales del MTOP</b> (DNT).
        No inventamos recorridos ni horarios.</P>

      <H>“En vivo” vs “horario”</H>
      <P>Cuando el ómnibus reporta su <b>GPS</b>, ves la posición/llegada <b>en vivo</b> (puntito verde) —
        en Montevideo y en las ciudades del interior que listamos arriba. Si en ese momento no hay
        posición, mostramos la mejor <b>estimación por horario</b> programado y te lo aclaramos. Si la
        fuente oficial se cae, seguimos mostrando los horarios en vez de dejarte sin nada.</P>

      <H>Cómo sabemos que el bus va hacia tu parada</H>
      <P>Filtramos por el <b>recorrido real</b> de cada variante (GTFS): solo te mostramos ómnibus que
        todavía <b>no pasaron</b> tu parada y van en tu sentido. Por eso a veces ves menos buses que en
        otras apps — pero los que ves, realmente te sirven.</P>

      <H>Cómo calculamos la llegada</H>
      <P>Con GPS, estimamos por <b>distancia y velocidad</b> sobre el recorrido. Sin GPS, usamos el
        <b> horario programado</b>. Son <b>estimaciones</b>, no garantías.</P>

      <H>Hora pico</H>
      <P>Te avisamos dentro de las franjas de mayor demanda en días hábiles (<b>7–9 h</b> y <b>17–20 h</b>),
        según el informe de tránsito de la IM. Es un <b>aviso orientativo</b>: no cambiamos los números, solo
        te recordamos que el horario puede quedar corto y los buses ir más llenos.</P>

      <H>Accesibilidad, aire y WiFi (qué es real)</H>
      <P>• <b>Accesibilidad</b> (piso bajo) y <b>aire acondicionado</b>: dato oficial <b>por ómnibus</b>,
        cuando la API lo informa. • <b>WiFi</b>: solo lo marcamos en las líneas <b>confirmadas 100%
        eléctricas</b> (flota BYD con WiFi/USB). Como los eléctricos rotan por toda la red y la API no dice
        WiFi por bus, no lo afirmamos en el resto. Honestidad antes que adornos.</P>

      <H>Caminatas y rutas</H>
      <P>Las caminatas siguen las <b>calles reales por la vereda</b>, ignorando el sentido del tránsito
        (caminando no hay mano única), así no te hacemos dar la vuelta a la manzana. Las rutas se arman con
        el <b>motor GTFS oficial</b>, mostrando todas las líneas que te sirven para ese tramo.</P>

      <H>Taxi/Uber de noche (seguridad)</H>
      <P>Cuando el <b>último tramo a pie</b> cae de noche en una zona poco transitada, te ofrecemos —como
        <b> opción secundaria</b>, nunca la principal— bajar en la última parada y seguir en taxi o Uber.
        Lo hacemos con base en <b>datos oficiales de criminalidad</b> (Observatorio del Ministerio del
        Interior). <b>No</b> es un juicio sobre barrios ni sobre la gente que vive ahí, ni los nombramos:
        es solo un cuidado hacia vos cuando caminás de noche. El bus siempre es la opción principal.</P>

      <H>Tu privacidad</H>
      <P>Sin cuenta ni login. El GPS se usa solo con tu permiso y <b>no lo guardamos</b>. Tus favoritos y
        recientes viven solo en tu teléfono. Más detalle en la Política de Privacidad.</P>
    </Legal>
  );
}

// ─── Tus derechos como pasajero (contenido curado de reglamentos oficiales) ───
function DerechosView() {
  return (
    <Legal>
      <P muted>Resumen claro de tus derechos y deberes en el transporte público, según la
        normativa oficial. No es asesoramiento legal; ante dudas, consultá el reglamento de tu
        departamento (links abajo).</P>

      <H>💳 Tarifas — valores vigentes a {FARE_VIGENCIA}</H>
      <p style={{ font: "600 11px/1 var(--ff)", color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "2px 0 4px" }}>Urbano Montevideo</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "0 0 8px" }}>
        {([
          ["Común / 1 hora — tarjeta STM", `$${URBAN_FARES.hora_stm}`],
          ["Común / 1 hora — efectivo", `$${URBAN_FARES.hora_efectivo}`],
          ["Jubilado/a A — tarjeta / efectivo", `$${URBAN_FARES.jubilado_a_stm} / $${URBAN_FARES.jubilado_a_efectivo}`],
          ["Jubilado/a B — tarjeta / efectivo", `$${URBAN_FARES.jubilado_b_stm} / $${URBAN_FARES.jubilado_b_efectivo}`],
          ["Estudiante A — tarjeta", `$${URBAN_FARES.estudiante_a}`],
          ["Estudiante B — tarjeta", `$${URBAN_FARES.estudiante_b}`],
        ] as const).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, font: "var(--font-small)" }}>
            <span style={{ color: "var(--text-2)" }}>{k}</span>
            <span style={{ color: "var(--text)", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>
      <p style={{ font: "600 11px/1 var(--ff)", color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "2px 0 4px" }}>Suburbano / metropolitano (desde 01/06/2026)</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "0 0 8px" }}>
        {([
          ["Dentro de Montevideo", `$${SUBURBAN_FARES.dentro_mvd}`],
          ["Hasta 32 km", `$${SUBURBAN_FARES.hasta_32km}`],
          ["Hasta 40 km", `$${SUBURBAN_FARES.hasta_40km}`],
          ["Hasta 60 km", `$${SUBURBAN_FARES.hasta_60km}`],
          ["Jubilado/a", `$${SUBURBAN_FARES.jubilado}`],
        ] as const).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, font: "var(--font-small)" }}>
            <span style={{ color: "var(--text-2)" }}>{k}</span>
            <span style={{ color: "var(--text)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        ))}
      </div>
      <P muted>El boleto de 1 hora permite 1 transbordo dentro de los 60 min. Valores
        orientativos — la tarifa real la cobra el STM según tu tarjeta y categoría.</P>

      <H>Convivencia y asientos (todo el país)</H>
      <P>Tenés <b>prioridad de asiento</b> si sos persona mayor, con discapacidad, embarazada o vas
        con bebé. Hacé la <b>seña con el brazo</b> en la parada, esperá en la vereda y subí con la
        <b> tarjeta cargada</b>. A bordo no se puede <b>tomar mate, fumar, comer ni beber</b>.</P>

      <H>Tarjeta STM y trasbordos (área metropolitana)</H>
      <P>Con la <b>tarjeta STM</b> podés hacer <b>trasbordos</b> dentro de 1 o 2 horas según el
        boleto, pagando una sola vez. Hay <b>boleto estudiantil gratuito</b> y beneficios por el
        régimen de precios del STM 2.0. Guardá el comprobante hasta terminar el viaje.</P>

      <H>Pases libres y boletos gratuitos</H>
      <P>Varios departamentos tienen <b>pases libres</b> y boletos gratuitos: estudiantes, docentes,
        personas con discapacidad y otras categorías, según la ordenanza local (ej. Rivera regula
        pases libres y boleto gratuito; Cerro Largo, boleto gratis para maestros/as y profesores/as).</P>

      <H>Terminales y tasas de embarque</H>
      <P>En viajes interdepartamentales podés pagar una <b>tasa de embarque</b> en la terminal
        (ej. Maldonado, Paysandú, Rivera). Cada terminal tiene su reglamento de uso.</P>

      <H>Reglamentos oficiales</H>
      <P>Nacional: <b>Decreto 18/991 — Reglamento General de Ómnibus</b> y normas del STM 2.0.
        Cada departamento tiene su ordenanza de transporte colectivo (Montevideo, Canelones,
        Maldonado, Colonia, Florida, Rivera, Rocha, San José, Soriano, Tacuarembó, Treinta y Tres,
        entre otros). Buscá “reglamento de transporte” + tu departamento, o consultá comomemuevo.uy.</P>

      <P muted>Fuente: normativa de la IM, MTOP/DNT e intendencias departamentales. Resumen
        orientativo de Cuándo; la norma vigente prevalece.</P>
    </Legal>
  );
}

// ─── Política de Privacidad ───────────────────────────────────────────
function PrivacyView() {
  return (
    <Legal>
      <P muted>Última actualización: {UPDATED}. Esta política se rige por la <b>Ley N.º 18.331</b> de
        Protección de Datos Personales y Acción de Habeas Data de Uruguay, el Art. 72 de la
        Constitución y las directrices de la URCDP/AGESIC.</P>

      <H>Quiénes somos</H>
      <P>“Cuándo” es una aplicación independiente para consultar el transporte público de Montevideo
        (STM). No somos un operador de transporte ni la Intendencia.</P>

      <H>Qué datos tratamos y para qué</H>
      <P>• <b>Ubicación (GPS)</b>: solo si nos das permiso explícito. La usamos para mostrarte paradas
        cercanas y calcular rutas y caminatas. Tus coordenadas se envían puntualmente a nuestros
        servicios y a servicios de mapas (ej. Nominatim/OSRM) <b>de forma anónima</b>, sin asociarte
        a una identidad, y <b>no las almacenamos</b>.</P>
      <P>• <b>Preferencias</b> (favoritos, búsquedas recientes, rutas guardadas): se guardan
        <b> únicamente en tu dispositivo</b> (almacenamiento local). No salen de tu teléfono.</P>
      <P>• <b>No usamos cuentas ni login.</b> No recopilamos nombre, email ni identificadores tuyos.</P>

      <H>Finalidad y consentimiento</H>
      <P>Tratamos los datos solo para las finalidades declaradas (Ley 18.331, art. 8). Al conceder el
        permiso de ubicación prestás tu consentimiento informado, libre y revocable: podés quitarlo
        desde los ajustes de tu teléfono en cualquier momento.</P>

      <H>Con quién se comparten</H>
      <P>No vendemos ni cedemos tus datos personales. Solo se envían coordenadas anónimas a los
        servicios técnicos necesarios (mapas/geocoding) para que la app funcione.</P>

      <H>Transferencias internacionales</H>
      <P>Algunos servicios de mapas pueden operar fuera de Uruguay. Solo se les envían coordenadas
        anónimas, no datos que te identifiquen (conforme art. 23 de la Ley 18.331).</P>

      <H>Tus derechos (Habeas Data)</H>
      <P>Tenés derecho de acceso, rectificación, actualización y supresión. Como no guardamos datos
        asociados a tu identidad, podés ejercerlos borrando los datos locales de la app o escribiéndonos
        a <b>{CONTACT}</b>. La autoridad de control es la <b>URCDP</b> (urcdp.gub.uy).</P>

      <H>Seguridad y menores</H>
      <P>Aplicamos medidas razonables para proteger la información. La app no está dirigida a menores de
        13 años ni recopila datos de ellos a sabiendas.</P>
    </Legal>
  );
}

// ─── Términos y descargo de responsabilidad ───────────────────────────
function TermsView() {
  return (
    <Legal>
      <P muted>Última actualización: {UPDATED}. Al usar “Cuándo” aceptás estos términos.</P>

      <H>Fuente de los datos</H>
      <P>La información de líneas, paradas y posiciones proviene del <b>STM / Intendencia de
        Montevideo</b> y de datos abiertos. “Cuándo” no opera el transporte ni controla esos datos.</P>

      <H>Tiempo real y estimaciones</H>
      <P>El tiempo real <b>depende de la API oficial</b>, que puede fallar, demorar o ser imprecisa.
        Los tiempos de llegada, recorridos y horarios son <b>estimaciones, no garantías</b>. No tomes
        decisiones críticas basándote únicamente en la app.</P>

      <H>Ocupación y horas pico</H>
      <P>Cualquier estimación de “qué tan lleno viene” u horas pico es <b>orientativa</b>, basada en
        patrones y horarios, no en un dato en vivo por ómnibus.</P>

      <H>Sugerencias de terceros (taxi / Uber)</H>
      <P>Si sugerimos combinar con taxi o apps de movilidad, son <b>servicios de terceros</b>: no
        controlamos sus precios, disponibilidad ni calidad. Los costos mostrados son <b>estimados</b> y
        pueden no coincidir con el real.</P>

      <H>Información de seguridad</H>
      <P>Cualquier aviso o sugerencia relacionada con seguridad o zonas se basa en <b>información
        pública y general</b>, es meramente <b>orientativa</b>, <b>no</b> constituye una afirmación sobre
        personas o comunidades, y <b>no garantiza</b> tu seguridad. Usá siempre tu propio criterio.</P>

      <H>Limitación de responsabilidad</H>
      <P>Usás “Cuándo” bajo tu propia responsabilidad. En la máxima medida permitida por la ley, no
        respondemos por perjuicios derivados de imprecisiones, indisponibilidad del servicio o
        decisiones tomadas en base a la app.</P>
    </Legal>
  );
}

// ─── Qué datos usamos (transparencia) ─────────────────────────────────
function DataView() {
  return (
    <Legal>
      <H>Resumen transparente</H>
      <DataItem label="Ubicación (GPS)" value="Solo con permiso. No se almacena. Se usa para paradas cercanas y rutas." />
      <DataItem label="Favoritos y recientes" value="Solo en tu dispositivo (localStorage). Podés borrarlos." />
      <DataItem label="Cuenta / login" value="No. No pedimos email, nombre ni identificadores." />
      <DataItem label="Analítica / rastreo" value="No usamos rastreadores publicitarios de terceros." />
      <DataItem label="Servicios externos" value="Mapas/geocoding (Nominatim, OSRM, CARTO) reciben solo coordenadas anónimas." />
      <P muted style={{ marginTop: 14 }}>Querés borrar todo lo que la app guardó en tu teléfono: borrá los datos de la
        app desde los ajustes de Android, o limpiá el almacenamiento del navegador.</P>
    </Legal>
  );
}

// ─── Selector de tema (Auto / Claro / Oscuro) ─────────────────────────
function ThemeChooser() {
  const mode = useThemeMode();
  const opts: { k: ThemeMode; label: string }[] = [
    { k: "auto", label: "Auto" },
    { k: "light", label: "Claro" },
    { k: "dark", label: "Oscuro" },
  ];
  return (
    <div style={{ padding: "4px 0 6px" }}>
      <div style={{ display: "flex", gap: 7 }}>
        {opts.map((o) => (
          <button
            key={o.k}
            onClick={() => setMode(o.k)}
            aria-pressed={mode === o.k}
            style={{
              flex: 1, padding: "10px 0", borderRadius: "var(--r-chip)", font: "600 13px/1 var(--ff)",
              color: mode === o.k ? "var(--accent)" : "var(--text-2)",
              background: mode === o.k ? "var(--accent-soft)" : "var(--surface)",
              border: `1px solid ${mode === o.k ? "var(--accent-border)" : "var(--border)"}`,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 8 }}>
        Auto: de noche se pone oscuro (descanso visual) y de día sigue a tu teléfono. El oscuro es el modo de la casa.
      </div>
    </div>
  );
}

function TextSizeChooser() {
  const size = useTextSize();
  const opts: { k: TextSize; label: string }[] = [
    { k: "normal", label: "Normal" },
    { k: "grande", label: "Texto grande" },
  ];
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Tamaño de texto</div>
      <div style={{ display: "flex", gap: 7 }}>
        {opts.map((o) => (
          <button
            key={o.k}
            onClick={() => setTextSize(o.k)}
            aria-pressed={size === o.k}
            style={{
              flex: 1, padding: "10px 0", borderRadius: "var(--r-chip)",
              font: o.k === "grande" ? "700 16px/1 var(--ff)" : "600 13px/1 var(--ff)",
              color: size === o.k ? "var(--accent)" : "var(--text-2)",
              background: size === o.k ? "var(--accent-soft)" : "var(--surface)",
              border: `1px solid ${size === o.k ? "var(--accent-border)" : "var(--border)"}`,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 8 }}>
        Agranda los textos importantes para leerlos más fácil.
      </div>
    </div>
  );
}

// Estadísticas anónimas: opt-OUT. Por defecto ON (eventos sin PII ayudan a mejorar la
// app), pero el usuario puede apagarlo. Coherente con privacidad: nunca identifica a nadie.
function AnalyticsToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => { try { setOff(localStorage.getItem("cuando_no_analytics") === "1"); } catch {} }, []);
  return (
    <button
      onClick={() => {
        const next = !off;
        setOff(next);
        try { localStorage.setItem("cuando_no_analytics", next ? "1" : "0"); } catch {}
      }}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", width: "100%", textAlign: "left" }}
    >
      <span style={{ color: "var(--text-2)", display: "grid", placeItems: "center", width: 38, height: 38, flexShrink: 0 }}>
        <Icons.Help size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "var(--font-card)", color: "var(--text)" }}>Estadísticas anónimas</div>
        <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 2 }}>
          {off ? "Apagadas. No medimos nada." : "Eventos sin datos personales para mejorar la app. Tocá para apagar."}
        </div>
      </div>
      <span style={{ width: 44, height: 26, borderRadius: 999, background: off ? "var(--surface)" : "var(--accent)", position: "relative", flexShrink: 0, border: `1px solid ${off ? "var(--border)" : "var(--accent)"}`, transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 2, left: off ? 2 : 20, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
      </span>
    </button>
  );
}

// Cuenta (opcional) — sincroniza favoritos/rutas entre dispositivos. Magic link por
// email, sin contraseñas. Solo aparece si Supabase está configurado (env vars); si no,
// no se muestra y la app sigue 100% sin cuenta. La cuenta es OPT-IN, nunca obligatoria.
function AccountSection() {
  const { enabled, loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!enabled || loading) return null; // sin Supabase o resolviendo: no mostramos nada

  if (user) {
    return (
      <Section title="Tu cuenta">
        <Row
          icon={<Icons.Star size={18} />}
          title={user.email ?? "Sesión iniciada"}
          sub="Tus favoritos y rutas se sincronizan en tus dispositivos."
        />
        <button
          onClick={() => signOut()}
          style={{ marginTop: 4, alignSelf: "flex-start", font: "600 13px/1 var(--ff)", color: "var(--text-2)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-chip)", padding: "9px 14px" }}
        >
          Cerrar sesión
        </button>
      </Section>
    );
  }

  async function send() {
    const e = email.trim();
    if (!e || !e.includes("@")) { setErr("Poné un email válido."); return; }
    setBusy(true); setErr(null);
    const r = await signInWithEmail(e);
    setBusy(false);
    if (r.ok) setSent(true);
    else setErr(r.error ?? "No se pudo enviar el enlace.");
  }

  return (
    <Section title="Tu cuenta (opcional)">
      {sent ? (
        <div style={{ font: "var(--font-small)", color: "var(--text-2)", padding: "6px 0" }}>
          Te mandamos un enlace a <b>{email}</b>. Abrilo desde este teléfono para iniciar sesión.
        </div>
      ) : (
        <>
          <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginBottom: 8 }}>
            Guardá tus favoritos y rutas en la nube para tenerlos en todos tus dispositivos. Sin contraseñas: te llega un enlace al email.
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <input
              type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com"
              value={email} onChange={(ev) => setEmail(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === "Enter") send(); }}
              style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--r-chip)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", font: "500 14px/1 var(--ff)" }}
            />
            <button
              onClick={send} disabled={busy}
              style={{ padding: "10px 16px", borderRadius: "var(--r-chip)", background: "var(--accent)", color: "#1a1206", font: "700 13px/1 var(--ff)", border: "none", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "…" : "Entrar"}
            </button>
          </div>
          {err && <div style={{ font: "var(--font-small)", color: "#f87171", marginTop: 6 }}>{err}</div>}
        </>
      )}
    </Section>
  );
}

// Avisos por voz al seguir un bus ("preparate / bajate ahora") — manos libres y
// para quien ve poco. Opt-in: por defecto está apagado (nadie quiere que la app hable
// sin permiso). Solo aparece si el navegador soporta síntesis de voz.
function VoiceAlertChooser() {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(voiceSupported());
    setOn(isVoiceEnabled());
  }, []);
  if (!supported) return null;
  const opts = [
    { k: false, label: "Apagado" },
    { k: true, label: "Avisos por voz" },
  ];
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Avisos por voz</div>
      <div style={{ display: "flex", gap: 7 }}>
        {opts.map((o) => (
          <button
            key={String(o.k)}
            onClick={() => {
              setVoiceEnabled(o.k);
              setOn(o.k);
              if (o.k) speak("Listo. Te voy a avisar cuando tu bus esté por llegar.");
            }}
            aria-pressed={on === o.k}
            style={{
              flex: 1, padding: "10px 0", borderRadius: "var(--r-chip)",
              font: "600 13px/1 var(--ff)",
              color: on === o.k ? "var(--accent)" : "var(--text-2)",
              background: on === o.k ? "var(--accent-soft)" : "var(--surface)",
              border: `1px solid ${on === o.k ? "var(--accent-border)" : "var(--border)"}`,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 8 }}>
        Cuando seguís un bus hacia tu parada, te avisamos en voz alta (&ldquo;preparate&rdquo;, &ldquo;¡bajate ahora!&rdquo;) sin que mires la pantalla.
      </div>
    </div>
  );
}

// ─── primitivas ───────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 22px 4px" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>
    </div>
  );
}

function Row({ icon, title, sub, dim }: { icon: React.ReactNode; title: string; sub: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "10px 0", opacity: dim ? 0.62 : 1 }}>
      <span style={{ color: "var(--text-2)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "600 14px/1.3 var(--ff)", color: "var(--text)" }}>{title}</div>
        <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function NavRow({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", width: "100%", textAlign: "left", color: "var(--text)" }}>
      <span style={{ color: "var(--text-2)", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", font: "600 14px/1.3 var(--ff)" }}>{title}</span>
        {sub && <span style={{ display: "block", font: "var(--font-small)", color: "var(--text-3)", marginTop: 2 }}>{sub}</span>}
      </span>
      <Icons.Chevron size={16} />
    </button>
  );
}

function LinkRow({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", color: "var(--text)" }}>
      <span style={{ color: "var(--accent)", flexShrink: 0 }}><Icons.Chevron size={16} /></span>
      <span style={{ font: "600 14px/1.3 var(--ff)", flex: 1 }}>{title}</span>
    </a>
  );
}

function Legal({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "6px 22px 20px" }}>{children}</div>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h3 style={{ font: "700 14px/1.3 var(--ff)", color: "var(--text)", margin: "16px 0 6px" }}>{children}</h3>;
}
function P({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return <p style={{ font: "400 13px/1.6 var(--ff)", color: muted ? "var(--text-3)" : "var(--text-2)", marginBottom: 8, ...style }}>{children}</p>;
}
function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ font: "600 13px/1.3 var(--ff)", color: "var(--text)" }}>{label}</div>
      <div style={{ font: "400 12px/1.5 var(--ff)", color: "var(--text-3)", marginTop: 2 }}>{value}</div>
    </div>
  );
}
