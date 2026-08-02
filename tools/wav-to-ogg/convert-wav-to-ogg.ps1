[CmdletBinding()]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [string[]]$Paths,

  [Parameter()]
  [ValidateRange(0, 10)]
  [int]$Quality = 6
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[wav-to-ogg] $Message"
}

function Get-DownloadsPath {
  try {
    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.NameSpace("shell:Downloads")
    if ($folder -and $folder.Self -and $folder.Self.Path) {
      return $folder.Self.Path
    }
  } catch {
    # Fall back below.
  }

  return Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads"
}

function Find-Ffmpeg {
  $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $knownPaths = @(
    (Join-Path $env:ProgramFiles "ffmpeg\bin\ffmpeg.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "ffmpeg\bin\ffmpeg.exe"),
    "C:\ffmpeg\bin\ffmpeg.exe"
  )

  foreach ($path in $knownPaths) {
    if ($path -and (Test-Path -LiteralPath $path)) {
      return $path
    }
  }

  $wingetPackages = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  if (Test-Path -LiteralPath $wingetPackages) {
    $match = Get-ChildItem -LiteralPath $wingetPackages -Filter "ffmpeg.exe" -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($match) {
      return $match.FullName
    }
  }

  return $null
}

function Ensure-Ffmpeg {
  $ffmpeg = Find-Ffmpeg
  if ($ffmpeg) {
    return $ffmpeg
  }

  Write-Host ""
  Write-Host "ffmpeg n'est pas installe ou n'est pas dans le PATH."
  Write-Host "Il sert a convertir proprement les WAV en OGG Vorbis."
  $answer = Read-Host "Installer ffmpeg maintenant avec winget ? (O/N)"

  if ($answer -notmatch "^(o|oui|y|yes)$") {
    throw "ffmpeg est requis. Installe-le puis relance cet outil."
  }

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "winget est introuvable. Installe ffmpeg manuellement, puis relance cet outil."
  }

  Write-Step "Installation de ffmpeg via winget..."
  & $winget.Source install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "L'installation de ffmpeg a echoue."
  }

  $ffmpeg = Find-Ffmpeg
  if (-not $ffmpeg) {
    throw "ffmpeg semble installe, mais reste introuvable. Ferme cette fenetre puis relance l'outil."
  }

  return $ffmpeg
}

function Select-WavFiles {
  $inputPaths = @()
  if ($null -ne $Paths) {
    $inputPaths = @($Paths | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  }

  if ($inputPaths.Length -gt 0) {
    $files = New-Object System.Collections.Generic.List[System.IO.FileInfo]

    foreach ($path in $inputPaths) {
      if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "[ignore] Introuvable: $path"
        continue
      }

      $item = Get-Item -LiteralPath $path
      if ($item.PSIsContainer) {
        Get-ChildItem -LiteralPath $item.FullName -Filter "*.wav" -File |
          ForEach-Object { $files.Add($_) }
      } elseif ($item.Extension -ieq ".wav") {
        $files.Add($item)
      } else {
        Write-Host "[ignore] Pas un WAV: $($item.FullName)"
      }
    }

    return @($files)
  }

  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Choisis les fichiers WAV a convertir"
  $dialog.Filter = "Fichiers WAV (*.wav)|*.wav"
  $dialog.Multiselect = $true

  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    return @()
  }

  return @($dialog.FileNames | ForEach-Object { Get-Item -LiteralPath $_ })
}

function Get-UniqueOutputPath {
  param(
    [string]$Directory,
    [string]$BaseName
  )

  $candidate = Join-Path $Directory "$BaseName.ogg"
  $index = 1
  while (Test-Path -LiteralPath $candidate) {
    $candidate = Join-Path $Directory ("{0} ({1}).ogg" -f $BaseName, $index)
    $index++
  }

  return $candidate
}

try {
  $downloads = Get-DownloadsPath
  New-Item -ItemType Directory -Force -Path $downloads | Out-Null

  $wavFiles = @(Select-WavFiles)
  if ($wavFiles.Count -eq 0) {
    Write-Step "Aucun fichier WAV selectionne."
    exit 0
  }

  $ffmpeg = Ensure-Ffmpeg
  Write-Step "Sortie: $downloads"
  Write-Step "Qualite OGG Vorbis: $Quality / 10"
  Write-Host ""

  $successCount = 0
  $failedFiles = New-Object System.Collections.Generic.List[string]

  foreach ($file in $wavFiles) {
    $outputPath = Get-UniqueOutputPath -Directory $downloads -BaseName $file.BaseName
    Write-Step "Conversion: $($file.Name) -> $(Split-Path -Leaf $outputPath)"

    & $ffmpeg -hide_banner -loglevel error -y -i $file.FullName -vn -c:a libvorbis -q:a $Quality $outputPath
    if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $outputPath)) {
      $successCount++
    } else {
      $failedFiles.Add($file.FullName)
      if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
      }
    }
  }

  Write-Host ""
  Write-Step "$successCount fichier(s) converti(s) dans Downloads."

  if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Conversions echouees:"
    $failedFiles | ForEach-Object { Write-Host "- $_" }
    exit 1
  }

  Start-Process explorer.exe $downloads
  exit 0
} catch {
  Write-Host ""
  Write-Host "[ERREUR] $($_.Exception.Message)"
  exit 1
}
