# Cuándo — transporte público de Uruguay

PWA mobile-first con llegadas en tiempo real, ruteo, mapa en vivo y SEO de intención
("¿cuándo pasa el 103?"). Next.js 16 + React 19 + TypeScript + Supabase (degradable).

## Documentación (3 docs, fuente de verdad)
- **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)** — qué es, stack, estructura, flujo de datos, decisiones técnicas.
- **[docs/AUDITORIA-MAESTRA.md](docs/AUDITORIA-MAESTRA.md)** — QA, seguridad, riesgos, deuda técnica, cola priorizada e historial.
- **[docs/DESARROLLO.md](docs/DESARROLLO.md)** — comandos, deploy (Netlify+Supabase), testing, convenciones, Android/PWA.

(`supabase/README.md` cubre el esquema; `AGENTS.md` son notas para el asistente de IA.)

## Arranque rápido
```bash
npm install
npm run dev      # :3000
```
La app corre **sin variables de entorno** (degrada a horarios y sin sync). Para datos en
vivo y favoritos sincronizados, ver las env vars en [docs/DESARROLLO.md](docs/DESARROLLO.md).

## Verificación (Definition of Done)
```bash
npx tsc --noEmit && npx eslint src/ && npx vitest run && npm run build
```
