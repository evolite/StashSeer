# MetadataIdentify Request Body
$bodyIdentify = @{
  operationName = 'MetadataIdentify'
  variables = @{
    input = @{
      sources = @(
        @{
          source = @{
            stash_box_endpoint = 'https://stashdb.org/graphql'
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
Invoke-RestMethod -Uri 'http://localhost:9999/graphql' -Method Post `
  -Body $jsonBodyIdentify -ContentType 'application/json' `
  -Headers @{ 'ApiKey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJldm90ZWNoIiwic3ViIjoiQVBJS2V5IiwiaWF0IjoxNzI1OTc1MzAzfQ.S-SaRNjjHxqHTNBF_deQF9FMyNemWDc-ssTQMLlDu4M' } `
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
Invoke-RestMethod -Uri 'http://localhost:9999/graphql' -Method Post `
  -Body $jsonBodyClean -ContentType 'application/json' `
  -Headers @{ 'ApiKey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJldm90ZWNoIiwic3ViIjoiQVBJS2V5IiwiaWF0IjoxNzI1OTc1MzAzfQ.S-SaRNjjHxqHTNBF_deQF9FMyNemWDc-ssTQMLlDu4M' } `
  -ErrorAction SilentlyContinue