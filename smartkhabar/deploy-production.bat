@echo off
REM SmartKhabar Production Deployment Script for Vercel
REM This script handles the complete deployment process to Vercel

echo ========================================
echo SmartKhabar Production Deployment
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available
    pause
    exit /b 1
)

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo Installing Vercel CLI...
    npm install -g vercel
    if errorlevel 1 (
        echo ERROR: Failed to install Vercel CLI
        pause
        exit /b 1
    )
)

echo Step 1: Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Running pre-deployment validation...
node scripts/validate-deployment.js pre
if errorlevel 1 (
    echo ERROR: Pre-deployment validation failed
    pause
    exit /b 1
)

echo Step 2b: Running deployment preparation...
node scripts/deploy.js
if errorlevel 1 (
    echo ERROR: Deployment preparation failed
    pause
    exit /b 1
)

echo.
echo Step 3: Setting up Vercel environment variables...
echo Please make sure you have set the following environment variables in Vercel:
echo - DATABASE_URL
echo - GNEWS_API_KEY  
echo - HUGGINGFACE_API_KEY
echo - NEXT_PUBLIC_APP_URL
echo.
echo You can set them using:
echo vercel env add [VARIABLE_NAME] production
echo.
set /p continue="Continue with deployment? (y/n): "
if /i not "%continue%"=="y" (
    echo Deployment cancelled
    pause
    exit /b 0
)

echo.
echo Step 4: Deploying to Vercel (Production)...
vercel --prod
if errorlevel 1 (
    echo ERROR: Deployment failed
    pause
    exit /b 1
)

echo.
echo Step 5: Running post-deployment validation...
timeout /t 15 /nobreak >nul
echo Waiting for deployment to be ready...

REM Get the deployment URL (this would need to be updated with your actual URL)
set DEPLOYMENT_URL=https://your-app-name.vercel.app

echo Running comprehensive deployment validation...
node scripts/validate-deployment.js post %DEPLOYMENT_URL%
if errorlevel 1 (
    echo WARNING: Some validation tests failed - please check the deployment manually
    echo You can run manual tests at: %DEPLOYMENT_URL%
) else (
    echo SUCCESS: All validation tests passed!
)

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Your app should be available at: %DEPLOYMENT_URL%
echo.
echo Next steps:
echo 1. Update NEXT_PUBLIC_APP_URL in Vercel environment variables with your actual URL
echo 2. Test all functionality on the live site
echo 3. Monitor logs using: vercel logs
echo.
pause