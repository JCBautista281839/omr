const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const { validate, schemas, asyncHandler } = require('../middleware/validation');
const pythonOMRProcessor = require('../services/pythonOMRProcessor');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `omr-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize Python OMR Processor
let pythonProcessorReady = false;

// Initialize Python processor on startup
pythonOMRProcessor.initialize()
  .then(() => {
    pythonProcessorReady = true;
    console.log('✅ Python OMR Processor ready');
  })
  .catch(error => {
    console.error('❌ Python OMR Processor initialization failed:', error.message);
    console.log('⚠️  Falling back to basic image processing');
  });

// POST /api/omr/process - Process uploaded image
router.post('/process', upload.single('image'), asyncHandler(async (req, res) => {
  console.log('📁 File upload received:', req.file ? 'Yes' : 'No');
  console.log('📋 Form data:', req.body);
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image file provided'
    });
  }

  const { form_type } = req.body;
  const imagePath = req.file.path;

  try {
    let result;
    
    // Use Python OpenCV processor if available, otherwise fallback
    if (pythonProcessorReady) {
      console.log('🐍 Using Python OpenCV for OMR processing');
      console.log('📁 Image path:', imagePath);
      
      const pythonResult = await pythonOMRProcessor.processImage(imagePath);
      console.log('🐍 Python result:', pythonResult);
      
      if (pythonResult.success) {
        result = pythonResult.data;
        console.log('✅ Python processing successful');
      } else {
        console.error('❌ Python processing failed:', pythonResult.error);
        throw new Error(`Python processing failed: ${pythonResult.error}`);
      }
    } else {
      throw new Error('Python OMR processor not available');
    }
    
    // Skip database storage for now - just process the form
    // const dbResult = await db.run(
    //   'INSERT INTO omr_forms (form_type, image_path, processed_data, confidence_score) VALUES (?, ?, ?, ?)',
    //   [form_type, imagePath, JSON.stringify(result), result.confidence]
    // );

    res.json({
      success: true,
      data: {
        id: Date.now(), // Temporary ID
        form_type,
        marks: result.marks,
        confidence: result.confidence,
        image_path: imagePath,
        processor: 'python-opencv',
        image_dimensions: result.image_dimensions,
        total_marks_detected: result.total_marks_detected,
        marked_items: result.marked_items
      },
      message: 'OMR processing completed successfully using Python OpenCV'
    });

  } catch (error) {
    // Clean up uploaded file on error
    try {
      await fs.unlink(imagePath);
    } catch (unlinkError) {
      console.error('Failed to delete uploaded file:', unlinkError);
    }

    res.status(500).json({
      success: false,
      error: 'OMR processing failed',
      message: error.message
    });
  }
}));

// POST /api/omr/process-to-order - Process image and create order
router.post('/process-to-order', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image file provided'
    });
  }

  const { customer_name, table_number, notes } = req.body;
  const imagePath = req.file.path;

  try {
    let omrResult;
    
    // Use Python OpenCV processor if available
    if (pythonProcessorReady) {
      console.log('🐍 Using Python OpenCV for order processing');
      const pythonResult = await pythonOMRProcessor.extractOrderFromOMR(imagePath);
      
      if (pythonResult.success) {
        omrResult = pythonResult;
      } else {
        throw new Error(`Python processing failed: ${pythonResult.error}`);
      }
    } else {
      throw new Error('Python OMR processor not available');
    }
    
    if (omrResult.orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid selections found in the form'
      });
    }

    // Create order
    const orderNumber = `OMR-${Date.now()}-${Math.round(Math.random() * 1E4)}`;
    
    const orderResult = await db.run(
      'INSERT INTO orders (order_number, customer_name, table_number, notes) VALUES (?, ?, ?, ?)',
      [orderNumber, customer_name, table_number, notes || 'Order from OMR form']
    );

    const orderId = orderResult.id;
    let totalAmount = 0;

    // Process each item
    for (const item of omrResult.orderItems) {
      // Get menu item from database by name
      const menuItem = await db.get('SELECT * FROM menu_items WHERE name = ?', [item.item_name]);
      
      if (!menuItem) {
        console.warn(`Menu item not found: ${item.item_name}`);
        continue;
      }
      
      const unitPrice = menuItem.price;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      await db.run(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, special_instructions) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, menuItem.id, item.quantity, unitPrice, totalPrice, null]
      );
    }

    // Update order total
    await db.run('UPDATE orders SET total_amount = ? WHERE id = ?', [totalAmount, orderId]);

    // Store OMR processing result
    await db.run(
      'INSERT INTO omr_forms (form_type, image_path, processed_data, confidence_score) VALUES (?, ?, ?, ?)',
      ['menu_order', imagePath, JSON.stringify(omrResult.omrData), omrResult.omrData.confidence]
    );

    // Get complete order
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
                 'menu_item_name', mi.name
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
      data: {
        order: completeOrder,
        omr_result: {
          marks: omrResult.omrData.marks,
          confidence: omrResult.omrData.confidence,
          processor: 'python-opencv',
          image_dimensions: omrResult.omrData.image_dimensions,
          marked_items: omrResult.omrData.marked_items
        }
      },
      message: 'Order created from OMR form successfully using Python OpenCV'
    });

  } catch (error) {
    // Clean up uploaded file on error
    try {
      await fs.unlink(imagePath);
    } catch (unlinkError) {
      console.error('Failed to delete uploaded file:', unlinkError);
    }

    res.status(500).json({
      success: false,
      error: 'Order processing failed',
      message: error.message
    });
  }
}));

// GET /api/omr/history - Get OMR processing history (temporarily disabled)
router.get('/history', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [],
    count: 0,
    message: 'History temporarily disabled for testing'
  });
}));

module.exports = router;
