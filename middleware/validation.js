const Joi = require('joi');

// Validation schemas
const schemas = {
  menuItem: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    price: Joi.number().positive().precision(2).required(),
    category: Joi.string().max(50).optional(),
    is_available: Joi.boolean().optional()
  }),

  order: Joi.object({
    customer_name: Joi.string().max(100).optional(),
    table_number: Joi.number().integer().positive().optional(),
    notes: Joi.string().max(500).optional(),
    items: Joi.array().items(
      Joi.object({
        menu_item_id: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required(),
        special_instructions: Joi.string().max(200).optional()
      })
    ).min(1).required()
  }),

  orderUpdate: Joi.object({
    status: Joi.string().valid('pending', 'preparing', 'ready', 'served', 'cancelled').required()
  }),

  omrProcess: Joi.object({
    form_type: Joi.string().valid('menu_order', 'feedback', 'survey').required(),
    image_data: Joi.string().optional(),
    image_url: Joi.string().uri().optional()
  }).xor('image_data', 'image_url')
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation Error',
        details: errorDetails
      });
    }

    req.body = value;
    next();
  };
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this information already exists'
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({
      error: 'Invalid Reference',
      message: 'Referenced record does not exist'
    });
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File Too Large',
      message: 'File size exceeds the maximum allowed limit'
    });
  }

  // Default error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  schemas,
  validate,
  errorHandler,
  asyncHandler
};
