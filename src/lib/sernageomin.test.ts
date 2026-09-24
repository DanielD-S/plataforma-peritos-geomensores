import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CONCESION_EJEMPLO } from "./modelo"
import { generarPaquete } from "./sernageomin"

describe("paquete Sernageomin", () => {
  it("genera los 7 shapefiles y los 5 ZIP del acta de ejemplo", async () => {
    const p = await generarPaquete(CONCESION_EJEMPLO)
    expect(p.shapefiles.map((s) => s.base)).toEqual([
      "manifestacion",
      "solicitud_mensura",
      "mensura",
      "vertices_mensura",
      "pertenencias",
      "vertices_pertenencias",
      "hito_de_mensura",
    ])
    expect(Object.keys(p.zips)).toEqual(["Manifestacion.zip", "Solicitud_mensura.zip", "Mensura.zip", "Pertenencias.zip", "Hito_de_mensura.zip"])
    for (const s of p.shapefiles) {
      expect(Object.keys(s.archivos)).toHaveLength(5)
      expect(s.archivos[`${s.base}.prj`].length).toBeGreaterThan(100)
    }
    expect(p.derivados.areaManifestacionHa).toBeCloseTo(40, 9)
    expect(p.derivados.areaMensuraHa).toBeCloseTo(22, 9)
    expect(p.derivados.grilla.pertenencias).toHaveLength(22)

    // Con PPG_SALIDA=<carpeta> escribe los shapefiles a disco para validarlos con QGIS o GeoPandas.
    const salida = process.env.PPG_SALIDA
    if (salida) {
      mkdirSync(salida, { recursive: true })
      for (const s of p.shapefiles) {
        for (const [nombre, contenido] of Object.entries(s.archivos)) writeFileSync(join(salida, nombre), contenido)
      }
      for (const [nombre, blob] of Object.entries(p.zips)) {
        writeFileSync(join(salida, nombre), new Uint8Array(await blob.arrayBuffer()))
      }
    }
  })

  it("sin hito produce un shapefile de hito vacío pero válido", async () => {
    const p = await generarPaquete({ ...CONCESION_EJEMPLO, hito: null })
    const hito = p.shapefiles.find((s) => s.base === "hito_de_mensura")!
    expect(hito.archivos["hito_de_mensura.shp"].length).toBe(100)
  })
})
