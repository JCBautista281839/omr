# OMR POS Backend

A robust backend system for Optical Mark Recognition (OMR) based Point of Sale (POS) system.

## Features

- **Menu Management**: CRUD operations for menu items
- **Order Processing**: Handle orders with quantities and selections
- **OMR Integration**: Advanced OMR processing using Python OpenCV
- **RESTful API**: Clean API endpoints for frontend integration
- **Data Validation**: Input validation and error handling
- **Database**: SQLite database for data persistence
- **Python Integration**: Seamless Node.js to Python communication

## Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- Python 3.7 or higher
- pip (Python package manager)

### Automated Setup (Recommended)

**For Windows:**
```bash
setup.bat
```

**For Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r python/requirements.txt
```

3. Initialize the database:
```bash
npm run init
```

4. Start the development server:
```bash
npm run dev
```

5. The API will be available at `http://localhost:3000`

## API Endpoints

### Menu Management
- `GET /api/menu` - Get all menu items
- `POST /api/menu` - Create new menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get specific order
- `PUT /api/orders/:id` - Update order status

### OMR Processing
- `POST /api/omr/process` - Process scanned form image using Python OpenCV
- `POST /api/omr/process-to-order` - Process image and create order directly

## Environment Variables

Create a `.env` file:
```
PORT=3000
NODE_ENV=development
DB_PATH=./database.sqlite
PYTHON_PATH=python3
MAX_FILE_SIZE=5242880
```

## Database Schema

The system uses SQLite with the following tables:
- `menu_items` - Store menu information
- `orders` - Store order data
- `order_items` - Store individual items in orders
