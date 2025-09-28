# OMR POS Backend API Documentation

## Overview
A robust backend system for Optical Mark Recognition (OMR) based Point of Sale (POS) system designed for restaurant order management.

## Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager

### Installation
```bash
# Install dependencies
npm install

# Initialize database and sample data
node init.js

# Start development server
npm run dev

# Or start production server
npm start
```

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
DB_PATH=./database.sqlite
JWT_SECRET=your-secret-key-here
MAX_FILE_SIZE=5242880
```

## API Endpoints

### Health Check
- **GET** `/health` - Server health status
- **GET** `/` - API information and available endpoints

### Menu Management

#### Get All Menu Items
- **GET** `/api/menu`
- **Query Parameters:**
  - `category` (optional) - Filter by category
  - `available` (optional) - Filter by availability (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "isda",
      "description": "Fresh fish dish",
      "price": 150.00,
      "category": "main",
      "is_available": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 8
}
```

#### Get Specific Menu Item
- **GET** `/api/menu/:id`

#### Create Menu Item
- **POST** `/api/menu`
- **Body:**
```json
{
  "name": "New Item",
  "description": "Item description",
  "price": 99.99,
  "category": "main",
  "is_available": true
}
```

#### Update Menu Item
- **PUT** `/api/menu/:id`
- **Body:** Same as create

#### Delete Menu Item
- **DELETE** `/api/menu/:id`

#### Get Categories
- **GET** `/api/menu/categories/list`

### Order Management

#### Get All Orders
- **GET** `/api/orders`
- **Query Parameters:**
  - `status` (optional) - Filter by status
  - `limit` (optional) - Number of results (default: 50)
  - `offset` (optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_number": "ORD-1234567890-ABC1",
      "customer_name": "John Doe",
      "table_number": 5,
      "status": "pending",
      "total_amount": 275.00,
      "notes": "Extra spicy",
      "created_at": "2024-01-01T00:00:00.000Z",
      "items": [
        {
          "id": 1,
          "menu_item_id": 1,
          "quantity": 2,
          "unit_price": 150.00,
          "total_price": 300.00,
          "special_instructions": null,
          "menu_item_name": "isda"
        }
      ]
    }
  ],
  "count": 1
}
```

#### Get Specific Order
- **GET** `/api/orders/:id`

#### Create Order
- **POST** `/api/orders`
- **Body:**
```json
{
  "customer_name": "John Doe",
  "table_number": 5,
  "notes": "Extra spicy",
  "items": [
    {
      "menu_item_id": 1,
      "quantity": 2,
      "special_instructions": "Well done"
    }
  ]
}
```

#### Update Order Status
- **PUT** `/api/orders/:id/status`
- **Body:**
```json
{
  "status": "preparing"
}
```

**Valid Status Values:**
- `pending` - Order received
- `preparing` - Being prepared
- `ready` - Ready for serving
- `served` - Served to customer
- `cancelled` - Order cancelled

#### Get Order Statistics
- **GET** `/api/orders/stats/summary`
- **Query Parameters:**
  - `start_date` (optional) - Start date filter
  - `end_date` (optional) - End date filter

### OMR Processing

#### Process Image
- **POST** `/api/omr/process`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `image` (file) - Image file to process
  - `form_type` (string) - Type of form (menu_order, feedback, survey)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "form_type": "menu_order",
    "marks": [
      {
        "type": "quantity",
        "item": "isda",
        "position": { "x": 100, "y": 200, "width": 50, "height": 50 },
        "isMarked": true,
        "confidence": 0.85,
        "blackPixels": 425,
        "totalPixels": 500
      }
    ],
    "confidence": 85,
    "image_path": "/uploads/omr-1234567890.jpg"
  },
  "message": "OMR processing completed successfully"
}
```

#### Process Image to Order
- **POST** `/api/omr/process-to-order`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `image` (file) - Image file to process
  - `customer_name` (optional) - Customer name
  - `table_number` (optional) - Table number
  - `notes` (optional) - Order notes

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 1,
      "order_number": "OMR-1234567890-1234",
      "customer_name": "John Doe",
      "table_number": 5,
      "status": "pending",
      "total_amount": 275.00,
      "items": [...]
    },
    "omr_result": {
      "marks": [...],
      "confidence": 85
    }
  },
  "message": "Order created from OMR form successfully"
}
```

#### Get OMR History
- **GET** `/api/omr/history`
- **Query Parameters:**
  - `limit` (optional) - Number of results (default: 20)
  - `offset` (optional) - Pagination offset (default: 0)

## Database Schema

### menu_items
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT UNIQUE)
- `description` (TEXT)
- `price` (DECIMAL)
- `category` (TEXT)
- `is_available` (BOOLEAN)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### orders
- `id` (INTEGER PRIMARY KEY)
- `order_number` (TEXT UNIQUE)
- `customer_name` (TEXT)
- `table_number` (INTEGER)
- `status` (TEXT)
- `total_amount` (DECIMAL)
- `notes` (TEXT)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### order_items
- `id` (INTEGER PRIMARY KEY)
- `order_id` (INTEGER FOREIGN KEY)
- `menu_item_id` (INTEGER FOREIGN KEY)
- `quantity` (INTEGER)
- `unit_price` (DECIMAL)
- `total_price` (DECIMAL)
- `special_instructions` (TEXT)
- `created_at` (DATETIME)

### omr_forms
- `id` (INTEGER PRIMARY KEY)
- `form_type` (TEXT)
- `image_path` (TEXT)
- `processed_data` (TEXT JSON)
- `confidence_score` (DECIMAL)
- `status` (TEXT)
- `created_at` (DATETIME)

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "details": [] // For validation errors
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (duplicate entries)
- `413` - Payload Too Large
- `500` - Internal Server Error

## Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API request limiting
- **Input Validation** - Joi schema validation
- **File Upload Security** - File type and size restrictions
- **Error Handling** - Secure error responses

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

### File Structure
```
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   └── validation.js        # Validation middleware
├── routes/
│   ├── menu.js             # Menu API routes
│   ├── orders.js           # Order API routes
│   └── omr.js              # OMR processing routes
├── uploads/                # File upload directory
├── server.js               # Main server file
├── init.js                  # Database initialization
└── package.json            # Dependencies and scripts
```

## OMR Form Layout

The system is designed to work with forms similar to the provided image:
- **Quantity Column**: Checkboxes for quantity selection
- **Menu Column**: Radio buttons for item selection
- **Corner Markers**: L-shaped markers for form alignment

### Supported Menu Items
- isda (fish)
- egg
- water
- sinigang (sour soup)
- Chicken
- pusit (squid)
- gatas (milk)
- beef

## Performance Considerations

- **Image Processing**: Uses Jimp for efficient image manipulation
- **Database**: SQLite for lightweight, file-based storage
- **File Management**: Automatic cleanup of uploaded files
- **Caching**: Consider implementing Redis for production scaling
- **Compression**: Gzip compression enabled

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper CORS origins
3. Use a production database (PostgreSQL/MySQL)
4. Implement proper logging
5. Set up monitoring and health checks
6. Configure reverse proxy (nginx)
7. Enable HTTPS
8. Set up automated backups
