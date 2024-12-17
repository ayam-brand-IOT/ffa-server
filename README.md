# ffa-server

**ffa-server** is the Node.js-based server component of the **Frozen Fish Analysis (FFA)** system. It provides RESTful APIs for managing batches, samples, and additional fish analysis data. It also supports file uploads, image serving, and Excel export functionality.

The server communicates with the `ffa-app` over **port 3002**.

## Features

- **Batch Management**: Add, edit, and retrieve batches.
- **Sample Management**: Upload images, add samples, and retrieve sample history.
- **Image Handling**: Serve uploaded images for analysis.
- **Excel Export**: Generate Excel files containing sample data for specific lots.

## Requirements

- **Node.js**: v16+ (recommended).
- **npm**: v8+.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ayam-brand-IOT/ffa-server.git
   cd ffa-server
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run the Server**:
   ```bash
   npm start
   ```

   The server will run on `http://localhost:3002`.

## API Endpoints

### Sample Management

| Method | Endpoint                     | Description                        |
|--------|------------------------------|------------------------------------|
| POST   | `/add`                       | Add a new sample with image upload.|
| GET    | `/history/:page`             | Retrieve paginated sample history. |
| GET    | `/history`                   | Retrieve full sample history.      |
| GET    | `/lot_samples/:lot_no`       | Get samples for a specific lot.    |
| GET    | `/lot_samples_full/:lot_no`  | Get full details of lot samples.   |
| GET    | `/muestra_image/:path`       | Retrieve uploaded sample image.    |

### Lot Management

| Method | Endpoint                     | Description                        |
|--------|------------------------------|------------------------------------|
| POST   | `/add_lot`                   | Add a new lot.                     |
| POST   | `/edit_lot`                  | Edit existing lot information.     |
| GET    | `/lots/:page`                | Retrieve paginated lots.           |
| POST   | `/add-lot-image`             | Upload additional lot image.       |
| GET    | `/lot_images/:lot_no`        | Get all images from a lot.         |
| GET    | `/lot_image/:path`           | Retrieve a specific lot image.     |

### Tension Test

| Method | Endpoint                     | Description                        |
|--------|------------------------------|------------------------------------|
| POST   | `/add-lot-tension`           | Add a tension test for a lot.      |
| GET    | `/lot_tension/:lot_no`       | Retrieve tension tests for a lot.  |

### Excel Export

| Method | Endpoint                     | Description                        |
|--------|------------------------------|------------------------------------|
| GET    | `/download-lot-samples/:lot_no` | Export lot sample data as Excel.    |

### Utility Endpoints

| Method | Endpoint                     | Description                        |
|--------|------------------------------|------------------------------------|
| GET    | `/select/:id`                | Retrieve specific sample by ID.    |
| POST   | `/delete`                    | Delete sample data by ID.          |

## File Uploads and Image Serving

- Images uploaded through `/add` or `/add-lot-image` are stored in the `muestras` folder.
- Images can be retrieved using the endpoints:
  - `/muestra_image/:path`
  - `/lot_image/:path`

## Excel Export

The `/download-lot-samples/:lot_no` endpoint generates an Excel file containing sample data for a specific lot.

### File Format

| Column        | Description         |
|---------------|---------------------|
| `id`         | Sample ID.          |
| `lot_no`     | Lot number.         |
| `weight`     | Sample weight.      |
| `length`     | Sample length.      |
| `height`     | Sample height.      |
| `date`       | Date of sample.     |
| `defects`    | Defect details.     |

## Directory Structure

```
ffa-server/
│
├── public/             # Static files served by the server
├── muestras/           # Uploaded images
├── services/           # Business logic for lots, samples, and tests
├── data/               # SQLite database storage
├── scripts/            # Utility scripts (e.g., database initialization)
├── data.xlsx           # Temporary Excel files
├── app.js              # Main server file
└── package.json        # Project dependencies and scripts
```

## Running the Server

- **Start in Production**:
   ```bash
   npm start
   ```

## Updating the Server

1. **Pull Latest Changes**:
   ```bash
   git pull origin main
   ```

2. **Install New Dependencies**:
   ```bash
   npm install
   ```

3. **Restart the Server**:
   ```bash
   npm restart
   ```

## Contribution Guidelines

1. Fork the repository.
2. Open a pull request with detailed descriptions of your changes.
3. Follow standard Node.js and JavaScript practices.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For further details or support, please contact the system administrator or project maintainer.
