const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { validate, schemas, asyncHandler } = require('../middleware/validation');
const { v4: uuidv4 } = require('uuid');

// GET /api/orders - Get all orders (temporarily disabled)
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [],
    count: 0,
    message: 'Orders temporarily disabled for testing'
  });
}));

// GET /api/orders/:id - Get specific order
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await db.get(`
    SELECT o.*, 
           GROUP_CONCAT(
             json_object(
               'id', oi.id,
               'menu_item_id', oi.menu_item_id,
               'quantity', oi.quantity,
               'unit_price', oi.unit_price,
               'total_price', oi.total_price,
               'special_instructions', oi.special_instructions,
               'menu_item_name', mi.name,
               'menu_item_description', mi.description
             )
           ) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.id = ?
    GROUP BY o.id
  `, [id]);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  // Parse items JSON
  order.items = order.items ? JSON.parse(`[${order.items}]`) : [];
  
  res.json({
    success: true,
    data: order
  });
}));

// POST /api/orders - Create new order
router.post('/', validate(schemas.order), asyncHandler(async (req, res) => {
  const { customer_name, table_number, notes, items } = req.body;
  
  // Generate unique order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  // Start transaction
  const orderResult = await db.run(
    'INSERT INTO orders (order_number, customer_name, table_number, notes) VALUES (?, ?, ?, ?)',
    [orderNumber, customer_name, table_number, notes]
  );
  
  const orderId = orderResult.id;
  let totalAmount = 0;
  
  // Process each item
  for (const item of items) {
    // Get menu item details
    const menuItem = await db.get('SELECT * FROM menu_items WHERE id = ? AND is_available = 1', [item.menu_item_id]);
    
    if (!menuItem) {
      throw new Error(`Menu item with ID ${item.menu_item_id} not found or unavailable`);
    }
    
    const unitPrice = menuItem.price;
    const totalPrice = unitPrice * item.quantity;
    totalAmount += totalPrice;
    
    // Insert order item
    await db.run(
      'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, special_instructions) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, item.menu_item_id, item.quantity, unitPrice, totalPrice, item.special_instructions]
    );
  }
  
  // Update order total
  await db.run('UPDATE orders SET total_amount = ? WHERE id = ?', [totalAmount, orderId]);
  
  // Get complete order details
  const completeOrder = await db.get(`
    SELECT o.*, 
           GROUP_CONCAT(
             json_object(
               'id', oi.id,
               'menu_item_id', oi.menu_item_id,
               'quantity', oi.quantity,
               'unit_price', oi.unit_price,
               'total_price', oi.total_price,
               'special_instructions', oi.special_instructions,
               'menu_item_name', mi.name,
               'menu_item_description', mi.description
             )
           ) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.id = ?
    GROUP BY o.id
  `, [orderId]);
  
  completeOrder.items = completeOrder.items ? JSON.parse(`[${completeOrder.items}]`) : [];
  
  res.status(201).json({
    success: true,
    data: completeOrder,
    message: 'Order created successfully'
  });
}));

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', validate(schemas.orderUpdate), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // Check if order exists
  const existingOrder = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!existingOrder) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  await db.run(
    'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
  
  const updatedOrder = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  
  res.json({
    success: true,
    data: updatedOrder,
    message: 'Order status updated successfully'
  });
}));

// GET /api/orders/stats/summary - Get order statistics
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  
  let dateFilter = '';
  const params = [];
  
  if (start_date && end_date) {
    dateFilter = 'WHERE created_at BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }
  
  const stats = await db.get(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as average_order_value,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
      COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_orders,
      COUNT(CASE WHEN status = 'served' THEN 1 END) as served_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
    FROM orders 
    ${dateFilter}
  `, params);
  
  res.json({
    success: true,
    data: stats
  });
}));

module.exports = router;
