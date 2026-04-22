# ffa-server

API REST del sistema FFA. Este servicio centraliza persistencia en SQLite, subida y consulta de imagenes, pruebas de tension y exportacion de muestras por lote.

## Rol dentro del sistema

- recibe lotes, muestras e imagenes extra desde la UI
- guarda la informacion en SQLite
- sirve imagenes almacenadas en la carpeta configurada para uploads
- genera archivos Excel por lote

`ffa-server` escucha por defecto en `http://localhost:3002`.

## Stack

- Node.js 16+
- Express
- better-sqlite3
- Multer
- ExcelJS

## Estructura principal

```text
ffa-server/
├── index.js
├── config.js
├── fish_analysis.db
├── muestras/
├── public/
├── services/
│   ├── db.js
│   ├── lots.js
│   ├── muestras.js
│   ├── extraImages.js
│   └── tensionTest.js
├── Dockerfile
└── package.json
```

## Instalacion y arranque

```bash
cd ffa-server
npm install
npm start
```

El script `start` ejecuta `node index.js`.

## Configuracion

El servicio puede correr con sus rutas locales por defecto o con variables de entorno para despliegue:

| Variable | Default | Uso |
| --- | --- | --- |
| `PORT` | `3002` | Puerto HTTP del server |
| `DATABASE_PATH` | `./fish_analysis.db` | Ruta del archivo SQLite activo |
| `UPLOADS_PATH` | `./muestras` | Carpeta donde se guardan y leen imagenes |

Si `DATABASE_PATH` apunta a un archivo que todavia no existe, el server copia la DB semilla `fish_analysis.db` a esa ruta. Esto permite montar un volumen vacio en Docker y arrancar con el esquema actual.

## Modelo de datos que maneja el codigo

### Lotes

Campos esperados por `services/lots.js`:

- `supplier`
- `lot_no`
- `production_date`
- `fish_species`
- `type`
- `size`
- `order_no`
- `wms_code`

### Muestras

Campos usados por `services/muestras.js`:

- `image`
- `weight`
- `length`
- `height`
- `head_length`
- `tail_trigger`
- `defects`
- `lot_no`

### Imagenes extra por lote

- `lot_no`
- `image`

### Prueba de tension

- `lot_no`
- `break_point`

## API disponible

### Lotes

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/add_lot` | Crea un lote |
| `POST` | `/edit_lot` | Edita un lote existente usando `lot_no` |
| `GET` | `/lots` | Regresa todos los lotes |
| `GET` | `/lots/:page` | Regresa lotes paginados |

### Muestras

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/add` | Crea una muestra con imagen subida por formulario multipart |
| `GET` | `/history` | Regresa todas las muestras |
| `GET` | `/history/:page` | Regresa muestras paginadas |
| `GET` | `/lot_samples/:lot_no` | Regresa muestras de un lote |
| `GET` | `/lot_samples_full/:lot_no` | Regresa muestras con defectos concatenados |
| `GET` | `/select/:id` | Regresa una muestra especifica |
| `POST` | `/delete` | Borra una muestra y sus defectos asociados |

### Imagenes

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/add-lot-image` | Sube una imagen extra para un lote |
| `GET` | `/lot_images/:lot_no` | Lista imagenes extra del lote |
| `GET` | `/muestra_image/:path` | Sirve imagen de muestra |
| `GET` | `/lot_image/:path` | Sirve imagen extra |

### Tension

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/add-lot-tension` | Guarda un punto de ruptura para un lote |
| `GET` | `/lot_tension/:lot_no` | Consulta pruebas de tension del lote |

### Exportacion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/download-lot-samples/:lot_no` | Genera y descarga un `.xlsx` con muestras del lote |

## Formatos de uso

### Crear lote

```http
POST /add_lot
Content-Type: application/json
```

```json
{
  "supplier": "Proveedor A",
  "lot_no": "LOT-001",
  "production_date": "2026-04-21",
  "fish_species": "MACK",
  "type": "HG",
  "size": "XL",
  "order_no": "PO-123",
  "wms_code": "WMS-999"
}
```

### Crear muestra con imagen

`/add` espera `multipart/form-data` con:

- `image`: archivo JPG
- `lot_no`
- `weight`
- `length`
- `height`
- `head_length`
- `tail_trigger`
- `defects`: string JSON, por ejemplo `[0,2,4]`

## Exportacion a Excel

El archivo descargado incluye estas columnas:

- `id`
- `Lot #`
- `Order No`
- `Supplier`
- `Weight`
- `Length`
- `Height`
- `Date`
- `Defects`

Internamente se genera un `data.xlsx` temporal en el directorio del servicio y se elimina despues de enviarse.

## Persistencia y archivos

- la base por defecto es `fish_analysis.db`
- en Docker standalone se usa `./data/ffa-server.sqlite` montado como volumen
- las imagenes por defecto se guardan en `muestras/`
- en Docker standalone las imagenes se guardan en `./muestras`
- tanto `/muestra_image/:path` como `/lot_image/:path` leen desde la misma carpeta configurada en `UPLOADS_PATH`

## Consideraciones actuales

- `config.js` solo controla paginacion con `LIST_PER_PAGE`
- CORS esta abierto a `*`

## Docker

### Imagen simple

```bash
docker build -t ffa-server .
docker run \
  -p 3002:3002 \
  -e DATABASE_PATH=/app/data/ffa-server.sqlite \
  -e UPLOADS_PATH=/app/muestras \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/muestras:/app/muestras" \
  ffa-server
```

### Compose standalone

Para probar solo este server, sin levantar `ffa-app` ni la UI:

```bash
docker compose -f docker-compose.standalone.yml up --build
```

Datos persistentes:

- SQLite: `./data/ffa-server.sqlite`
- Imagenes: `./muestras/`

En el repo raiz tambien hay un `docker-compose.yaml` para levantarlo junto con `ffa-app`, pero esta rama esta pensada para probar el server separado.
