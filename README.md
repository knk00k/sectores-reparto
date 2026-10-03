# Sectores de reparto

Aplicación web para visualizar sectores en un mapa, revisar sus límites y exportar sus coordenadas desde archivos KMZ o KML.

## Funciones

- Cargar archivos KMZ y KML con una o varias zonas.
- Buscar y seleccionar sectores por comuna, nombre o número.
- Elegir el punto inicial y el sentido de los vértices.
- Ajustar límites en el mapa y deshacer cambios.
- Descargar resultados en Excel, CSV o GeoJSON.
- Probar la herramienta con datos de ejemplo.

## Instalación

Requiere Node.js 22.12 o posterior.

```sh
npm install
npm run dev
```

Abre la dirección local que indique la terminal.

## Uso

1. Sube un archivo KMZ o KML, o carga el ejemplo.
2. Selecciona una zona y revisa sus puntos. Puedes reordenarlos o ajustar el límite.
3. Descarga el sector seleccionado, los sectores de una comuna o todo el archivo.

Los archivos se procesan en el navegador. Descarga los resultados antes de cerrar o recargar la página para conservar tus cambios. El mapa de fondo requiere conexión a internet.

## Exportación

| Formato | Contenido |
| --- | --- |
| Excel | Resumen y hojas por comuna con Zona, Puntos, X e Y. |
| CSV | Tres columnas: Zona, Puntos y X e Y juntas en una celda. |
| GeoJSON | Polígonos y vértices con sus coordenadas. |

En la tabla, Excel y CSV, **X es latitud e Y es longitud**. La geometría GeoJSON utiliza el orden **longitud, latitud**.

## Desarrollo

Proyecto construido con JavaScript, HTML, CSS, Vite y Leaflet.

```sh
npm test         # Ejecutar pruebas
npm run build    # Generar la aplicación en dist/
npm run preview  # Revisar la compilación localmente
```

La carpeta `dist/` puede alojarse en un servicio de hosting estático. El proyecto incluye configuración para Firebase Hosting.
