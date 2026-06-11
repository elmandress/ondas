"use client";

/**
 * "¿Cómo usar Cuándo?" — guía clara de cada función, qué hacer y qué NO esperar.
 * Honesta sobre los límites (horario vs GPS en vivo, cobertura). Se abre desde el
 * botón "?" del header. Mobile-first bottom sheet.
 */
import { motion } from "framer-motion";
import { Icons } from "@/components/brand/Icons";
import { APP_VERSION, APP_UPDATED, WE_DO, WE_DONT } from "@/lib/app-meta";

interface HowToSheetProps { onClose: () => void }

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="howto-section">
      <div className="howto-head">
        <span className="howto-ic">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="howto-body">{children}</div>
    </div>
  );
}

export default function HowToSheet({ onClose }: HowToSheetProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }} onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[6px] z-40"
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="howto-sheet"
      >
        <div className="flex justify-center pt-3 pb-1"><div className="w-8 h-[3px] rounded-full bg-white/15" /></div>
        <div className="howto-header">
          <div>
            <p className="text-eyebrow">Guía rápida</p>
            <h2>¿Cómo usar Cuándo?</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="icon-btn sm"><Icons.Close size={18} /></button>
        </div>

        <div className="howto-scroll">
          <Section icon={<Icons.Clock size={18} />} title="Cuándo salir de tu casa">
            En el inicio, el cartelón grande te dice <b>en cuántos minutos salir</b> para llegar
            justo a la parada y no perder el bondi. Ya le sumamos el tiempo de caminata y un
            margen de unos minutos por si el bus se adelanta. Si dice <b>¡Ya!</b>, salí ahora.
          </Section>

          <Section icon={<Icons.Bus size={18} />} title="Ver qué buses vienen a una parada">
            Tocá una parada (en <b>Inicio</b> → Paradas cercanas, o en el <b>Mapa</b>). Verás
            cada línea con su <b>próxima llegada</b>. El punto <span style={{ color: "var(--live)" }}>verde “en vivo”</span> significa
            que es la posición real del bus por GPS. Si dice <b>“horario”</b>, es el horario
            programado (no GPS) — igual de útil para saber cuándo pasa.
          </Section>

          <Section icon={<Icons.Route size={18} />} title="Ver el recorrido y los horarios de una línea">
            Tocá el número de la línea (el badge). Se abre el <b>recorrido completo</b>: todas
            las paradas en orden, con la <b>hora estimada</b> en cada una, la empresa que la
            opera y su sitio web. Con las flechas ‹ › podés ver las próximas pasadas programadas.
          </Section>

          <Section icon={<Icons.Search size={18} />} title="Planificar un viaje (cómo llegar)">
            Andá a <b>Rutas</b>, poné desde y hacia. Te damos las mejores combinaciones:
            caminás a la parada, te tomás el bondi y te bajás — todo en una línea de tiempo
            clara. Podés elegir <b>“salir más tarde”</b> y agregar <b>paradas intermedias</b>.
          </Section>

          <Section icon={<Icons.Crosshair size={18} />} title="Seguir un bus en el mapa">
            En el panel de una parada, tocá <b>seguir</b> en un bus que esté en vivo: el mapa
            lo centra y muestra <b>solo ese</b>. Para ver de nuevo todos los que vienen, cerrá
            el seguimiento.
          </Section>

          <Section icon={<Icons.Pin size={18} />} title="Montevideo y Canelones">
            Cubrimos <b>Montevideo y todo Canelones metropolitano</b> (Las Piedras, Pando,
            Costa de Oro…) con paradas, recorridos y horarios oficiales. En Montevideo,
            además, ves los buses <b>en vivo</b> por GPS.
          </Section>

          <Section icon={<Icons.Bus size={18} />} title="El interior, en vivo 🇺🇾">
            ¡También el interior! Mostramos buses <b>en tiempo real</b> en
            <b> Maldonado, Punta del Este, San Carlos, Paysandú y Rocha</b>: ves dónde está
            cada bus, su próxima parada y hasta cuántos pasajeros lleva. Vamos sumando más
            ciudades. Para viajes <b>entre departamentos</b> (a Salto, Colonia, etc.) te
            damos las próximas salidas oficiales y desde qué terminal salen.
          </Section>

          <Section icon={<Icons.Wheelchair size={18} />} title="Buena convivencia en el bus">
            Para que viajemos mejor (normas oficiales de la IM): hacé la <b>seña con el brazo</b> en
            la parada; subí con la <b>tarjeta cargada</b>; si vas parado, corré hacia el fondo y
            <b> bajá por la puerta de atrás</b>. <b>Cedé el asiento</b> a personas mayores,
            embarazadas, con bebé o discapacidad, y dejá libre el espacio de sillas de ruedas.
            Auriculares para la música y tono bajo en las llamadas. A bordo no se puede tomar mate,
            fumar, comer ni beber. Con la tarjeta STM podés hacer <b>trasbordos</b> de 1 o 2 horas.
          </Section>

          <div className="howto-honest">
            <Icons.Warn size={15} />
            <span>Nunca inventamos datos. El punto <span style={{ color: "var(--live)" }}>verde “en vivo”</span> es
            posición real por GPS (Montevideo y varias ciudades del interior); si decimos
            <b> “horario”</b> es el oficial programado. Cuando algo es estimado, te lo decimos.</span>
          </div>

          {/* Sobre Cuándo: qué hacemos / qué no (principios verificables) + versión. */}
          <div className="howto-about">
            <h3 className="howto-about-title">Sobre Cuándo</h3>
            <p className="howto-about-lead">
              Una app independiente para moverte en transporte público en Uruguay. Sin ánimo de
              reemplazar a la Intendencia ni a las empresas: tomamos sus datos oficiales y te los
              damos claros, rápidos y honestos.
            </p>

            <div className="howto-cols">
              <div className="howto-col do">
                <div className="howto-col-head"><Icons.Star size={14} /> Qué hacemos</div>
                <ul>{WE_DO.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <div className="howto-col dont">
                <div className="howto-col-head"><Icons.Close size={14} /> Qué no hacemos</div>
                <ul>{WE_DONT.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>

            <p className="howto-version">Cuándo · v{APP_VERSION} · {APP_UPDATED} · hecho en Montevideo 🇺🇾</p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
