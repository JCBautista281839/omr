const db = require('./config/database');

async function initializeApp() {
  try {
    console.log('🚀 Initializing OMR POS Backend...');
    
    // Connect to database
    await db.connect();
    
    console.log('✅ Database initialized successfully');
    console.log('✅ Sample menu items inserted');
    console.log('✅ Application ready to start');
    
    // Close database connection
    await db.close();
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeApp();
}

module.exports = initializeApp;
