/**
 * Acta de mensura en Word (.docx), con la estructura de las actas presentadas a Sernageomin.
 * Las secciones numéricas salen de la geometría; los textos libres, de `concesion.acta`.
 * Lo que falte queda marcado como [COMPLETAR] para que el perito lo revise.
 */
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx"
import type { Superposicion } from "./catastro"
import { aGeograficas } from "./geodesia"
import { azimutCentesimal, descripcionPerimetro, distancia, relacionDesdePunto, type RelacionAzimut } from "./geometria"
import { azimutCl, coordenadaCl, numeroCl } from "./formato"
import type { Concesion, Perito } from "./modelo"
import type { Derivados } from "./sernageomin"
import { textoDistribucionVertices, textoHito, textoIndividualizacion, textoPuntoInteres, textoRelacionAmarre, textoVecinas } from "./textos"

export interface EntradaActa {
  concesion: Concesion
  perito: Perito
  derivados: Derivados
  superposiciones: Superposicion[]
}

const FALTA = "[COMPLETAR]"
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

export function fechaEnLetras(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return FALTA
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} del ${m[1]}`
}

function o(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : FALTA
}

function n(v: number | null | undefined, dec = 0): string {
  return v == null ? FALTA : numeroCl(v, dec)
}

const FUENTE = { font: "Times New Roman", size: 22 }

function parrafo(texto: string, opciones: { negrita?: boolean; centrado?: boolean; espacioDespues?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: opciones.centrado ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opciones.espacioDespues ?? 120 },
    children: [new TextRun({ text: texto, bold: opciones.negrita, ...FUENTE })],
  })
}

/** Párrafo con título en negrita seguido del texto ("ACCESO DEL H.M.- Para llegar..."). */
function seccion(titulo: string, texto: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [new TextRun({ text: `${titulo} `, bold: true, ...FUENTE }), new TextRun({ text: texto, ...FUENTE })],
  })
}

function tabla(encabezados: string[], filas: string[][], anchos?: number[]): Table {
  const borde = { style: BorderStyle.SINGLE, size: 4, color: "000000" }
  const celda = (t: string, negrita = false) =>
    new TableCell({
      borders: { top: borde, bottom: borde, left: borde, right: borde },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: negrita, ...FUENTE, size: 20 })] })],
    })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: anchos,
    rows: [new TableRow({ tableHeader: true, children: encabezados.map((h) => celda(h, true)) }), ...filas.map((f) => new TableRow({ children: f.map((c) => celda(c)) }))],
  })
}

function filasRelacion(r: RelacionAzimut[]): string[][] {
  return r.map((x) => [x.desde, x.hasta, azimutCl(x.azimut), numeroCl(x.distancia, 2)])
}

const UNIDADES =
  "Todos los valores angulares, con excepción de las coordenadas geográficas, son de graduación centesimal; los acimutes son UTM. Las distancias son UTM expresadas en metros y las elevaciones están referidas al nivel medio del mar, expresadas en metros. Las coordenadas geográficas están expresadas en graduación sexagesimal. Lo anterior es válido para actas y planos, salvo indicaciones expresas."

export function construirActa({ concesion: c, perito, derivados: d, superposiciones }: EntradaActa): Document {
  const a = c.acta
  const { grilla } = d
  const hito = c.hito && c.hito.n > 0 ? c.hito : null
  const amarre = c.amarre && c.amarre.n > 0 ? c.amarre : null
  const nombreHM = hito?.nombre || `HM ${c.nombre}`
  const nombreAmarre = amarre?.nombre || "punto de amarre"
  const nPert = grilla.pertenencias.length
  const areaPert = nPert ? grilla.pertenencias[0].areaHa : 0
  const individualizacion = textoIndividualizacion(grilla, c.prefijoPertenencias, c.pertenenciaEO, c.pertenenciaNS)
  const vecinas = textoVecinas(superposiciones)
  const hijos: (Paragraph | Table)[] = []
  const espacio = () => hijos.push(new Paragraph({ spacing: { after: 60 }, children: [] }))

  hijos.push(
    parrafo("ACTA DE MENSURA DE LAS PERTENENCIAS MINERAS", { negrita: true, centrado: true, espacioDespues: 0 }),
    parrafo(`"${o(c.nombre)}"`, { negrita: true, centrado: true, espacioDespues: 0 }),
    parrafo(`UBICADAS EN LA COMUNA DE ${o(a.comuna).toUpperCase()}, PROVINCIA DE ${o(a.provincia).toUpperCase()}, ${o(a.region).toUpperCase()}.`, { negrita: true, centrado: true, espacioDespues: 0 }),
    parrafo(`ROL NACIONAL ${o(c.rol)}`, { negrita: true, centrado: true, espacioDespues: 240 }),
    parrafo("S.J.L.", { negrita: true }),
    parrafo(
      `Con fecha ${fechaEnLetras(c.fechaMensura)}, el perito que suscribe ${o(perito.nombre)}, designado perito mensurador en los autos número ${o(a.causaRol)} del ${o(a.juzgado)}, procedió a ejecutar la mensura de las pertenencias mineras "${o(c.nombre)}", de propiedad de ${o(a.titular)}. Estas pertenencias fueron manifestadas con fecha ${fechaEnLetras(c.fechaManifestacion)}, por ${o(a.manifestante)}, con el nombre de "${o(a.nombreManifestacion || c.nombre)}", con una superficie total de ${n(a.hectareasManifestadas)} hectáreas, inscritas con fecha ${fechaEnLetras(a.fechaInscripcion)}, en el Registro de Descubrimiento del ${o(a.conservador)} a fojas ${o(a.fojas)}, N° ${o(a.numeroInscripcion)}. Con fecha ${fechaEnLetras(c.fechaSolicitudMensura)}, se solicitaron mensurar ${n(a.pertenenciasSolicitadas)} pertenencias, con un total de ${n(a.hectareasSolicitadas)} hectáreas. La mensura comprende: ${nPert} pertenencias de ${numeroCl(areaPert, areaPert % 1 === 0 ? 0 : 2)} ${areaPert === 1 ? "hectárea" : "hectáreas"} cada una, dando un total de ${numeroCl(d.areaMensuraHa, d.areaMensuraHa % 1 === 0 ? 0 : 2)} hectáreas.`,
    ),
  )
  if (a.exploracionInvocada.trim()) {
    hijos.push(
      parrafo(
        `Esta manifestación fue hecha invocando la Concesión de Exploración denominada ${a.exploracionInvocada.trim()}${a.juzgadoExploracion.trim() ? `, cuya tramitación ante el ${a.juzgadoExploracion.trim()} se inició con fecha ${fechaEnLetras(a.fechaInicioExploracion)}` : ""}.`,
      ),
    )
  }

  hijos.push(parrafo("COORDENADAS UTM DE LOS VERTICES DEL PERIMETRO DE LA MENSURA", { negrita: true, centrado: true }))
  hijos.push(tabla(["VÉRTICE", "NORTE (metros)", "ESTE (metros)"], grilla.linderos.map((l) => [l.nombre, coordenadaCl(l.n), coordenadaCl(l.e)])))
  espacio()
  hijos.push(seccion("COORDENADAS UTM DEL PUNTO DE INTERÉS (P.I.).-", textoPuntoInteres(c.pi)))
  hijos.push(
    seccion(
      "UBICACIÓN DEL HM Y DE LAS PERTENENCIAS.-",
      `Se ubica en la ${o(a.region)}, Provincia de ${o(a.provincia)} y comuna de ${o(a.comuna)}, lugar ${o(a.lugar)}. ${hito ? textoHito(hito, aGeograficas(hito, c.epsg)) : FALTA}`,
    ),
  )
  hijos.push(seccion("ACCESO DEL H.M.-", o(a.acceso)))
  hijos.push(seccion("YACIMIENTO.-", o(a.yacimiento)))
  hijos.push(seccion("UNIDADES DE MEDIDA.-", UNIDADES))
  hijos.push(seccion("INSTRUMENTAL UTILIZADO.-", o(a.instrumental)))
  hijos.push(seccion("LIGAZÓN DEL H.M. A LA RED GEODÉSICA.-", o(a.ligazon)))
  hijos.push(seccion("RELACIÓN DEL H.M. CON EL PUNTO DE AMARRE.-", hito && amarre ? textoRelacionAmarre(hito, amarre) : FALTA))

  const geodesicos = [...(amarre ? [amarre] : []), ...c.auxiliares.filter((x) => x.n > 0), ...(hito ? [{ ...hito, nombre: nombreHM }] : [])]
  if (geodesicos.length) {
    hijos.push(parrafo("Las coordenadas UTM y alturas de los vértices utilizados en la mensura son los siguientes:"))
    hijos.push(tabla(["VÉRTICE", "NORTE (m)", "ESTE (m)", "ELEVACIÓN (m.s.n.m.)"], geodesicos.map((g) => [g.nombre || FALTA, numeroCl(g.n, 3), numeroCl(g.e, 3), g.altura != null ? numeroCl(g.altura, 2) : FALTA])))
    espacio()
  }

  hijos.push(seccion("OPERACIÓN DE MENSURA Y COLOCACIÓN DE LINDEROS.-", o(a.operacion)))
  if (amarre && grilla.linderos.length) {
    hijos.push(parrafo("La relación en azimut y distancia del alinderamiento del perímetro se muestra a continuación."))
    hijos.push(tabla(["DE", "A", "AZIMUT (g)", "DISTANCIA UTM"], filasRelacion(relacionDesdePunto({ ...amarre, nombre: nombreAmarre }, grilla.linderos))))
    espacio()
  }
  if (hito && grilla.linderos.length) {
    hijos.push(
      seccion(
        "CUADRO DE RELACIÓN AZIMUT Y DISTANCIA DEL HITO DE MENSURA A LOS LINDEROS.-",
        "La relación de azimut y distancia desde el hito de mensura y los linderos que conforman el perímetro de la mensura se indica a continuación.",
      ),
    )
    hijos.push(tabla(["DE", "A", "AZIMUT (g)", "DISTANCIA UTM"], filasRelacion(relacionDesdePunto({ ...hito, nombre: nombreHM }, grilla.linderos))))
    espacio()
  }
  hijos.push(seccion("LINDEROS, H.M.-", `${o(a.linderos)} ${o(a.hitoDescripcion)}`))
  hijos.push(
    seccion(
      "DESCRIPCIÓN DEL PERÍMETRO.-",
      "El perímetro se describirá en forma tabular; la primera columna corresponde al lindero vértice desde el cual se aplica el azimut y distancia UTM de las columnas 3 y 4, respectivamente, para ubicar el lindero vértice indicado en la columna 2.",
    ),
  )
  const perimetro: RelacionAzimut[] = [
    ...(hito && grilla.linderos[0] ? [{ desde: nombreHM, hasta: grilla.linderos[0].nombre, azimut: azimutCentesimal(hito, grilla.linderos[0]), distancia: distancia(hito, grilla.linderos[0]) }] : []),
    ...descripcionPerimetro(grilla.linderos),
  ]
  hijos.push(tabla(["DESDE", "HASTA", "AZIMUT UTM (grd.)", "DISTANCIA UTM (m.)"], filasRelacion(perimetro)))
  espacio()
  hijos.push(seccion("DISTRIBUCIÓN DE LOS VÉRTICES.", textoDistribucionVertices(grilla, c.pertenenciaEO, c.pertenenciaNS)))
  hijos.push(seccion("INDIVIDUALIZACIÓN DE LAS PERTENENCIAS.", individualizacion.encabezado))
  if (individualizacion.filas.length) {
    const mitad = Math.ceil(individualizacion.filas.length / 2)
    const filas: string[][] = []
    for (let i = 0; i < mitad; i++) {
      const izq = individualizacion.filas[i]
      const der = individualizacion.filas[i + mitad]
      filas.push([izq.nombre, izq.vertices, der?.nombre ?? "", der?.vertices ?? ""])
    }
    hijos.push(tabla(["NOMBRE", "VÉRTICES", "NOMBRE", "VÉRTICES"], filas))
    espacio()
  }
  hijos.push(seccion("PERTENENCIAS VECINAS.-", vecinas.vecinas.replace(/\n/g, " ")))
  hijos.push(seccion("ABARCAMIENTO.-", `${vecinas.abarcamiento}${a.observaciones.trim() ? ` ${a.observaciones.trim()}` : ""}`))
  hijos.push(seccion("DEMASÍAS.-", o(a.demasias)))
  hijos.push(seccion("DOMICILIO DEL PERITO.-", `${o(perito.domicilio)} RUT ${o(perito.rut)}.`))
  hijos.push(new Paragraph({ spacing: { before: 720 }, children: [] }))
  hijos.push(parrafo(o(perito.nombre), { negrita: true, centrado: true, espacioDespues: 0 }))
  hijos.push(parrafo("Perito Mensurador", { centrado: true }))

  return new Document({
    creator: "Plataforma Peritos Geomensores",
    title: `Acta de mensura ${c.nombre}`,
    styles: { default: { document: { run: FUENTE } } },
    sections: [{ properties: { page: { margin: { top: 1418, bottom: 1418, left: 1701, right: 1418 } } }, children: hijos }],
  })
}

export async function generarActaDocx(entrada: EntradaActa): Promise<Blob> {
  return Packer.toBlob(construirActa(entrada))
}

export async function generarActaBuffer(entrada: EntradaActa): Promise<Uint8Array> {
  return Packer.toBuffer(construirActa(entrada))
}
