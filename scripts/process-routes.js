const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');

const SHP_GENERATOR_URL = 'http://intgis.montevideo.gub.uy/sit/php/common/datos/generar_zip2.php?nom_tab=v_uptu_lsv&tipo=gis';
const ZIP_URL = 'http://intgis.montevideo.gub.uy/sit/tmp/v_uptu_lsv.zip';
const OUT_PATH = path.join(__dirname, '../public/routes.json');
const TMP_DIR = path.join(__dirname, '../tmp_shape');

async function processRoutes() {
  console.log('Generando shapefile v_uptu_lsv en servidor...');
  
  try {
    await fetch(SHP_GENERATOR_URL);
    await new Promise(r => setTimeout(r, 2000)); // wait for generation

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
    
    // Buscar los archivos .shp y .dbf
    const files = fs.readdirSync(TMP_DIR);
    const shpFile = files.find(f => f.endsWith('.shp'));
    const dbfFile = files.find(f => f.endsWith('.dbf'));
    
    if (!shpFile || !dbfFile) {
      throw new Error('Faltan archivos .shp o .dbf en el ZIP');
    }
    
    console.log('Parseando shapefile con shapefile library...');
    
    const source = await shapefile.open(
      path.join(TMP_DIR, shpFile),
      path.join(TMP_DIR, dbfFile)
    );
    
    const routesMap = {};
    let count = 0;
    
    while (true) {
      const result = await source.read();
      if (result.done) break;
      
      const feature = result.value;
      const props = feature.properties || {};
      
      const lineCode = props.DESC_LINEA || props.LINEA;
      const codVariante = props.COD_VARIANTE;
      
      if (!lineCode) continue;

      const geometry = feature.geometry;
      let coordinates = [];
      
      if (geometry && geometry.type === 'LineString') {
        coordinates = geometry.coordinates.map(c => [c[1], c[0]]);
      } else if (geometry && geometry.type === 'MultiLineString') {
        coordinates = geometry.coordinates.flat().map(c => [c[1], c[0]]);
      }
      
      coordinates = coordinates.map(c => [Number(c[0].toFixed(5)), Number(c[1].toFixed(5))]);

      if (codVariante) {
        routesMap[`v_${codVariante}`] = coordinates;
      }
      if (!routesMap[lineCode]) {
        routesMap[lineCode] = coordinates;
      }
      count++;
    }

    fs.writeFileSync(OUT_PATH, JSON.stringify(routesMap));
    console.log(`Procesadas ${count} features. Guardado exitosamente en public/routes.json con ${Object.keys(routesMap).length} recorridos distintos.`);
    
    // Limpieza
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    
  } catch (err) {
    console.error('Error procesando las rutas:', err);
  }
}

processRoutes();
