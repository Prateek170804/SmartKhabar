# Generate JWT Secret Script
# This script generates a cryptographically secure JWT secret

Write-Host "Generating JWT Secret..." -ForegroundColor Green

try {
    # Method 1: Using .NET Cryptography (Most Secure)
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    $base64Secret = [System.Convert]::ToBase64String($bytes)
    
    Write-Host "`nGenerated JWT Secret (Base64):" -ForegroundColor Yellow
    Write-Host $base64Secret -ForegroundColor White
    
    # Also generate a hex version
    $hexSecret = [System.BitConverter]::ToString($bytes) -replace '-', ''
    Write-Host "`nGenerated JWT Secret (Hex):" -ForegroundColor Yellow
    Write-Host $hexSecret.ToLower() -ForegroundColor White
    
    # Generate a human-readable version
    $readableSecret = "smartkhabar-jwt-" + [System.Guid]::NewGuid().ToString() + "-" + (Get-Date -Format "yyyyMMdd")
    Write-Host "`nGenerated JWT Secret (Readable):" -ForegroundColor Yellow
    Write-Host $readableSecret -ForegroundColor White
    
    Write-Host "`nRecommendation: Use the Base64 version for maximum security" -ForegroundColor Cyan
    Write-Host "Copy one of the above secrets to your .env.production file" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error generating secret: $_" -ForegroundColor Red
    
    # Fallback method
    Write-Host "Using fallback method..." -ForegroundColor Yellow
    $fallbackSecret = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)})
    Write-Host "Fallback JWT Secret:" -ForegroundColor Yellow
    Write-Host $fallbackSecret.ToLower() -ForegroundColor White
}

Write-Host "`nDone!" -ForegroundColor Green