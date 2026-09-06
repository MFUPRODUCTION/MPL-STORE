$ErrorActionPreference = 'Stop'
# Packaging is deliberately explicit; never include credentials or previous archives.
$root = $PSScriptRoot
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'Invalid source directory' }
$files = @('index.html','style.css','app.js','supabase-config.js','supabase-service.js','supabase-schema.sql','tests.cjs','supabase-tests.cjs','README.md','package.ps1')
$dest = Join-Path $root 'SantriPulang'
if (-not (Test-Path -LiteralPath $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
foreach ($file in $files) { Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $dest $file) -Force }
# Remove the obsolete binary delivery, which contained the retired integration.
$old = Join-Path $root 'SantriPulang.7z'
if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Force }
Compress-Archive -LiteralPath ($files | ForEach-Object { Join-Path $dest $_ }) -DestinationPath (Join-Path $root 'SantriPulang.zip') -Force
# Verify exact archive manifest (no old adapter or nested archives).
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $root 'SantriPulang.zip'))
try {
  $names = @($zip.Entries | ForEach-Object { $_.FullName })
  if (Compare-Object ($files | Sort-Object) ($names | Sort-Object)) { throw 'Archive manifest mismatch' }
  "Verified ZIP: $($names.Count) files"
} finally { $zip.Dispose() }
