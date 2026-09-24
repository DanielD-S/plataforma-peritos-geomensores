import JSZip from "jszip"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

// Las pruebas corren en Node; el KML se parsea con el DOMParser de jsdom.
globalThis.DOMParser = new JSDOM("").window.DOMParser
import { crsPorEpsg } from "./crs"
import { detectarCrsPrj, importarArchivo, leerNombresDbf, leerShp } from "./importar"
import { CONCESION_EJEMPLO } from "./modelo"
import { generarPaquete } from "./sernageomin"

describe("detección del .prj", () => {
  it("reconoce los cuatro sistemas oficiales por datum y meridiano central", () => {
    expect(detectarCrsPrj(crsPorEpsg(24878).prj)).toBe(24878)
    expect(detectarCrsPrj(crsPorEpsg(24879).prj)).toBe(24879)
    expect(detectarCrsPrj(crsPorEpsg(29188).prj)).toBe(29188)
    expect(detectarCrsPrj(crsPorEpsg(29189).prj)).toBe(29189)
  })
  it("reconoce WGS84 geográfico y UTM WGS84", () => {
    expect(detectarCrsPrj('GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]')).toBe("wgs84")
    expect(detectarCrsPrj('PROJCS["WGS_1984_UTM_Zone_19S",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["Central_Meridian",-69.0],UNIT["Meter",1.0]]')).toBe(32719)
    expect(detectarCrsPrj('PROJCS["Rara"]')).toBeNull()
  })
})

describe("shapefile de ida y vuelta", () => {
  it("lee el .shp y el .dbf generados por la plataforma", async () => {
    const p = await generarPaquete(CONCESION_EJEMPLO)
    const mensura = p.shapefiles.find((s) => s.base === "mensura")!
    const vertices = p.shapefiles.find((s) => s.base === "vertices_mensura")!
    const shp = leerShp(mensura.archivos["mensura.shp"].buffer as ArrayBuffer)
    expect(shp.poligonos).toHaveLength(1)
    expect(shp.poligonos[0]).toHaveLength(11)
    expect(leerNombresDbf(mensura.archivos["mensura.dbf"].buffer as ArrayBuffer)).toEqual([CONCESION_EJEMPLO.nombre])
    const pts = leerShp(vertices.archivos["vertices_mensura.shp"].buffer as ArrayBuffer)
    expect(pts.puntos).toHaveLength(10)
    expect(leerNombresDbf(vertices.archivos["vertices_mensura.dbf"].buffer as ArrayBuffer)[0]).toBe("L-1")
  })

  it("importa un ZIP con shapefile en el EPSG de destino sin alterar coordenadas", async () => {
    const p = await generarPaquete(CONCESION_EJEMPLO)
    const archivo = new File([await p.zips["Mensura.zip"].arrayBuffer()], "Mensura.zip")
    const r = await importarArchivo(archivo, 24879)
    expect(r.origen).toBe(24879)
    expect(r.reproyectado).toBe(false)
    expect(r.advertencias).toEqual([])
    expect(r.poligonos).toHaveLength(1)
    // El ZIP trae dos shapefiles (mensura y vertices_mensura), así que el nombre lleva la capa como prefijo.
    expect(r.poligonos[0].nombre).toBe(`mensura: ${CONCESION_EJEMPLO.nombre}`)
    expect(r.poligonos[0].anillo).toEqual(CONCESION_EJEMPLO.perimetroMensura)
    expect(r.poligonos[0].areaHa).toBeCloseTo(22, 9)
    expect(r.puntos).toHaveLength(10)
    expect(r.puntos[0]).toEqual({ nombre: "L-1", n: 7_477_000, e: 465_000 })
  })

  it("reproyecta y advierte cuando el archivo viene en otro huso", async () => {
    const p = await generarPaquete(CONCESION_EJEMPLO)
    const archivo = new File([await p.zips["Mensura.zip"].arrayBuffer()], "Mensura.zip")
    const r = await importarArchivo(archivo, 24878)
    expect(r.reproyectado).toBe(true)
    expect(r.advertencias[0]).toMatch(/referenciales/)
    // En huso 18 el este debe ser mucho mayor (la zona queda al este del meridiano -75).
    expect(r.poligonos[0].anillo[0].e).toBeGreaterThan(1_000_000)
  })
})

describe("KML", () => {
  it("importa polígonos y puntos reproyectando desde WGS84", async () => {
    const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
      <Placemark><name>Poli</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
        -69.3,-22.8,0 -69.29,-22.8,0 -69.29,-22.81,0 -69.3,-22.81,0 -69.3,-22.8,0
      </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
      <Placemark><name>HM</name><Point><coordinates>-69.295,-22.805,0</coordinates></Point></Placemark>
    </Document></kml>`
    const r = await importarArchivo(new File([kml], "prueba.kml"), 24879)
    expect(r.origen).toBe("wgs84")
    expect(r.reproyectado).toBe(true)
    expect(r.poligonos).toHaveLength(1)
    expect(r.poligonos[0].nombre).toBe("Poli")
    expect(r.poligonos[0].anillo).toHaveLength(4)
    expect(r.poligonos[0].anillo[0].n).toBeGreaterThan(7_400_000)
    expect(r.puntos[0].nombre).toBe("HM")
  })

  it("importa un KMZ", async () => {
    const z = new JSZip()
    z.file("doc.kml", `<kml><Placemark><name>P</name><Point><coordinates>-69.3,-22.8</coordinates></Point></Placemark></kml>`)
    const archivo = new File([await z.generateAsync({ type: "arraybuffer" })], "x.kmz")
    const r = await importarArchivo(archivo, 24879)
    expect(r.puntos).toHaveLength(1)
  })

  it("rechaza formatos desconocidos", async () => {
    await expect(importarArchivo(new File(["x"], "a.txt"), 24879)).rejects.toThrow(/Formato/)
  })
})
