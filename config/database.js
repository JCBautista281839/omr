const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = process.env.DB_PATH || './database.sqlite';
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('📦 Connected to SQLite database');
          this.initializeTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async initializeTables() {
    const tables = [
      // Menu items table
      `CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category TEXT,
        is_available BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Orders table
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        table_number INTEGER,
        status TEXT DEFAULT 'pending',
        total_amount DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Order items table
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        special_instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
      )`,

      // OMR processed forms table
      `CREATE TABLE IF NOT EXISTS omr_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_type TEXT NOT NULL,
        image_path TEXT,
        processed_data TEXT,
        confidence_score DECIMAL(5,2),
        status TEXT DEFAULT 'processed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Insert sample menu items
    await this.insertSampleData();
  }

  async insertSampleData() {
    const sampleMenuItems = [
      { name: 'isda', description: 'Fresh fish dish', price: 150.00, category: 'main' },
      { name: 'egg', description: 'Fried egg', price: 25.00, category: 'side' },
      { name: 'water', description: 'Bottled water', price: 15.00, category: 'beverage' },
      { name: 'sinigang', description: 'Sour soup', price: 120.00, category: 'soup' },
      { name: 'Chicken', description: 'Grilled chicken', price: 180.00, category: 'main' },
      { name: 'pusit', description: 'Squid dish', price: 200.00, category: 'main' },
      { name: 'gatas', description: 'Fresh milk', price: 30.00, category: 'beverage' },
      { name: 'beef', description: 'Beef steak', price: 250.00, category: 'main' }
    ];

    for (const item of sampleMenuItems) {
      try {
        await this.run(
          'INSERT OR IGNORE INTO menu_items (name, description, price, category) VALUES (?, ?, ?, ?)',
          [item.name, item.description, item.price, item.category]
        );
      } catch (error) {
        console.log('Sample data already exists or error inserting:', error.message);
      }
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();
