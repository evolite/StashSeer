# Whisparr Missing Movies Search Script
# Searches for missing movies in Whisparr

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Get configuration from environment variables with fallbacks
$whisparrBaseUrl = if ($env:WHISPARR_BASE_URL) { $env:WHISPARR_BASE_URL } else { "http://localhost:6969" }
$whisparrApiKey = if ($env:WHISPARR_API_KEY) { $env:WHISPARR_API_KEY } else { "" }

# Check if API key is configured
if (-not $whisparrApiKey) {
    Write-Host "Error: Whisparr API key not configured. Please set WHISPARR_API_KEY in .env file or environment variable." -ForegroundColor Red
    exit 1
}

# Headers for Whisparr API
$Headers = @{
    'X-Api-Key' = $whisparrApiKey
    'Content-Type' = 'application/json'
}

# Body for missing movies search command
$Body = '{"name":"MoviesSearch"}'

Write-Host "Searching for missing movies in Whisparr..." -ForegroundColor Green
Write-Host "Whisparr URL: $whisparrBaseUrl" -ForegroundColor Yellow

try {
    # Send the missing movies search command
    $response = Invoke-RestMethod -Uri "$whisparrBaseUrl/api/v3/command" -Method Post -Headers $Headers -Body $Body -ErrorAction Stop
    
    Write-Host "Missing movies search command sent successfully!" -ForegroundColor Green
    Write-Host "Command ID: $($response.id)" -ForegroundColor Cyan
    
    # Optional: Check command status
    Write-Host "`nChecking command status..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    $statusResponse = Invoke-RestMethod -Uri "$whisparrBaseUrl/api/v3/command/$($response.id)" -Method Get -Headers $Headers -ErrorAction Stop
    
    Write-Host "Command Status: $($statusResponse.status)" -ForegroundColor Cyan
    Write-Host "Command Name: $($statusResponse.name)" -ForegroundColor Cyan
    
    if ($statusResponse.message) {
        Write-Host "Message: $($statusResponse.message)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "HTTP Status Code: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 401) {
            Write-Host "Authentication failed. Please check your API key." -ForegroundColor Red
        } elseif ($statusCode -eq 404) {
            Write-Host "Whisparr not found at the specified URL. Please check the base URL." -ForegroundColor Red
        }
    }
    
    exit 1
}

Write-Host "`nScript completed successfully!" -ForegroundColor Green
