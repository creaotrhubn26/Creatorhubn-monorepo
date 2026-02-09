#!/usr/bin/env node

// Standalone Pricing API server for testing
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================
// Database Setup
// ============================================

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create pricing_categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_categories (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        profession VARCHAR(100),
        category_name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create pricing_services table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_services (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        profession VARCHAR(100),
        category_id INTEGER REFERENCES pricing_categories(id) ON DELETE SET NULL,
        service_name VARCHAR(255) NOT NULL,
        description TEXT,
        base_price DECIMAL(10, 2),
        price_type VARCHAR(50) DEFAULT 'fixed',
        unit VARCHAR(50),
        minimum_quantity INTEGER DEFAULT 1,
        maximum_quantity INTEGER,
        is_visible BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create pricing_packages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_packages (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        profession VARCHAR(100),
        package_name VARCHAR(255) NOT NULL,
        description TEXT,
        base_price DECIMAL(10, 2),
        discount_percentage DECIMAL(5, 2) DEFAULT 0,
        included_services JSONB DEFAULT '[]'::jsonb,
        is_visible BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customer_pricing table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_pricing (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        profession VARCHAR(100),
        client_id VARCHAR(255),
        pricing_type VARCHAR(50) NOT NULL,
        item_id VARCHAR(255),
        item_name VARCHAR(255),
        discount_percentage DECIMAL(5, 2),
        fixed_price DECIMAL(10, 2),
        valid_from TIMESTAMP,
        valid_until TIMESTAMP,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created/verified');
  } catch (error) {
    console.error('Database setup error:', error);
  } finally {
    client.release();
  }
}

// ============================================
// Pricing Categories
// ============================================

app.get('/api/pricing/categories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM pricing_categories WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/pricing/categories', async (req, res) => {
  try {
    const { userId, categoryName, description, isActive, color } = req.body;
    const result = await pool.query(
      `INSERT INTO pricing_categories (user_id, name, description, is_active, color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, categoryName, description, isActive !== undefined ? isActive : true, color || '#3B82F6']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.put('/api/pricing/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, description, isActive, color } = req.body;
    const result = await pool.query(
      `UPDATE pricing_categories 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           color = COALESCE($4, color)
       WHERE id = $5 RETURNING *`,
      [categoryName, description, isActive, color, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/pricing/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM pricing_categories WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============================================
// Pricing Services
// ============================================

app.get('/api/pricing/services/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM pricing_services WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

app.post('/api/pricing/services', async (req, res) => {
  try {
    const { userId, profession, categoryId, serviceName, description, basePrice, priceType, unit, minimumQuantity, maximumQuantity, isVisible, isActive } = req.body;
    const result = await pool.query(
      `INSERT INTO pricing_services (user_id, profession, category_id, service_name, description, base_price, price_type, unit, minimum_quantity, maximum_quantity, is_visible, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [userId, profession, categoryId, serviceName, description, basePrice, priceType, unit, minimumQuantity, maximumQuantity, isVisible !== undefined ? isVisible : true, isActive !== undefined ? isActive : true]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

app.put('/api/pricing/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(fields).forEach(key => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates.push(`${snakeKey} = $${paramCount}`);
      values.push(fields[key]);
      paramCount++;
    });

    values.push(id);
    const result = await pool.query(
      `UPDATE pricing_services SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

app.delete('/api/pricing/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM pricing_services WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ============================================
// Pricing Packages
// ============================================

app.get('/api/pricing/packages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM pricing_packages WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

app.post('/api/pricing/packages', async (req, res) => {
  try {
    const { userId, profession, packageName, description, basePrice, discountPercentage, includedServices, isVisible, isActive } = req.body;
    const result = await pool.query(
      `INSERT INTO pricing_packages (user_id, profession, package_name, description, base_price, discount_percentage, included_services, is_visible, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, profession, packageName, description, basePrice, discountPercentage || 0, JSON.stringify(includedServices || []), isVisible !== undefined ? isVisible : true, isActive !== undefined ? isActive : true]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

app.put('/api/pricing/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { packageName, description, basePrice, discountPercentage, includedServices, isVisible, isActive } = req.body;
    const result = await pool.query(
      `UPDATE pricing_packages 
       SET package_name = COALESCE($1, package_name),
           description = COALESCE($2, description),
           base_price = COALESCE($3, base_price),
           discount_percentage = COALESCE($4, discount_percentage),
           included_services = COALESCE($5, included_services),
           is_visible = COALESCE($6, is_visible),
           is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [packageName, description, basePrice, discountPercentage, includedServices ? JSON.stringify(includedServices) : null, isVisible, isActive, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

app.delete('/api/pricing/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM pricing_packages WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// ============================================
// Customer Pricing
// ============================================

app.get('/api/pricing/customer-pricing/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM customer_pricing WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customer pricing:', error);
    res.status(500).json({ error: 'Failed to fetch customer pricing' });
  }
});

app.post('/api/pricing/customer-pricing', async (req, res) => {
  try {
    const { userId, profession, clientId, pricingType, itemId, itemName, discountPercentage, fixedPrice, validFrom, validUntil, notes, isActive } = req.body;
    const result = await pool.query(
      `INSERT INTO customer_pricing (user_id, profession, client_id, pricing_type, item_id, item_name, discount_percentage, fixed_price, valid_from, valid_until, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [userId, profession, clientId, pricingType, itemId, itemName, discountPercentage, fixedPrice, validFrom, validUntil, notes, isActive !== undefined ? isActive : true]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating customer pricing:', error);
    res.status(500).json({ error: 'Failed to create customer pricing' });
  }
});

app.put('/api/pricing/customer-pricing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, pricingType, itemId, itemName, discountPercentage, fixedPrice, validFrom, validUntil, notes, isActive } = req.body;
    const result = await pool.query(
      `UPDATE customer_pricing 
       SET client_id = COALESCE($1, client_id),
           pricing_type = COALESCE($2, pricing_type),
           item_id = COALESCE($3, item_id),
           item_name = COALESCE($4, item_name),
           discount_percentage = COALESCE($5, discount_percentage),
           fixed_price = COALESCE($6, fixed_price),
           valid_from = COALESCE($7, valid_from),
           valid_until = COALESCE($8, valid_until),
           notes = COALESCE($9, notes),
           is_active = COALESCE($10, is_active)
       WHERE id = $11 RETURNING *`,
      [clientId, pricingType, itemId, itemName, discountPercentage, fixedPrice, validFrom, validUntil, notes, isActive, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer pricing not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating customer pricing:', error);
    res.status(500).json({ error: 'Failed to update customer pricing' });
  }
});

app.delete('/api/pricing/customer-pricing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM customer_pricing WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer pricing not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer pricing:', error);
    res.status(500).json({ error: 'Failed to delete customer pricing' });
  }
});

// ============================================
// Clients API (for customer pricing dropdown)
// ============================================

app.get('/api/clients', (req, res) => {
  const { userId } = req.query;
  // Mock client data until we have real database
  const mockClients = [
    { id: '1', name: 'Acme Corporation', userId },
    { id: '2', name: 'Nordic Media AS', userId },
    { id: '3', name: 'Sunset Productions', userId },
  ];
  res.json(userId ? mockClients : []);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all
app.all('/api/*', (req, res) => {
  res.json({ message: 'Endpoint not implemented', path: req.path });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Pricing API server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
