const request = require('supertest');
const app = require('../server');

describe('OMR POS Backend API', () => {
  describe('Health Check', () => {
    test('GET /health should return server status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.environment).toBeDefined();
    });

    test('GET / should return API information', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('OMR POS Backend API');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('Menu API', () => {
    test('GET /api/menu should return menu items', async () => {
      const response = await request(app).get('/api/menu');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/menu/categories/list should return categories', async () => {
      const response = await request(app).get('/api/menu/categories/list');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/menu should create new menu item', async () => {
      const newItem = {
        name: 'Test Item',
        description: 'Test description',
        price: 99.99,
        category: 'test'
      };

      const response = await request(app)
        .post('/api/menu')
        .send(newItem);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newItem.name);
    });
  });

  describe('Orders API', () => {
    test('GET /api/orders should return orders', async () => {
      const response = await request(app).get('/api/orders');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/orders should create new order', async () => {
      const newOrder = {
        customer_name: 'Test Customer',
        table_number: 1,
        items: [
          {
            menu_item_id: 1,
            quantity: 2
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .send(newOrder);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.order_number).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('GET /api/menu/invalid should return 404', async () => {
      const response = await request(app).get('/api/menu/99999');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('POST /api/menu with invalid data should return 400', async () => {
      const invalidItem = {
        name: '', // Invalid empty name
        price: -10 // Invalid negative price
      };

      const response = await request(app)
        .post('/api/menu')
        .send(invalidItem);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });
});
