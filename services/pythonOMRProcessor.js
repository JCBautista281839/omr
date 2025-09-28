const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class PythonOMRProcessor {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../python/omr_processor.py');
    this.pythonExecutable = process.env.PYTHON_PATH || 'python'; // Use 'python' for consistency
  }

  async checkPythonEnvironment() {
    try {
      // Check if Python is available
      await this.runPythonCommand(['--version']);
      return true;
    } catch (error) {
      console.error('Python not found. Please install Python 3.7+ and ensure it\'s in your PATH');
      return false;
    }
  }

  async installPythonDependencies() {
    const requirementsPath = path.join(__dirname, '../python/requirements.txt');
    
    try {
      console.log('Installing Python dependencies...');
      await this.runCommand(this.pythonExecutable, ['-m', 'pip', 'install', '-r', requirementsPath]);
      console.log('Python dependencies installed successfully');
      return true;
    } catch (error) {
      console.error('Failed to install Python dependencies:', error.message);
      return false;
    }
  }

  async runPythonCommand(args) {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonExecutable, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
      });

      python.on('error', (error) => {
        reject(error);
      });
    });
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async processImage(imagePath) {
    try {
      console.log('🐍 Starting Python OMR processing for:', imagePath);
      
      // Check if image file exists
      await fs.access(imagePath);
      console.log('✅ Image file exists');
      
      // Run Python OMR processor
      console.log('🚀 Running Python script...');
      const result = await this.runPythonCommand([this.pythonScriptPath, imagePath]);
      console.log('📄 Python script output:', result);
      
      // Parse JSON result
      const parsedResult = JSON.parse(result);
      console.log('📊 Parsed result:', parsedResult);
      
      return {
        success: true,
        data: parsedResult
      };
      
    } catch (error) {
      console.error('❌ Python OMR processing failed:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  async extractOrderFromOMR(imagePath) {
    try {
      const result = await this.processImage(imagePath);
      
      if (!result.success || !result.data.success) {
        throw new Error(result.error || 'OMR processing failed');
      }

      const marks = result.data.marks;
      const orderItems = [];

      // Group marks by item
      const itemGroups = {};
      marks.forEach(mark => {
        if (!itemGroups[mark.item]) {
          itemGroups[mark.item] = {};
        }
        itemGroups[mark.item][mark.type] = mark;
      });

      // Process each item
      for (const [itemName, itemMarks] of Object.entries(itemGroups)) {
        const quantityMark = itemMarks.quantity;
        const selectionMark = itemMarks.selection;

        // Only include items that are selected
        if (selectionMark && selectionMark.isMarked) {
          const quantity = quantityMark && quantityMark.isMarked ? 1 : 1;
          
          orderItems.push({
            item_name: itemName,
            quantity: quantity,
            confidence: Math.min(
              selectionMark.confidence,
              quantityMark ? quantityMark.confidence : 1.0
            )
          });
        }
      }

      return {
        success: true,
        orderItems: orderItems,
        omrData: result.data
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        orderItems: [],
        omrData: null
      };
    }
  }

  async initialize() {
    console.log('🐍 Initializing Python OMR Processor...');
    
    // Check Python environment
    const pythonAvailable = await this.checkPythonEnvironment();
    if (!pythonAvailable) {
      throw new Error('Python environment not available');
    }

    // Install dependencies
    const depsInstalled = await this.installPythonDependencies();
    if (!depsInstalled) {
      throw new Error('Failed to install Python dependencies');
    }

    console.log('✅ Python OMR Processor initialized successfully');
    return true;
  }
}

module.exports = new PythonOMRProcessor();
