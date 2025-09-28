@echo off
REM OMR POS Backend Setup Script for Windows
echo 🚀 Setting up OMR POS Backend with Python OpenCV integration...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.7+ first.
    pause
    exit /b 1
)

echo ✅ Python found
python --version

REM Check if pip is installed
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pip is not installed. Please install pip first.
    pause
    exit /b 1
)

echo ✅ pip found
pip --version

REM Install Node.js dependencies
echo 📦 Installing Node.js dependencies...
npm install

REM Install Python dependencies
echo 🐍 Installing Python dependencies...
pip install -r python/requirements.txt

REM Initialize database
echo 🗄️ Initializing database...
node init.js

echo.
echo 🎉 Setup completed successfully!
echo.
echo To start the development server:
echo   npm run dev
echo.
echo To start the production server:
echo   npm start
echo.
echo The API will be available at: http://localhost:3000
echo Health check: http://localhost:3000/health
pause
