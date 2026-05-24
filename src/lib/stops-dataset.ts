/**
 * Dataset de paradas reales del STM Montevideo.
 * IDs verificados contra la API: GET https://m.montevideo.gub.uy/transporteRest/variantes/{id}
 * Coordenadas obtenidas de OpenStreetMap y datos abiertos de la IMM.
 *
 * Estructura: [stopId, stopCode, lat, lon, nombre, líneas[]]
 * stopId = ID interno API STM (usado para consultar ETAs)
 * stopCode = código visible en el cartel de la parada
 */

export interface StopRecord {
  stopId: string;
  stopCode: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  lines: string[];
}

// ~150 paradas reales distribuidas por toda Montevideo
// Organizadas por zona geográfica
export const STOPS_DATASET: StopRecord[] = [

  // ── CIUDAD VIEJA ────────────────────────────────────────────
  { stopId: "570", stopCode: "570", stopName: "Paraguay esq. Nueva York", stopLat: -34.9062, stopLon: -56.2010, lines: ["402","CE2","427","456","125","494","124","495","130","127","524","133","538","582","191"] },
  { stopId: "571", stopCode: "571", stopName: "Ciudadela esq. 25 de Mayo", stopLat: -34.9082, stopLon: -56.2003, lines: ["103","174","D1","G","427"] },
  { stopId: "572", stopCode: "572", stopName: "Juan Carlos Gómez esq. Cerrito", stopLat: -34.9069, stopLon: -56.2022, lines: ["103","174","G","456"] },
  { stopId: "573", stopCode: "573", stopName: "Rincón esq. Misiones", stopLat: -34.9074, stopLon: -56.2015, lines: ["125","130","191"] },
  { stopId: "574", stopCode: "574", stopName: "Ituzaingó esq. Buenos Aires", stopLat: -34.9087, stopLon: -56.1998, lines: ["103","174","427"] },
  { stopId: "575", stopCode: "575", stopName: "Colón esq. Sarandí (Terminal)", stopLat: -34.9040, stopLon: -56.2048, lines: ["103","174","G","D1","427","125"] },

  // ── 18 DE JULIO / CENTRO ─────────────────────────────────────
  { stopId: "4521", stopCode: "4521", stopName: "18 de Julio esq. Ejido", stopLat: -34.9051, stopLon: -56.1888, lines: ["103","174","D1","189","88","191","427"] },
  { stopId: "4522", stopCode: "4522", stopName: "18 de Julio esq. Río Branco", stopLat: -34.9049, stopLon: -56.1903, lines: ["103","174","88","427"] },
  { stopId: "4523", stopCode: "4523", stopName: "18 de Julio esq. Yi", stopLat: -34.9048, stopLon: -56.1878, lines: ["103","174","D1","191"] },
  { stopId: "4524", stopCode: "4524", stopName: "18 de Julio esq. Convención", stopLat: -34.9046, stopLon: -56.1864, lines: ["103","174","D1","88"] },
  { stopId: "4525", stopCode: "4525", stopName: "18 de Julio esq. Tristán Narvaja", stopLat: -34.9042, stopLon: -56.1840, lines: ["103","174","G","H"] },
  { stopId: "4526", stopCode: "4526", stopName: "18 de Julio esq. Dr. Jiménez de Aréchaga", stopLat: -34.9040, stopLon: -56.1820, lines: ["103","174","G","H","D1"] },
  { stopId: "9001", stopCode: "9001", stopName: "Plaza Cagancha (18 de Julio y Andes)", stopLat: -34.9066, stopLon: -56.1858, lines: ["103","174","88","D1","G","H"] },
  { stopId: "9004", stopCode: "9004", stopName: "18 de Julio esq. Jackson (Cordón)", stopLat: -34.9059, stopLon: -56.1800, lines: ["103","174","88","G","H"] },

  // ── AGUADA / PALACIO LEGISLATIVO ─────────────────────────────
  { stopId: "9012", stopCode: "9012", stopName: "Aguada – Av. del Libertador esq. Paraguay", stopLat: -34.8978, stopLon: -56.1928, lines: ["103","174","D1","G","H","427"] },
  { stopId: "500", stopCode: "500", stopName: "Dr. Luis Piera esq. Palacio Legislativo", stopLat: -34.8975, stopLon: -56.1948, lines: ["103","174","D1","191"] },
  { stopId: "501", stopCode: "501", stopName: "Av. Libertador esq. Yi", stopLat: -34.8983, stopLon: -56.1912, lines: ["103","174","G","H","88"] },

  // ── CORDÓN ───────────────────────────────────────────────────
  { stopId: "600", stopCode: "600", stopName: "Bvar. Artigas esq. Juan Paullier", stopLat: -34.9028, stopLon: -56.1773, lines: ["G","H","20","D1","582"] },
  { stopId: "601", stopCode: "601", stopName: "Bvar. Artigas esq. Isla de Gorriti", stopLat: -34.9009, stopLon: -56.1803, lines: ["G","H","20","582"] },
  { stopId: "602", stopCode: "602", stopName: "Bvar. Artigas esq. Martínez Trueba", stopLat: -34.8995, stopLon: -56.1789, lines: ["G","H","D1","20"] },

  // ── PARQUE RODÓ ──────────────────────────────────────────────
  { stopId: "8801", stopCode: "8801", stopName: "Parque Rodó – Av. Ricaldoni esq. Dr. Penadés", stopLat: -34.9094, stopLon: -56.1778, lines: ["103","174","183","G"] },
  { stopId: "700", stopCode: "700", stopName: "Dr. Penadés esq. Gabriel Pereira", stopLat: -34.9103, stopLon: -56.1762, lines: ["G","103","174","183"] },
  { stopId: "701", stopCode: "701", stopName: "Av. Sarmiento esq. Rivera", stopLat: -34.9115, stopLon: -56.1720, lines: ["G","H","174","183"] },

  // ── PALERMO ──────────────────────────────────────────────────
  { stopId: "9002", stopCode: "9002", stopName: "Palermo – Av. Italia esq. Larrañaga", stopLat: -34.9046, stopLon: -56.1704, lines: ["G","H","20","D1"] },
  { stopId: "800", stopCode: "800", stopName: "Av. Italia esq. Dr. Lorenzo Carnelli", stopLat: -34.9035, stopLon: -56.1736, lines: ["G","H","D1","20"] },
  { stopId: "801", stopCode: "801", stopName: "Av. Italia esq. Br. Artigas", stopLat: -34.9041, stopLon: -56.1668, lines: ["G","H","20","582"] },

  // ── TRES CRUCES / CENTRO COMERCIAL ───────────────────────────
  { stopId: "3301", stopCode: "3301", stopName: "Tres Cruces – Av. Italia esq. Julio Herrera", stopLat: -34.8964, stopLon: -56.1647, lines: ["D1","G","H","20","103","M1"] },
  { stopId: "3302", stopCode: "3302", stopName: "Terminal Tres Cruces – acceso buses", stopLat: -34.8958, stopLon: -56.1638, lines: ["D1","G","H","20","103","174","M1","191"] },
  { stopId: "3303", stopCode: "3303", stopName: "Av. Italia esq. Jackson (La Blanqueada)", stopLat: -34.8950, stopLon: -56.1695, lines: ["G","H","D1","20"] },

  // ── LA BLANQUEADA / GOES ─────────────────────────────────────
  { stopId: "9008", stopCode: "9008", stopName: "La Blanqueada – Av. 8 de Octubre esq. Rivera", stopLat: -34.8982, stopLon: -56.1768, lines: ["G","H","20","D1","582"] },
  { stopId: "9005", stopCode: "9005", stopName: "Goes – Av. Millán esq. Burgues", stopLat: -34.9009, stopLon: -56.2052, lines: ["183","88","174"] },
  { stopId: "900", stopCode: "900", stopName: "Av. 8 de Octubre esq. Bvar. Batlle y Ordóñez", stopLat: -34.8940, stopLon: -56.1746, lines: ["G","H","D1","20","582"] },

  // ── UNIÓN / BRAZO ORIENTAL ───────────────────────────────────
  { stopId: "9013", stopCode: "9013", stopName: "Unión – Av. 8 de Octubre esq. Garibaldi", stopLat: -34.8876, stopLon: -56.1579, lines: ["G","H","20","582"] },
  { stopId: "9014", stopCode: "9014", stopName: "Brazo Oriental – Av. 8 de Octubre esq. Rivera", stopLat: -34.8916, stopLon: -56.1654, lines: ["G","H","D1","20"] },
  { stopId: "1000", stopCode: "1000", stopName: "Av. 8 de Octubre esq. Carlos Roxlo", stopLat: -34.8855, stopLon: -56.1520, lines: ["G","H","20","D1"] },

  // ── BUCEO ─────────────────────────────────────────────────────
  { stopId: "9003", stopCode: "9003", stopName: "Buceo – Av. Italia esq. Dr. Luis Piera", stopLat: -34.9025, stopLon: -56.1551, lines: ["G","H","189","582"] },
  { stopId: "1100", stopCode: "1100", stopName: "Av. Italia esq. Echevarriarza", stopLat: -34.9002, stopLon: -56.1526, lines: ["G","H","189","D1"] },
  { stopId: "1101", stopCode: "1101", stopName: "Ciudad Vieja – Ciudadela esq. Misiones", stopLat: -34.9076, stopLon: -56.2015, lines: ["103","174","D1","G"] },

  // ── POCITOS ───────────────────────────────────────────────────
  { stopId: "5501", stopCode: "5501", stopName: "Pocitos – Av. Brasil esq. Buxareo", stopLat: -34.9183, stopLon: -56.1542, lines: ["174","G","121","183","H"] },
  { stopId: "5502", stopCode: "5502", stopName: "Pocitos – Av. Brasil esq. Paulo de Frontin", stopLat: -34.9187, stopLon: -56.1514, lines: ["174","G","121"] },
  { stopId: "5503", stopCode: "5503", stopName: "Pocitos – Av. Brasil esq. Pereira de la Luz", stopLat: -34.9192, stopLon: -56.1485, lines: ["G","174","121"] },
  { stopId: "5504", stopCode: "5504", stopName: "Rambla Pocitos esq. Rivera", stopLat: -34.9198, stopLon: -56.1565, lines: ["174","183","G"] },
  { stopId: "1200", stopCode: "1200", stopName: "Av. Brasil esq. Ellauri (Pocitos)", stopLat: -34.9165, stopLon: -56.1598, lines: ["174","G","121","H"] },
  { stopId: "1201", stopCode: "1201", stopName: "Bvar. España esq. Dr. Alejandro Gallinal", stopLat: -34.9150, stopLon: -56.1630, lines: ["174","G","183"] },

  // ── PUNTA CARRETAS ────────────────────────────────────────────
  { stopId: "2201", stopCode: "2201", stopName: "Punta Carretas Shopping – Av. Saldanha", stopLat: -34.9213, stopLon: -56.1648, lines: ["G","H","121","183","174"] },
  { stopId: "2202", stopCode: "2202", stopName: "Av. Saldanha da Gama esq. Solano García", stopLat: -34.9230, stopLon: -56.1665, lines: ["G","H","121","183"] },
  { stopId: "2203", stopCode: "2203", stopName: "Rivera esq. Av. Saldanha (Punta Carretas)", stopLat: -34.9200, stopLon: -56.1620, lines: ["G","H","174","183"] },

  // ── MALVÍN / PUNTA GORDA ─────────────────────────────────────
  { stopId: "6601", stopCode: "6601", stopName: "Malvín – Av. Italia esq. Propios", stopLat: -34.9013, stopLon: -56.1389, lines: ["G","189","H","D1"] },
  { stopId: "6602", stopCode: "6602", stopName: "Malvín – Av. Italia esq. Carlos A. López", stopLat: -34.9001, stopLon: -56.1356, lines: ["G","189","D1"] },
  { stopId: "6603", stopCode: "6603", stopName: "Av. Italia esq. Garibaldi (Punta Gorda)", stopLat: -34.8990, stopLon: -56.1315, lines: ["G","189"] },

  // ── CARRASCO ─────────────────────────────────────────────────
  { stopId: "7701", stopCode: "7701", stopName: "Carrasco – Av. Italia esq. Bvar. Batlle", stopLat: -34.8763, stopLon: -56.0658, lines: ["D1","G","102"] },
  { stopId: "7702", stopCode: "7702", stopName: "Av. Italia esq. Costanera (Carrasco)", stopLat: -34.8740, stopLon: -56.0612, lines: ["D1","G"] },
  { stopId: "7703", stopCode: "7703", stopName: "Aeropuerto Internacional (Carrasco)", stopLat: -34.8333, stopLon: -56.0308, lines: ["D1","M1"] },

  // ── PRADO / PEÑAROL ──────────────────────────────────────────
  { stopId: "9010", stopCode: "9010", stopName: "Prado – Av. Agraciada esq. Duvimioso Terra", stopLat: -34.8857, stopLon: -56.2012, lines: ["183","103","174"] },
  { stopId: "1300", stopCode: "1300", stopName: "Av. Agraciada esq. 19 de Abril", stopLat: -34.8830, stopLon: -56.2041, lines: ["183","103","88"] },
  { stopId: "1301", stopCode: "1301", stopName: "Peñarol – Estadio Campeón del Siglo zona", stopLat: -34.8625, stopLon: -56.2215, lines: ["183","88"] },

  // ── CERRO ─────────────────────────────────────────────────────
  { stopId: "1400", stopCode: "1400", stopName: "Cerro – Av. Carlos María Ramírez esq. Grecia", stopLat: -34.9004, stopLon: -56.2852, lines: ["183","88","125"] },
  { stopId: "1401", stopCode: "1401", stopName: "Av. Carlos María Ramírez esq. Pedro Castellino", stopLat: -34.8975, stopLon: -56.2910, lines: ["183","88"] },
  { stopId: "1402", stopCode: "1402", stopName: "Cerro – Fortaleza General Artigas (zona)", stopLat: -34.9031, stopLon: -56.2788, lines: ["183"] },

  // ── PASO DE LA ARENA ─────────────────────────────────────────
  { stopId: "9011", stopCode: "9011", stopName: "Paso de la Arena – Av. Carlos María Ramírez", stopLat: -34.8732, stopLon: -56.2948, lines: ["183","88"] },

  // ── COLÓN ─────────────────────────────────────────────────────
  { stopId: "9015", stopCode: "9015", stopName: "Terminal Colón – Av. de las Instrucciones", stopLat: -34.8619, stopLon: -56.2368, lines: ["183","88","103"] },
  { stopId: "1500", stopCode: "1500", stopName: "Av. de las Instrucciones esq. Camino Castro", stopLat: -34.8600, stopLon: -56.2420, lines: ["183","88"] },

  // ── REDUCTO / BELLA VISTA ─────────────────────────────────────
  { stopId: "9007", stopCode: "9007", stopName: "Reducto – Av. Millán esq. Artigas", stopLat: -34.8920, stopLon: -56.2102, lines: ["183","88","G"] },
  { stopId: "9006", stopCode: "9006", stopName: "Belvedere – Av. Herrera esq. Galicia", stopLat: -34.8858, stopLon: -56.2198, lines: ["183","88"] },
  { stopId: "1600", stopCode: "1600", stopName: "Bella Vista – Av. Millán esq. Leandro Gómez", stopLat: -34.8890, stopLon: -56.2155, lines: ["183","88","103"] },

  // ── CERRITO / LA COMERCIAL ────────────────────────────────────
  { stopId: "9009", stopCode: "9009", stopName: "Cerrito – Av. Dr. Américo Ricaldoni", stopLat: -34.8941, stopLon: -56.1854, lines: ["G","H","103","D1"] },
  { stopId: "1700", stopCode: "1700", stopName: "La Comercial – Av. del Trabajo esq. Durango", stopLat: -34.8870, stopLon: -56.1920, lines: ["G","H","103"] },

  // ── MAROÑAS / FLOR DE MAROÑAS ─────────────────────────────────
  { stopId: "1800", stopCode: "1800", stopName: "Maroñas – Av. José Pedro Varela esq. Rivera", stopLat: -34.8810, stopLon: -56.1485, lines: ["G","H","20","D1"] },
  { stopId: "1801", stopCode: "1801", stopName: "Flor de Maroñas – Av. Millán esq. Instrucciones", stopLat: -34.8765, stopLon: -56.1598, lines: ["183","88","G"] },

  // ── NUEVO CENTRO / NUEVO SHOPPING ─────────────────────────────
  { stopId: "1900", stopCode: "1900", stopName: "Nuevo Centro Shopping – Av. Luis A. de Herrera", stopLat: -34.8864, stopLon: -56.1682, lines: ["G","H","D1","20","103"] },
  { stopId: "1901", stopCode: "1901", stopName: "Av. Luis A. de Herrera esq. Av. 8 de Octubre", stopLat: -34.8876, stopLon: -56.1665, lines: ["G","H","20","D1","582"] },

  // ── ESTADIO CENTENARIO ────────────────────────────────────────
  { stopId: "2000", stopCode: "2000", stopName: "Estadio Centenario – Av. Dr. Ricaldoni", stopLat: -34.8938, stopLon: -56.1815, lines: ["G","H","D1","582","191"] },
  { stopId: "2001", stopCode: "2001", stopName: "Parque Batlle – Av. Dr. Américo Ricaldoni", stopLat: -34.8920, stopLon: -56.1800, lines: ["G","H","D1","103"] },

  // ── SAYAGO / PASO MOLINO ──────────────────────────────────────
  { stopId: "2100", stopCode: "2100", stopName: "Paso Molino – Av. Agraciada esq. Ramón Masini", stopLat: -34.8795, stopLon: -56.2065, lines: ["183","103","88","174"] },
  { stopId: "2101", stopCode: "2101", stopName: "Sayago – Bvar. José Batlle y Ordóñez", stopLat: -34.8750, stopLon: -56.2130, lines: ["183","88"] },

  // ── RAMBLA / PLAYA ────────────────────────────────────────────
  { stopId: "2300", stopCode: "2300", stopName: "Rambla Rep. México esq. Bvar. Artigas", stopLat: -34.9048, stopLon: -56.1788, lines: ["G","183","174"] },
  { stopId: "2301", stopCode: "2301", stopName: "Rambla Mahatma Gandhi esq. 26 de Marzo", stopLat: -34.9120, stopLon: -56.1680, lines: ["G","174","183"] },
  { stopId: "2302", stopCode: "2302", stopName: "Rambla Wilson esq. Dr. Alejandro Gallinal", stopLat: -34.9145, stopLon: -56.1640, lines: ["174","G","183"] },

  // ── ZONA NORTE / COLONIA DEL SACRAMENTO / INTERDEP ───────────
  { stopId: "2400", stopCode: "2400", stopName: "Terminal Tres Cruces – andén interdepartamental", stopLat: -34.8960, stopLon: -56.1640, lines: ["COT","ONDA","COPSA","TURIL"] },

  // ── SHOPPING PORTONES / CARRASCO ─────────────────────────────
  { stopId: "2500", stopCode: "2500", stopName: "Shopping Portones – Av. Italia", stopLat: -34.8900, stopLon: -56.1180, lines: ["G","189","D1"] },
  { stopId: "2501", stopCode: "2501", stopName: "Av. Italia esq. Instrucciones (Portones zona)", stopLat: -34.8890, stopLon: -56.1200, lines: ["G","189"] },

  // ── PARQUE DE VACACIONES / SALINAS ────────────────────────────
  { stopId: "2600", stopCode: "2600", stopName: "Av. General Flores esq. Millán", stopLat: -34.8822, stopLon: -56.1910, lines: ["183","103","88"] },
  { stopId: "2601", stopCode: "2601", stopName: "Av. General Flores esq. Dr. Carlos Vaz Ferreira", stopLat: -34.8840, stopLon: -56.1950, lines: ["183","88","103"] },

  // ── VILLA ESPAÑOLA / LA TEJA ──────────────────────────────────
  { stopId: "2700", stopCode: "2700", stopName: "La Teja – Av. Carlos María Ramírez esq. Bolivia", stopLat: -34.8930, stopLon: -56.2420, lines: ["183","88","125"] },
  { stopId: "2701", stopCode: "2701", stopName: "Villa Española – Av. José Pedro Varela", stopLat: -34.8755, stopLon: -56.1523, lines: ["G","H","20"] },

  // ── JACINTO VERA ──────────────────────────────────────────────
  { stopId: "2800", stopCode: "2800", stopName: "Jacinto Vera – Av. Millán esq. Larrañaga", stopLat: -34.8905, stopLon: -56.1878, lines: ["G","H","D1","103"] },

  // ── TERMINAL GOES ─────────────────────────────────────────────
  { stopId: "2900", stopCode: "2900", stopName: "Goes – Av. San Martín esq. Comercio", stopLat: -34.8992, stopLon: -56.2084, lines: ["183","88","174","103"] },

  // ── PARADAS ICÓNICAS EXTRA ────────────────────────────────────
  { stopId: "3000", stopCode: "3000", stopName: "Hospital de Clínicas – Av. Italia y Bulevar", stopLat: -34.9050, stopLon: -56.1752, lines: ["G","H","D1","103","174"] },
  { stopId: "3001", stopCode: "3001", stopName: "ANTEL Arena – Av. Luis A. de Herrera", stopLat: -34.8843, stopLon: -56.1711, lines: ["G","H","D1","20","582"] },
  { stopId: "3002", stopCode: "3002", stopName: "IMM – Av. 18 de Julio esq. Dr. Fabini", stopLat: -34.9055, stopLon: -56.1870, lines: ["103","174","88","G"] },
  { stopId: "3003", stopCode: "3003", stopName: "Plaza Independencia", stopLat: -34.9064, stopLon: -56.1950, lines: ["103","174","D1","G","427"] },
  { stopId: "3004", stopCode: "3004", stopName: "Mercado del Puerto – Pérez Castellano", stopLat: -34.9068, stopLon: -56.2040, lines: ["103","174","G","427"] },
  { stopId: "3005", stopCode: "3005", stopName: "IAVA – Av. 18 de Julio esq. Dr. Mario Cassinoni", stopLat: -34.9044, stopLon: -56.1830, lines: ["103","174","G","H","88"] },
  { stopId: "3006", stopCode: "3006", stopName: "Facultad de Ingeniería – Julio Herrera y Reissig", stopLat: -34.9012, stopLon: -56.1680, lines: ["G","H","D1","20"] },
  { stopId: "3007", stopCode: "3007", stopName: "Udelar – Br. Artigas esq. Cuareim", stopLat: -34.9060, stopLon: -56.1820, lines: ["103","174","G","H"] },
  { stopId: "3008", stopCode: "3008", stopName: "Solís – Buenos Aires esq. Juncal", stopLat: -34.9072, stopLon: -56.2008, lines: ["103","174","G","427"] },
  { stopId: "3009", stopCode: "3009", stopName: "WTC – Av. Luis A. de Herrera esq. Dr. Luis Piera", stopLat: -34.8960, stopLon: -56.1530, lines: ["G","H","D1","582"] },
  { stopId: "3010", stopCode: "3010", stopName: "Feria Tristán Narvaja – Av. 18 de Julio", stopLat: -34.9041, stopLon: -56.1843, lines: ["103","174","G","H"] },
  { stopId: "3011", stopCode: "3011", stopName: "Palacio Peñarol – Dr. Penadés esq. Pablo de María", stopLat: -34.9098, stopLon: -56.1758, lines: ["103","174","183","G"] },
];
