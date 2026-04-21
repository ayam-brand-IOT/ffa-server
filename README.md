# ffa-server

API REST del sistema FFA. Este servicio centraliza persistencia en SQLite, subida y consulta de imagenes, pruebas de tension y exportacion de muestras por lote.

## Rol dentro del sistema

- recibe lotes, muestras e imagenes extra desde la UI
- guarda la informacion en `fish_analysis.db`
- sirve imagenes almacenadas en `muestras/`
- genera archivos Excel por lote

`ffa-server` escucha en `http://localhost:3002`.

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

- la base usada por el codigo es `fish_analysis.db`
- las imagenes se guardan en `muestras/`
- tanto `/muestra_image/:path` como `/lot_image/:path` leen desde la misma carpeta `muestras/`

## Consideraciones actuales

- el puerto esta fijo en `3002`; el codigo no lee hoy una variable `PORT`
- `services/db.js` abre `fish_analysis.db` por ruta relativa local; la variable `DATABASE_PATH` del `docker-compose` no se consume actualmente
- `config.js` solo controla paginacion con `LIST_PER_PAGE`
- CORS esta abierto a `*`

## Docker

```bash
docker build -t ffa-server ./ffa-server
docker run -p 3002:3002 ffa-server
```

En el repo raiz hay un `docker-compose.yaml` para levantarlo junto con `ffa-app`.
