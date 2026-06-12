const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');
const proj4 = require('proj4');

// El shapefile v_uptu_lsv viene en UTM zone 21S (EPSG:32721, metros) — NO en lat/lon.
// Reproyectamos a WGS84 (EPSG:4326, grados) que es lo que consume Leaflet y el resto
// de la app (paradas, vehículos, planner). El .prj lo confirma: central_meridian -57,
// scale 0.9996, false_easting 500000, false_northing 10000000.
const UTM21S = '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
const toLatLon = proj4(UTM21S, WGS84);

// Shapefile oficial del SIT (IM): v_uptu_lsv = línea-sentido-variante con su recorrido.
// El server redirige http→https; fetch() de Node sigue el redirect solo.
const SHP_GENERATOR_URL = 'https://intgis.montevideo.gub.uy/sit/php/common/datos/generar_zip2.php?nom_tab=v_uptu_lsv&tipo=gis';
const ZIP_URL = 'https://intgis.montevideo.gub.uy/sit/tmp/v_uptu_lsv.zip';
const OUT_PATH = path.join(__dirname, '../public/routes.json');
// line-shapes.json: línea comercial → [cod_variantes con shape]. Es el índice que el
// cliente usa para encontrar las shapes de una línea (routes.json va por cod_variante).
// R57: antes este archivo NO tenía generador (quedó congelado al 2026-06-01 y envejecía
// en silencio); ahora se regenera SIEMPRE junto con routes.json, del mismo feed.
const LINE_SHAPES_PATH = path.join(__dirname, '../public/line-shapes.json');
const TMP_DIR = path.join(__dirname, '../tmp_shape');

async function processRoutes() {
  console.log('Generando shapefile v_uptu_lsv en servidor...');

  try {
    await fetch(SHP_GENERATOR_URL);
    await new Promise(r => setTimeout(r, 2500)); // esperar a que el server arme el zip

    console.log('Descargando shapefile v_uptu_lsv...');
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    console.log('Descomprimiendo zip...');
    const zip = new AdmZip(buffer);
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    zip.extractAllTo(TMP_DIR, true);

    const files = fs.readdirSync(TMP_DIR);
    const shpFile = files.find(f => f.endsWith('.shp'));
    const dbfFile = files.find(f => f.endsWith('.dbf'));
    if (!shpFile || !dbfFile) {
      throw new Error('Faltan archivos .shp o .dbf en el ZIP');
    }

    console.log('Parseando shapefile...');
    const source = await shapefile.open(
      path.join(TMP_DIR, shpFile),
      path.join(TMP_DIR, dbfFile)
    );

    // routesMap keya por COD_VARIANTE pelado (String) — es lo que consumen
    // bus-direction.ts, LeafletMap.tsx y route-planner-gtfs.ts: routes[String(variantCode)].
    // NO guardamos key por nombre de línea: era la causa del bug (las variantes sin
    // shape caían a routes[lineName] = el recorrido de OTRA variante → camino equivocado).
    const routesMap = {};
    const lineVariants = {};   // lineCode -> Set(cod_variante) (para reporte de cobertura)
    const variantHasShape = new Set();
    let count = 0;

    while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      const props = feature.properties || {};
      // OJO: el DBF trunca los nombres de campo a 10 chars → COD_VARIAN (no COD_VARIANTE),
      // DESC_VARIA, DESC_LINEA. Mantener fallbacks por si el feed cambia.
      const lineCode = props.DESC_LINEA || props.LINEA;
      const codVariante = props.COD_VARIAN ?? props.COD_VARIANTE;
      if (codVariante == null) continue;

      const geometry = feature.geometry;
      let raw = [];
      if (geometry && geometry.type === 'LineString') {
        raw = geometry.coordinates;
      } else if (geometry && geometry.type === 'MultiLineString') {
        raw = geometry.coordinates.flat();
      }
      // raw viene en UTM [easting, northing]. proj4 → [lon, lat]; guardamos [lat, lon]
      // con 5 decimales de GRADO (~1.1m de precisión, suficiente para el trazo).
      const coordinates = raw.map((c) => {
        const [lon, lat] = toLatLon.forward([c[0], c[1]]);
        return [Number(lat.toFixed(5)), Number(lon.toFixed(5))];
      });

      if (lineCode) (lineVariants[lineCode] ||= new Set()).add(String(codVariante));

      if (coordinates.length >= 2) {
        routesMap[String(codVariante)] = coordinates;
        variantHasShape.add(String(codVariante));
      }
      count++;
    }

    // Merge anti-regresión: el feed oficial a veces deja de publicar variantes que
    // antes sí tenía (líneas renumeradas/discontinuadas). Para no perder cobertura,
    // conservamos del routes.json ANTERIOR las keys de VARIANTE (numéricas) que el
    // feed fresco ya no trae. Las shapes frescas siempre ganan (más detalle + WGS84).
    let carried = 0;
    const PREV_PATH = fs.existsSync(OUT_PATH + '.bak') ? OUT_PATH + '.bak' : OUT_PATH;
    if (fs.existsSync(PREV_PATH)) {
      try {
        const prev = JSON.parse(fs.readFileSync(PREV_PATH, 'utf-8'));
        for (const [k, poly] of Object.entries(prev)) {
          // solo variantes (clave numérica) ya en lat/lon y no presentes en lo fresco
          if (/^[0-9]+$/.test(k) && !routesMap[k] && Array.isArray(poly) && poly.length >= 2) {
            const [lat, lon] = poly[0];
            const inMvd = lat < -34.5 && lat > -35.2 && lon < -55.8 && lon > -56.6;
            if (inMvd) { routesMap[k] = poly; carried++; }
          }
        }
      } catch { /* si el anterior no parsea, seguimos solo con lo fresco */ }
    }

    fs.writeFileSync(OUT_PATH, JSON.stringify(routesMap));
    if (carried) console.log(`Conservadas ${carried} variantes del feed anterior que el feed fresco ya no publica.`);

    // line-shapes.json desde el MISMO feed: solo variantes que realmente tienen shape.
    // Keys = DESC_LINEA tal cual viene (el cliente canonicaliza a mayúsculas al cargar).
    const lineShapesOut = {};
    for (const [line, variants] of Object.entries(lineVariants)) {
      const withShape = [...variants].filter(v => variantHasShape.has(v)).sort((a, b) => Number(a) - Number(b));
      if (withShape.length) lineShapesOut[line] = withShape;
    }
    fs.writeFileSync(LINE_SHAPES_PATH, JSON.stringify(lineShapesOut));
    console.log(`line-shapes.json: ${Object.keys(lineShapesOut).length} líneas con shape.`);

    // Reporte de cobertura: cuántas variantes por línea tienen shape real.
    let linesFull = 0, linesPartial = 0, linesEmpty = 0;
    let worst = [];
    for (const [line, variants] of Object.entries(lineVariants)) {
      const total = variants.size;
      const withShape = [...variants].filter(v => variantHasShape.has(v)).length;
      if (withShape === total) linesFull++;
      else if (withShape === 0) linesEmpty++;
      else { linesPartial++; worst.push({ line, withShape, total }); }
    }
    worst.sort((a, b) => (a.withShape / a.total) - (b.withShape / b.total));

    console.log(`\nProcesadas ${count} features → ${Object.keys(routesMap).length} variantes con shape.`);
    console.log(`Cobertura por línea: ${linesFull} completas · ${linesPartial} parciales · ${linesEmpty} sin shape.`);
    if (worst.length) {
      console.log('Líneas con MENOS cobertura de variantes:');
      worst.slice(0, 12).forEach(w => console.log(`   ${w.line}: ${w.withShape}/${w.total}`));
    }

    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch (err) {
    console.error('Error procesando las rutas:', err);
    process.exitCode = 1;
  }
}

processRoutes();
