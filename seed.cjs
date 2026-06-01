/**
 * seed.cjs — Carpintería Huayapam ERP
 * Popula la base de datos desde cero con todos los datos base.
 * Uso: GOOGLE_APPLICATION_CREDENTIALS="<key.json>" node seed.cjs
 */

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

// ── helpers ───────────────────────────────────────────────────────────────────

async function batchWrite(colName, docs, idFn) {
  const col = db.collection(colName);
  let batch = db.batch();
  let count = 0;
  for (const d of docs) {
    const id = typeof idFn === 'function' ? idFn(d) : String(d.id);
    batch.set(col.doc(id), d);
    if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();
  return docs.length;
}

function slug(str, maxLen = 40) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, maxLen);
}

// ── data ──────────────────────────────────────────────────────────────────────

const SETTINGS = {
  id: 'main',
  empresa: 'Carpintería Huayapam',
  horaEntrada: '09:00',
  minutosRetardo: 15,
  minutosFalta: 60,
  moneda: 'MXN',
  iva: 16,
  overheadPorHora: 37.3,
  jornadaHoras: 9,
  semanaHoras: 45,
  tasaSatRate: 1.5,
  tasaSunRate: 2.0,
};

const WORKERS = [
  {id:'EDD92', givenName:'Eddie',       paterno:'Santiago',  name:'Santiago Sanchez Eddie',           role:'Jefe de Planta',  baseSalary:4150, personalId:'EDD92', scanCode:'EDD92'},
  {id:'DIE85', givenName:'Diego',       paterno:'Romero',    name:'Romero Frias Diego',               role:'Administración', baseSalary:4000, personalId:'DIE85', scanCode:'DIE85'},
  {id:'NAR69', givenName:'Narciso',     paterno:'Martinez',  name:'Martinez Chavez Narciso R.',       role:'Maestro A',      baseSalary:3800, personalId:'NAR69', scanCode:'NAR69'},
  {id:'HER71', givenName:'Herón',       paterno:'Pacheco',   name:'Pacheco Garcia Heron C.',          role:'Maestro A',      baseSalary:3700, personalId:'HER71', scanCode:'HER71'},
  {id:'GAB82', givenName:'Gabriel',     paterno:'Santiago',  name:'Santiago Moreno Gabriel',          role:'Contador',       baseSalary:3700, personalId:'GAB82', scanCode:'GAB82'},
  {id:'VIC75', givenName:'Vicente',     paterno:'Cruz',      name:'Cruz Morales Vicente A.',          role:'Maestro A',      baseSalary:3600, personalId:'VIC75', scanCode:'VIC75'},
  {id:'ANG70', givenName:'Angel',       paterno:'Chincoya',  name:'Chincoya Rodriguez Angel L.',      role:'Maestro A',      baseSalary:3550, personalId:'ANG70', scanCode:'ANG70'},
  {id:'NEP80', givenName:'Neptali',     paterno:'Hernandez', name:'Hernandez Gaytan Neptali',         role:'Maestro B',      baseSalary:3500, personalId:'NEP80', scanCode:'NEP80'},
  {id:'GAB72', givenName:'Gabriel',     paterno:'Torija',    name:'Torija Hernandez Gabriel',         role:'Mantenimiento',  baseSalary:3500, personalId:'GAB72', scanCode:'GAB72'},
  {id:'MIL97', givenName:'Milena',      paterno:'Spada',     name:'Spada Tello Milena',               role:'Administración', baseSalary:3500, personalId:'MIL97', scanCode:'MIL97'},
  {id:'GRE75', givenName:'Gregorio',    paterno:'Cruz',      name:'Cruz Cruz Gregorio',               role:'Barniz',         baseSalary:3250, personalId:'GRE75', scanCode:'GRE75'},
  {id:'CAR74', givenName:'Carlos',      paterno:'Padilla',   name:'Padilla Cruz Carlos A.',           role:'Oficial A',      baseSalary:3100, personalId:'CAR74', scanCode:'CAR74'},
  {id:'MAR73', givenName:'Martha',      paterno:'Mendoza',   name:'Mendoza Arellano Martha',          role:'Compras',        baseSalary:3000, personalId:'MAR73', scanCode:'MAR73'},
  {id:'MIG81', givenName:'Miguel',      paterno:'Mendez',    name:'Mendez Santiago Miguel A.',        role:'Oficial A',      baseSalary:2900, personalId:'MIG81', scanCode:'MIG81'},
  {id:'PAO95', givenName:'Paola',       paterno:'Padilla',   name:'Padilla Contreras Paola',          role:'Oficial B',      baseSalary:2900, personalId:'PAO95', scanCode:'PAO95'},
  {id:'GUI90', givenName:'Guillermo',   paterno:'Flores',    name:'Flores Garcia Guillermo',          role:'Oficial B',      baseSalary:2650, personalId:'GUI90', scanCode:'GUI90'},
  {id:'SAN04', givenName:'Sandra',      paterno:'Garcia',    name:'Garcia Hernandez Sandra',          role:'Oficial B',      baseSalary:2600, personalId:'SAN04', scanCode:'SAN04'},
  {id:'ALF80', givenName:'Alfredo',     paterno:'Garcia',    name:'Garcia Garcia Alfredo',            role:'Oficial B',      baseSalary:2600, personalId:'ALF80', scanCode:'ALF80'},
  {id:'NAP81', givenName:'Napoleon',    paterno:'Hernandez', name:'Hernandez Ignacio Napoleon',       role:'Chofer',         baseSalary:2450, personalId:'NAP81', scanCode:'NAP81'},
  {id:'CHR91', givenName:'Christopher', paterno:'Hernandez', name:'Hernandez Ramirez Christopher',    role:'Aprendiz',       baseSalary:2400, personalId:'CHR91', scanCode:'CHR91'},
  {id:'ANG65', givenName:'Angeles',     paterno:'Rojas',     name:'Rojas Aragon Angeles',             role:'Empleye',        baseSalary:2400, personalId:'ANG65', scanCode:'ANG65'},
  {id:'LEX01', givenName:'Lexee',       paterno:'Jimenez',   name:'Jimenez Carranza Lexee',           role:'Chalán',         baseSalary:2350, personalId:'LEX01', scanCode:'LEX01'},
  {id:'JEN79', givenName:'Jenny',       paterno:'Velasco',   name:'Velasco Vazquez Jenny',            role:'Pulido',         baseSalary:2300, personalId:'JEN79', scanCode:'JEN79'},
  {id:'DIE04', givenName:'Diego',       paterno:'Hernandez', name:'Hernandez Ramirez Diego',          role:'Chalán',         baseSalary:2300, personalId:'DIE04', scanCode:'DIE04'},
  {id:'COS70', givenName:'Cosme',       paterno:'Perez',     name:'Perez Ramirez Cosme',              role:'Almacén',        baseSalary:2300, personalId:'COS70', scanCode:'COS70'},
  {id:'YES80', givenName:'Yesenia',     paterno:'Velasco',   name:'Velasco Vazquez Yesenia',          role:'Pulido',         baseSalary:2250, personalId:'YES80', scanCode:'YES80'},
  {id:'ELO03', givenName:'Eloy',        paterno:'Hernandez', name:'Hernandez Ramirez Eloy',           role:'Chalán',         baseSalary:2205, personalId:'ELO03', scanCode:'ELO03'},
  {id:'GLA77', givenName:'Gladis',      paterno:'Bautista',  name:'Bautista Santiago Gladis',         role:'Limpieza',       baseSalary:2205, personalId:'GLA77', scanCode:'GLA77'},
  {id:'CAR02', givenName:'Carolina',    paterno:'Santiago',  name:'Santiago Reyes Carolina',          role:'Pulido',         baseSalary:2205, personalId:'CAR02', scanCode:'CAR02'},
];

const CLIENTS = [
  "ACOROL, S. A. DE C. V.",
  "AEROTUCAN, S. A. DE C. V.",
  "AFMH CONSTRUCCION SC",
  "ALDEA TAMARINDO, S. A. DE C. V.",
  "ALDEBARAN TALLER DE CONCRETO",
  "ALFONSINA",
  "ALIMENTOS Y BEBIDAS SAN PABLO, S. A. DE C. V.",
  "ALVAREZ JAVIER",
  "AMOZURRUTIA CORTES JOSE GABRIEL",
  "AMTMANN AGUILAR GLORIA YOLANDA",
  "ANGELES MENDOZA RICARDO",
  "ANGELES OJEDA JACOBO",
  "ANTONA BERNA",
  "ARANGO JIMENEZ REYNA SILVINA",
  "ARCADIA DE MEXICO SA DE CV",
  "ARELLANO ALDECO LUIS REFUGIO",
  "BARRERA AYALA MARIA ESTHER",
  "BEBIDAS EXCELENTES S. A. DE C. V.",
  "BEBIDAS Y ALIMENTOS CHORSCO SA DE CV",
  "BENJAMIN LOPEZ ELLITSGAARD RASMUSSE",
  "BRUNO AERNE",
  "BUSTAMANTE JOSE LUIS",
  "CARNE Y HUESO SA DE CV",
  "CARUS AZPIRI RODRIGO",
  "CARUS BLAZQUEZ MARIA JOSE",
  "CASA AZUL DE OAXACA SA DE CV",
  "CASA CATARINA TALLER TAF",
  "CASA OAXACA, S. A. DE C. V.",
  "CASA PRIETO",
  "CASAS DE PABLO, S. A. DE C. V.",
  "CASASNOVAS FERNANDEZ MARIA JOSE",
  "CASTRO SILVIA",
  "CENTRO OLLIN OAXACA S DE RL DE C V",
  "CERVANTES BRAVO GRACIELA MARIA LIDIA",
  "CHANONA ESPINOZA ITZEL JANET",
  "COMEDOR ALFONSINA SA DE CV",
  "CONEXION DE BIENES INMUEBLES SA DE CV",
  "CONSEJO MEXICANO REGULADOR DE LA CALIDAD DEL MEZCAL, A. C.",
  "CONSTRUCTORES INMOBILIARIOS, S. A. DE C. V.",
  "CONSTRUSISTEM, S. A. DE C. V.",
  "CORDOVA CARLOS",
  "CORDOVA GARCIA JULIO CESAR",
  "CORDOVA GARCIA ROSA ELENA",
  "CORPORACION DE MEDIOS DE INFORMACION, S. A. DE C. V.",
  "CORPORACION RADIOFONICA OAXAQUEÑA, S. A. DE C. V.",
  "CORPORATIVO EBIDAR, S. A. DE C. V.",
  "CORPORATIVO INTERNACIONAL DE DISEÑO Y CONSTRUCCION LAS TORRES, S. A. DE C. V.",
  "DANIELLE ALEJANDRA GARCIA RAMIREZ",
  "DAVID ANTHONY ARRIAGA WEISS",
  "DELMAR LOGISTICA, S. A. P. I. DE C. V.",
  "DEMOLITION AND SERVICE MOMPE, S. A. DE C. V.",
  "DESARROLLO HOTELERO E INMOBILIARIO UMI, S. A. DE C. V.",
  "DESTILADORA DE MEZCAL MATATECO, S. A. DE C. V.",
  "DETERMINACION TURISTICA, S. C.",
  "DIEN SCI, S. A. DE C. V.",
  "EDIFIRM, S. A. DE C. V.",
  "EL 60, S. A. DE C. V.",
  "EL SILENCIO HOLDINGS, INC.",
  "EMERGE EDIFICACIONES Y PROYECTOS, S. A. DE C. V.",
  "ENCINO MESA RICA SAPI DE CV",
  "ESCALERA GUZMAN JOSE LUIS",
  "ESPACIO DE ENCUENTRO DE LAS CULTURAS ORIGINARIAS, A. C.",
  "ESPRIELLA ESPINOSA MARIA VALERIA",
  "ESTACION DE SERVICIO BAUTISTA, S. A. DE C. V.",
  "ESTACION DE SERVICIO OAXACA, S. A. DE C. V.",
  "ESTIMACIONES GUAJAL MONICA",
  "ESTUDIO RRRES S DE RL DE CV",
  "EXPORTADORES DEL SABOR OAXAQUEÑO, S. A. DE C. V.",
  "FERNANDEZ LESUR OMAR FEDERICO",
  "FIDEICOMISO 5792/2022 GFM",
  "FUNDACION ALFREDO HARP HELU OAXACA, A. C.",
  "FUNDACION PARA LA RESERVA DE LA BIOSFERA",
  "GABRIEL SANTIAGO MORENO",
  "GALICIA GONZALEZ CLAUDIA XOCHITL",
  "GARCIA MUÑOZ ROSA",
  "GARCIA SANCHEZ AARON",
  "GASTELUM CARRANZA CAMILA ERANDI",
  "GASTRONOMICA EDER, S. A. DE C. V.",
  "GOMEZ LOPEZ RAFAEL",
  "GONZALEZ MORALES LUZ MARIA PAULINA",
  "GRUPO GASTRONOMICO BACANORA SA DE CV",
  "GRUPO INMOBILIARIO MIJOAB, S. A. DE C. V.",
  "GRUPO MARHAM CONSTRUCCIONES, S. A. DE C. V.",
  "GUIA NISA, S. A. DE C. V.",
  "GUILLEN REYES SOLEDAD",
  "HORTALIZAS ROBEN",
  "HOSPEDAJE EFECTIVO S DE RL DE CV",
  "HOTEL AZUL",
  "HOTEL ZICATELA",
  "HOTELES LA NORIA, S. A. DE C. V.",
  "ICA CONSTRUCTORA, S. A. DE C. V.",
  "INMOBILIARIA ALJOSAN SA DE CV",
  "INSUMOS COMERCIALES RUTA ANTIGUA",
  "INTEGRADORA DE SERVICIOS A LA CONSTRUCCION TOLEDO LOPEZ",
  "INTEGRADORA PRODUCTIVA MARSA, S. A. DE C. V.",
  "INTI ESTATES, S. DE R. L. DE C. V.",
  "JACOBO HAMUI MIZRAHI",
  "JOSEPH COLLIN BIRD",
  "JURADO SOFIA VALERIA",
  "KADOPI, S. A. DE C. V.",
  "KEOSEYAN PADILLA ANNIK",
  "KIKO MEZCAL, S. A. DE C. V.",
  "KRUTZFELDT GRANIER ERIKA",
  "LA OLLA GASTRONOMIA Y ARTE DE OAXACA, S. A. DE C.V.",
  "LAMZ ARQUITECTURA, S. A. DE C. V.",
  "LARA SIRVENT FRANCISCO",
  "LEON BOHORQUEZ EDGAR AUGUSTO",
  "LEON LEON JORGE",
  "LGEC SA DE CV",
  "LIFUS ZIPOLITE SA DE CV",
  "LOMA PUERTO ESCONDIDO SA DE CV",
  "LOPEZ ISABEL",
  "LOPEZ MATEO FERNANDO",
  "LOPEZ PORTILLO INES VALADES",
  "MAQUILADORA PASTELERA, S. A. DE C. V.",
  "MAREC SOLUCIONES EN MANTENIMIENTO SA DE CV",
  "MARTINA D'ACOSTA TURRENT",
  "MARTINEZ MARTINEZ LIZBET",
  "MARTINEZ SANCHEZ LETICIA CECILIA",
  "MARTINEZ SOLIS KARLA",
  "MATUZ GIL ANA ALICIA",
  "MENDIVIL ITURRIOS LILIA ANGELICA",
  "MENDOZA GAGNIER GABRIEL GERARD",
  "MENXUEIRO LILIANA",
  "MEXSTAYS LUMINA SAPI DE CV",
  "MEZCAL EL SILENCIO RAICES, S. DE R. L. DE C. V.",
  "MOBILI PIAVE, S. A. DE C. V.",
  "MORALES RUIZ GISELA VIANNEY",
  "MORLAN RUIZ MARI NORMA",
  "MUCHAS PIEDRAS CONSTRUCCIONES S A DE C V",
  "MUSEO DE LA FILATELIA DE OAXACA, A. C.",
  "NILAHUI AC",
  "NOBLE DAVID",
  "NUÑEZ MENDEZ OMAR",
  "O&M CONSULTORES ESPECIALIZADOS, S. C.",
  "OFICENTRO DECORA, S. A. DE C. V.",
  "OGILVY & MATHER, S. A.",
  "OPERADORA GASTRONOMICA LOS DANZANTES SA DE CV",
  "P.R. DESARROLLO EMPRESARIAL Y DE NEGOCIOS EFICIENTE SA DE CV",
  "PAR DE DOS SA DE CV",
  "PASCAL AROESTE PHILIPPE",
  "PEDRO CRUZ",
  "PETAVAN, S. A. DE C. V.",
  "PONTEMEX, S. A. DE C. V.",
  "PQ SERVICIOS E INFRAESTRUCTURA SA DE CV",
  "PRIETO BARBACHANO DIEGO",
  "PROCESOS INDUSTRIALES VAUX, S. A DE C. V.",
  "PROCESOS INDUSTRIALIZABLES CREATIVOS",
  "PRODUCTOS JAKO, S. A. DE C. V.",
  "PROMOCION INTEGRAL DE DESTILADOS SA DE CV",
  "PROMOTORA TURISTICA COTTIER ARAGON, S. A. DE C. V.",
  "PROVEEDORA DE INSUMOS Y MULTISERVICIOS ARECA, S. A. DE C. V.",
  "PROYECTOS ESPECIALIZADOS CINCO S A DE C V",
  "RAMIREZ NOBLE JORGE DAVID",
  "RAMOS JARQUIN JOSE",
  "RANCHO PRIETO",
  "RENZO SPADA CAPORELLO",
  "RESTAURANTE XAOK",
  "REYES RODRIGUEZ JAVIER JOSE",
  "RITO PALOMEC VIVANY",
  "ROCHA ITURBIDE MAURICIO",
  "RODRIGUEZ GARCIA EDUARDO",
  "RODRIGUEZ MONICA",
  "ROMERO KAREN",
  "ROMERO TORAL MARIANA",
  "RUIZ JESUS",
  "SAN LORENZO",
  "SAZON DE MI CORAZON SA DE CV",
  "SEÑORITA ARELI",
  "SIERRA LONGEGA MARIA DE LOURDES",
  "SIERRA ROMO VICTOR MANUEL",
  "SILVIA CABRERA",
  "SISTEMAS ALEMANES PARA CORTE, S. A. DE C. V.",
  "SKAU INCORPORATED SA DE CV",
  "SOTELO ARELLANO IGNACIO",
  "SUMA RETAIL SA DE CV",
  "TALLER DE ARQUITECTURA JAVIER SANCHEZ, S. A. DE C. V.",
  "TALLER DE ARQUITECTURA MAURICIO ROCHA SA DE CV",
  "TALLER DE COMUNICACION GRAFICA, S. A. DE C. V.",
  "TALLER ENRIQUE OLVERA SC",
  "TALLER MECANICO INDUSTRIAL ELOY MARTINEZ VIGIL, S. A. DE C. V.",
  "TALLER TAF",
  "TANIA KARINA CAMIRO VARGAS",
  "TIENDAS FIX S DE RL DE CV",
  "TIZALAM DISEÑO, S. A. DE C. V.",
  "TOLEDO ANTONIO LARIZZA ALEJANDRA",
  "TOMA CAFE Y DUERME CONTENTO OAXACA SA DE CV",
  "TRILLING SUSAN ELLEN",
  "TSUTSUI MISAYO",
  "ULRICH TRILLING KAELIN MIGUEL",
  "UNDERWOOD SAENZ YDALIA TERESITA",
  "UNIVERSIDAD LA SALLE OAXACA, A. C.",
  "UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO",
  "UNIVERSIDAD REGIONAL DEL SURESTE, A. C.",
  "VELASQUEZ JIMENEZ EMANUEL CRISTOBAL",
  "VENTANA TRE, S. DE R. L. DE C. V.",
  "VICTORIA SAN JOSE SA DE CV",
  "VIDRIERIA JIMSA, S. A. DE C. V.",
  "VIVANY CORPORATIVO INMOBILIARIO",
  "VOCES DE COPAL S C DE P DE R L DE C V",
  "WATERBURY RONALD",
  "ZORRILLA SOCORRO",
];

const SUPPLIERS = [
  "ABARROTES LA SOLEDAD",
  "ACABADOS BUNACK SA DE CV",
  "AFILADURIA DEL SUR",
  "ALARCON MARTINEZ RAUL (SAYER IXCOTEL)",
  "ALFA FERRAMENTA",
  "ALIS ABASTECEDORA NACIONAL SA DE CV",
  "ALUMINIO Y METALES EL SOCORRO SA DE CV",
  "AMADOR MARTINEZ ANDRES LIZARDO",
  "AMAZON",
  "AMAZON MX",
  "AQUINO OLIVERA MAGALI",
  "ASTRO COLOR REFORMA (COMEX)",
  "AUTOZONE DE MEXICO S. DE R. L. DE C. V.",
  "AYUUJK TRUPER",
  "BANCOS SECUNDARIA",
  "BANORTE - MULTIMADERAS MEXICANAS, S. A. DE C. V.",
  "BONAVIDES ESCOBEDO FRANCISCO",
  "CASA IKEDA SA DE CV",
  "CENTRO DE DISTRIBUCION TORNILLERA DE OAXACA S. A. DE C. V.",
  "CENTRO TORNILLERO DEL SURESTE",
  "CHAPAS Y MADERAS IMPORTADAS SA DE CV",
  "COEL DE PUEBLA SA DE CV (MATERIAL Y EQUIPO ELECTRICO)",
  "COMERCIAL ELECTRIC",
  "COMERCIAL OAXAQUEÑA DE PINTURAS, S. A. DE C. V.",
  "COMEX",
  "CONSTRUACEROS RAMAR, S. A. DE C. V.",
  "CORPORATIVO EMPRESARIAL LA ASUNCION SA DE CV",
  "CRISTALERIA MEXICO",
  "CRUZ LOPEZ APOLINAR (LA CHAPA)",
  "DISTRIBUIDORA CADUCEO",
  "DYDEEK",
  "EFRAIN HERNANDEZ LUNA",
  "EL HERRADERO",
  "ELECTROFORMAS SA DE CV",
  "EMILIO HERNANDEZ",
  "ENCUADERNACIONES EL LIBRO SA DE CV",
  "END GRAIN DESIGN SA DE CV",
  "ESTACION DE SERVICIO CENTRAL (GASOLINERA)",
  "FAMILIA HERNANDEZ ZARATE (MADERA)",
  "FERRETERIA EL CLAVO OAXACA",
  "FERRETERIA LA NAVE",
  "FERRETERIA OAXAQUEÑA",
  "FERREYSA OAXACA",
  "FLETERA (FLETE)",
  "FLETERA OAXACA (FLETE FORANEO)",
  "FOTOS OAXACA",
  "GARCIA BAUTISTA ARMANDO",
  "GASOLINERA LA CALERA",
  "GASOLINERA RUFINO TAMAYO",
  "GRUPO COMERCIAL HESA SA DE CV",
  "GRUPO INDUSTRIAL MADERERO MEXICANO SA DE CV",
  "HARDWARE HOUSE",
  "HARO Y ASOC. (CONTADOR)",
  "HERBER",
  "HERRAMIENTAS RENTA Y VENTA",
  "HERRERIA VELASQUEZ",
  "HIERROS Y METALES OAXACA",
  "HOME DEPOT",
  "IMPRESORA FALCON SA DE CV",
  "INDUSTRIA FORESTAL ARBOL DE LA VIDA S DE RL DE CV",
  "INDUSTRIAL FORESTAL ARBOL DE LA VIDA S. DE R.L. DE C.V.",
  "INSUMOS ESPECIALIZADOS PARA CARPINTERIA S. DE R. L.",
  "INTERNET (TELMEX / CFE / OTRO)",
  "J & T COMPUTACION",
  "JALISCO FERRETERIA SA DE CV",
  "JIMENEZ RUIZ GERARDO",
  "KYWI FERRETERIA SA DE CV",
  "LA FERRETERIA (SIN NOMBRE EXACTO)",
  "LEIVA SERVICIOS AMBIENTALES SA DE CV",
  "LIBRERIA EL LIBRO SA DE CV",
  "LOPEZ CASTELLANOS BERNARDINO",
  "LUNA LUNA PABLO",
  "MADERAS Y ASERRADEROS ORTEGA",
  "MADERERIA EL BOSQUE SA DE CV",
  "MADERERIA LA ASUNCION",
  "MADERERA DEL SUR SA DE CV",
  "MADERERA MUNDIAL SA DE CV",
  "MADER CENTER LA ASUNCION, S. A. DE C. V.",
  "MANTENIMIENTO EL OAXAQUEÑO",
  "MARESA FERRETERIA SA DE CV",
  "MATERIALES LA PAZ SA DE CV",
  "MATERIALES Y SUMINISTROS INDUSTRIALES",
  "MAXI FERRETERIA SA DE CV",
  "MAZDA (AUTOS)",
  "MERCADO LIBRE",
  "MEZCAL (GASTOS DE REPRESENTACION)",
  "MOLDURAS Y PERFILES DE ALUMINIO SA DE CV",
  "MONTOYA ESPINOSA ERICK",
  "MULTIMADERAS MEXICANAS SA DE CV",
  "NARVAEZ GARCIA ARMANDO",
  "NORTE FERRETERIA SA DE CV",
  "OCAMPO CORTES MARIO",
  "OLEOS Y MADERAS",
  "OROZCO HERNANDEZ ARMANDO",
  "PAPELERIA LA CULTURA SA DE CV",
  "PAPELERIA UNIVERSITARIA",
  "PEREZ MARTINEZ JOSE",
  "PINTURAS COMEX SANTA CRUZ",
  "PINTURAS NACOBRE",
  "PLYWOOD LA ASUNCION",
  "PROVEEDORA OAXAQUEÑA DE ACABADOS SA DE CV",
  "PROVEEDORA OAXAQUEÑA DE MADERA SA DE CV",
  "RAMIREZ RAMIREZ IVAN",
  "RENTA DE BODEGA",
  "REPARACIONES INDUSTRIALES",
  "SAYER LACAS Y ACABADOS SA DE CV",
  "SERVICIOS DE LIMPIEZA",
  "SILVA SANCHEZ HUGO",
  "TABLEROS Y CHAPAS FINAS SA DE CV",
  "TALLER DE HERRERIA OAXAQUEÑO",
  "TECNICA INDUSTRIAL SA DE CV",
  "TELECOMUNICACIONES Y PAPELERIA",
  "TORNILLERIA INDUSTRIAL SA DE CV",
  "TORNILLOS Y HERRAJES DEL SUR",
  "TOTALGAS OAXACA",
  "TRUPER HERRAMIENTAS SA DE CV",
  "VARIOS (GASTOS MENORES)",
  "VILLANUEVA FLORES JOSE LUIS",
];

const PIECE_TYPES = [
  { id: 'pt-001', code: 'PTA', name: 'Puerta' },
  { id: 'pt-002', code: 'VEN', name: 'Ventana' },
  { id: 'pt-003', code: 'CLO', name: 'Closet' },
  { id: 'pt-004', code: 'COC', name: 'Cocina Integral' },
  { id: 'pt-005', code: 'LIB', name: 'Librero' },
  { id: 'pt-006', code: 'MES', name: 'Mesa / Comedor' },
  { id: 'pt-007', code: 'CAM', name: 'Cama / Cabecera' },
  { id: 'pt-008', code: 'ESC', name: 'Escritorio' },
  { id: 'pt-009', code: 'SAL', name: 'Sala / Sillón' },
  { id: 'pt-010', code: 'BAÑ', name: 'Mueble de Baño' },
  { id: 'pt-011', code: 'BAR', name: 'Barra / Bar' },
  { id: 'pt-012', code: 'ARR', name: 'Arrimadero / Panel' },
  { id: 'pt-013', code: 'ESL', name: 'Escalera' },
  { id: 'pt-014', code: 'VIT', name: 'Vitrina / Aparador' },
  { id: 'pt-015', code: 'REC', name: 'Recibidor / Console' },
  { id: 'pt-016', code: 'TEV', name: 'Mueble de TV' },
  { id: 'pt-017', code: 'EST', name: 'Estante / Repisa' },
  { id: 'pt-018', code: 'BAC', name: 'Banca / Banco' },
  { id: 'pt-019', code: 'GAB', name: 'Gabinete / Alacena' },
  { id: 'pt-020', code: 'TOC', name: 'Tocador / Dresser' },
  { id: 'pt-021', code: 'PER', name: 'Pérgola / Deck' },
  { id: 'pt-022', code: 'CUB', name: 'Cubierta / Countertop' },
  { id: 'pt-023', code: 'OTR', name: 'Otro / Especial' },
];

const PROJECTS = [
  "ALEJANDRA SPRIELLA",
  "ALFONSINA",
  "ALMACEN",
  "ANNIK KEOSEYAN",
  "BACANORA (CAJITAS)",
  "BANCOS GIRATORIOS MARTINA",
  "BANQUITOS TELESECUNDARIA",
  "BENJAMIN LOPEZ VITRINAS",
  "BERNA ANTONA",
  "BRUNO AERNE",
  "CAFÉ LOCAL",
  "CAJAS ARTESANIAS",
  "CAJAS ARTESANIAS ENERO",
  "CAJONES BACANORA",
  "CAMA JOSE LOPEZ",
  "CARLOS CORDOVA",
  "CASA CUNDA",
  "CASA CUNDA HOSTESS",
  "CASA MARGARITA",
  "CASA PRIETO VALLE DE BRAVO",
  "CASA S",
  "CASA VPE CUBIERTAS (HUBER)",
  "CASASNOVAS",
  "CAVA OCULTO",
  "CHAGOL",
  "CHAGOYA",
  "CLOSET LUIS ESPINOZA",
  "COMEDOR NELLY",
  "CRIOLLO",
  "CRIOLLO MAR26",
  "CUBIERTAS DANZANTES CDMX",
  "DAVID NOBLE",
  "EDIFICIO ALCALA",
  "EL TORON",
  "ETLA",
  "GUAYACAN BUNGALOWS",
  "HOTEL ZICATELA",
  "HOTELAZUL",
  "HUBER",
  "HUBER CBH",
  "INGRID CONTRERAS",
  "JAVIER ALVAREZ",
  "JAVIER RUIZ",
  "JAVIER Y PATRICIA",
  "KUYARIH ARQUITECTOS",
  "LIZBETH MARTINEZ",
  "LOS VITRALES ZORRILLA",
  "MALETERO LOS CABOS",
  "MANTENIMIENTO",
  "MANTENIMIENTO CASA CATARINA",
  "MANTENIMIENTO CUNA - JOSE LOPEZ",
  "MANTENIMIENTO GLORIA AMTMAN",
  "MANTENIMIENTO GUAYACAN",
  "MANTENIMIENTO NARANJOS",
  "MARCOS MISAYO",
  "MARIANA RAFUL",
  "MARTINA DACOSTA",
  "MAURICIO ROCHA",
  "MESAS DANZANTES",
  "MOBILIARIO OROSEI",
  "OTTY STUDIO",
  "PERGOLA CASASNOVA",
  "POLTRONA STUDIO",
  "PONTE",
  "PROYECTO BARCELONA",
  "PUERTA HOTEL AZUL",
  "PUERTA MONICA",
  "SAN LORENZO",
  "SILVIA CABRERA",
  "SOCORRO ZORRILLA",
  "TILCAJETE CAJA ANILLOS",
  "TILCAJETE CAJA TIGRE",
  "VALERIA SPRIELLA",
  "XAOK",
  "YA OAXACA",
];

const ACTIVIDADES = [
  'Cepillado y Escuadrado',
  'Corte y Despiece',
  'Montaje en Seco',
  'Encolado',
  'Detallado',
  'Pulido',
  'Barniz',
  'Emplaye',
  'Instalación',
];

const EXPENSE_CATEGORIES = [
  { id: 'cat-001', name: 'Materiales y Materia Prima',         type: 'gasto' },
  { id: 'cat-002', name: 'Nómina y Mano de Obra',              type: 'gasto' },
  { id: 'cat-003', name: 'Servicios Públicos',                  type: 'gasto' },
  { id: 'cat-004', name: 'Herramienta y Equipo',                type: 'gasto' },
  { id: 'cat-005', name: 'Transporte y Flete',                  type: 'gasto' },
  { id: 'cat-006', name: 'Mantenimiento Taller',                type: 'gasto' },
  { id: 'cat-007', name: 'Gastos Operativos Generales',         type: 'gasto' },
  { id: 'cat-008', name: 'Financieros',                         type: 'gasto' },
  { id: 'cat-009', name: 'Honorarios / Pago Socia',             type: 'gasto' },
  { id: 'cat-010', name: 'Viáticos y Gastos de Viaje',          type: 'gasto' },
  { id: 'cat-011', name: 'Anticipo de Cliente',                 type: 'ingreso' },
  { id: 'cat-012', name: 'Pago Final de Cliente',               type: 'ingreso' },
  { id: 'cat-013', name: 'Venta Directa / Stock',               type: 'ingreso' },
  { id: 'cat-014', name: 'Otros Ingresos',                      type: 'ingreso' },
  { id: 'cat-015', name: 'Transferencia entre cuentas propias', type: 'transferencia' },
];

// ── CSV helpers (for conceptos_inventario.csv) ───────────────────────────────

function parseCSVRow(str) {
  const result = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += c; }
  }
  result.push(current);
  return result;
}

function toTitleCase(str) {
  if (!str) return '';
  const SMALL = new Set(['y','de','el','la','los','las','en','para','con','a']);
  return str.toLowerCase().split(' ').map((w, i) => i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function numericCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  return Math.abs(hash).toString().padStart(10, '1000000000').substring(0, 10);
}

const CAT_MAP = { 'Herramientas': 'Herramienta', 'Tornilleria': 'Tornillería y Fijaciones' };
const BASE_CATEGORIES = ['Madera Maciza','Tableros y Chapas','Herrajes','Químicos y Barnices','Herramienta','Consumibles','Tornillería y Fijaciones','Vidrio y Espejo','Tapicería','Electricidad','Otros'];
const BASE_UNITS = ['pza','pt','lámina','kg','lt','ml','mt','mt2','gln','rollo','caja','par','juego','bolsa'];

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Carpintería Huayapam — Super Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Settings
  await db.collection('settings').doc('main').set(SETTINGS);
  console.log('✅  settings');

  // 2. Workers → contacts (tipo: trabajador)
  const workerContacts = WORKERS.map(w => ({
    ...w,
    tipo: 'trabajador',
    activo: true,
    phone: '', email: '', address: '',
  }));
  await batchWrite('contacts', workerContacts, d => d.id);
  console.log(`✅  ${WORKERS.length} trabajadores → contacts`);

  // 3. Clients → contacts (tipo: cliente)
  const clientDocs = CLIENTS.map(name => {
    const id = 'cli-' + slug(name, 40);
    return { id, name, tipo: 'cliente', activo: true, phone: '', email: '', address: '', givenName: name, paterno: '' };
  });
  await batchWrite('contacts', clientDocs, d => d.id);
  console.log(`✅  ${CLIENTS.length} clientes → contacts`);

  // 4. Suppliers → contacts (tipo: proveedor)
  const supplierDocs = SUPPLIERS.map(name => {
    const id = 'sup-' + slug(name, 40);
    return { id, name, tipo: 'proveedor', activo: true, phone: '', email: '', address: '', givenName: name, paterno: '' };
  });
  await batchWrite('contacts', supplierDocs, d => d.id);
  console.log(`✅  ${SUPPLIERS.length} proveedores → contacts`);

  // 5. Piece types
  await batchWrite('piece_types', PIECE_TYPES);
  console.log(`✅  ${PIECE_TYPES.length} tipos de pieza`);

  // 6. Historical projects — codes 0001, 0002, ...
  const projectDocs = PROJECTS.map((name, i) => {
    const id   = 'proj-hist-' + slug(name, 36);
    const code = String(i + 1).padStart(4, '0');
    return { id, code, name, status: 'completado', contactId: '', startDate: '', endDate: '', description: '', pieces: [], milestones: [], _seeded: true };
  });
  await batchWrite('projects', projectDocs, d => d.id);
  console.log(`✅  ${PROJECTS.length} proyectos históricos (códigos 0001–${String(PROJECTS.length).padStart(4,'0')})`);

  // 7. Actividades
  await db.collection('actividades_trabajo').doc('main').set({ list: ACTIVIDADES });
  console.log(`✅  actividades_trabajo`);

  // 8. Expense categories
  await batchWrite('expense_categories', EXPENSE_CATEGORIES);
  console.log(`✅  ${EXPENSE_CATEGORIES.length} categorías de gasto`);

  // 9. Conceptos de inventario (from CSV)
  const csvPath = path.join(__dirname, 'conceptos_inventario.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter(l => l.trim());
  lines.shift();

  const catsSet  = new Set();
  const unitsSet = new Set();
  const items    = [];

  for (const line of lines) {
    const row = parseCSVRow(line);
    if (row.length < 5) continue;
    const rawCat  = toTitleCase(row[1].trim());
    const cat     = CAT_MAP[rawCat] || rawCat;
    const unit    = row[2].trim().toLowerCase();
    if (cat)  catsSet.add(cat);
    if (unit) unitsSet.add(unit);
    const id = 'inv-' + row[0].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 150);
    items.push({
      id, code: numericCode(id),
      name: toTitleCase(row[0].trim()),
      category: cat, unit,
      cost: parseFloat(row[3].trim()) || 0,
      lastPurchaseDate: row[4].trim(),
      stock: 0, min: 0, location: '',
    });
  }

  const mergedCats  = Array.from(new Set([...BASE_CATEGORIES,  ...catsSet])).sort();
  const mergedUnits = Array.from(new Set([...BASE_UNITS, ...unitsSet])).sort();
  await db.collection('concept_categories').doc('main').set({ list: mergedCats });
  await db.collection('concept_units').doc('main').set({ list: mergedUnits });
  await batchWrite('inventory', items, d => d.id);
  console.log(`✅  ${items.length} conceptos de inventario (${mergedCats.length} categorías, ${mergedUnits.length} unidades)`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Seed completo.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
