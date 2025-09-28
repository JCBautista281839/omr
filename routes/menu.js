const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { validate, schemas, asyncHandler } = require('../middleware/validation');

// GET /api/menu - Get all menu items
router.get('/', asyncHandler(async (req, res) => {
  const { category, available } = req.query;
  
  let sql = 'SELECT * FROM menu_items WHERE 1=1';
  const params = [];
  
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  
  if (available !== undefined) {
    sql += ' AND is_available = ?';
    params.push(available === 'true' ? 1 : 0);
  }
  
  sql += ' ORDER BY category, name';
  
  const menuItems = await db.all(sql, params);
  
  res.json({
    success: true,
    data: menuItems,
    count: menuItems.length
  });
}));

// GET /api/menu/:id - Get specific menu item
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const menuItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
  
  if (!menuItem) {
    return res.status(404).json({
      success: false,
      error: 'Menu item not found'
    });
  }
  
  res.json({
    success: true,
    data: menuItem
  });
}));

// POST /api/menu - Create new menu item
router.post('/', validate(schemas.menuItem), asyncHandler(async (req, res) => {
  const { name, description, price, category, is_available = true } = req.body;
  
  const result = await db.run(
    'INSERT INTO menu_items (name, description, price, category, is_available) VALUES (?, ?, ?, ?, ?)',
    [name, description, price, category, is_available]
  );
  
  const newMenuItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [result.id]);
  
  res.status(201).json({
    success: true,
    data: newMenuItem,
    message: 'Menu item created successfully'
  });
}));

// PUT /api/menu/:id - Update menu item
router.put('/:id', validate(schemas.menuItem), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, is_available } = req.body;
  
  // Check if menu item exists
  const existingItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Menu item not found'
    });
  }
  
  await db.run(
    'UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?, is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description, price, category, is_available, id]
  );
  
  const updatedItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
  
  res.json({
    success: true,
    data: updatedItem,
    message: 'Menu item updated successfully'
  });
}));

// DELETE /api/menu/:id - Delete menu item
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if menu item exists
  const existingItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Menu item not found'
    });
  }
  
  // Check if menu item is used in any orders
  const orderItems = await db.all('SELECT id FROM order_items WHERE menu_item_id = ?', [id]);
  if (orderItems.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete menu item',
      message: 'This item is referenced in existing orders. Consider marking it as unavailable instead.'
    });
  }
  
  await db.run('DELETE FROM menu_items WHERE id = ?', [id]);
  
  res.json({
    success: true,
    message: 'Menu item deleted successfully'
  });
}));

// GET /api/menu/categories - Get all categories
router.get('/categories/list', asyncHandler(async (req, res) => {
  const categories = await db.all('SELECT DISTINCT category FROM menu_items WHERE category IS NOT NULL ORDER BY category');
  
  res.json({
    success: true,
    data: categories.map(cat => cat.category)
  });
}));

module.exports = router;
