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
$stashRootUrl = if ($env:STASH_ROOT_URL) { $env:STASH_ROOT_URL } else { "http://localhost:9999" }
$stashApiKey = if ($env:STASH_API_KEY) { $env:STASH_API_KEY } else { "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJldm90ZWNoIiwic3ViIjoiQVBJS2V5IiwiaWF0IjoxNzI1OTc1MzAzfQ.S-SaRNjjHxqHTNBF_deQF9FMyNemWDc-ssTQMLlDu4M" }
$stashdbEndpoint = if ($env:STASHDB_ENDPOINT) { $env:STASHDB_ENDPOINT } else { "https://stashdb.org/graphql" }

# MetadataIdentify Request Body
$bodyIdentify = @{
  operationName = 'MetadataIdentify'
  variables = @{
    input = @{
      sources = @(
        @{
          source = @{
            stash_box_endpoint = $stashdbEndpoint
          }
        }
      )
      options = @{
        fieldOptions = @(
          @{ field = 'title'; strategy = 'OVERWRITE'; createMissing = $null },
          @{ field = 'tags'; strategy = 'OVERWRITE'; createMissing = $true },
          @{ field = 'date'; strategy = 'MERGE'; createMissing = $false },
          @{ field = 'details'; strategy = 'MERGE'; createMissing = $false },
          @{ field = 'performers'; strategy = 'OVERWRITE'; createMissing = $true },
          @{ field = 'studio'; strategy = 'OVERWRITE'; createMissing = $true }
        )
        setCoverImage = $true
        setOrganized = $true
        includeMalePerformers = $false
        skipMultipleMatches = $null
        skipMultipleMatchTag = $null
        skipSingleNamePerformers = $null
        skipSingleNamePerformerTag = $null
      }
      paths = @()
    }
  }
  query = 'mutation MetadataIdentify($input: IdentifyMetadataInput!) {  metadataIdentify(input: $input)}'
}

$jsonBodyIdentify = $bodyIdentify | ConvertTo-Json -Depth 5

# MetadataIdentify Request
Invoke-RestMethod -Uri "$stashRootUrl/graphql" -Method Post `
  -Body $jsonBodyIdentify -ContentType 'application/json' `
  -Headers @{ 'ApiKey' = $stashApiKey } `
  -ErrorAction SilentlyContinue

# MetadataClean Request Body
$bodyClean = @{
  operationName = 'MetadataClean'
  variables = @{
    input = @{
      dryRun = $false
    }
  }
  query = 'mutation MetadataClean($input: CleanMetadataInput!) {  metadataClean(input: $input)}'
}

$jsonBodyClean = $bodyClean | ConvertTo-Json

# MetadataClean Request
Invoke-RestMethod -Uri "$stashRootUrl/graphql" -Method Post `
  -Body $jsonBodyClean -ContentType 'application/json' `
  -Headers @{ 'ApiKey' = $stashApiKey } `
  -ErrorAction SilentlyContinue