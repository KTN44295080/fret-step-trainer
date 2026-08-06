param(
  [string]$Ffmpeg = "ffmpeg",
  [switch]$HighResolution
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$videoCache = Join-Path $workspace "audit\video-cache"
$auditRoot = Join-Path $workspace $(if ($HighResolution) { "audit\measure-frames-highres" } else { "audit\measure-frames" })

$sources = @(
  [pscustomobject]@{ Song = "life-over"; Track = "lead"; Video = "6LfUfHSIiMw.mp4"; Offset = 215.0; Bpm = 170; Measures = 151 },
  [pscustomobject]@{ Song = "life-over"; Track = "backing"; Video = "6LfUfHSIiMw.mp4"; Offset = 215.0; Bpm = 170; Measures = 151 },
  [pscustomobject]@{ Song = "madow"; Track = "lead"; Video = "85ORTRtwmF4.mp4"; Offset = 1.2; Bpm = 194; Measures = 207 },
  [pscustomobject]@{ Song = "madow"; Track = "backing"; Video = "vPexB7CEMGY.mp4"; Offset = 1.0; Bpm = 194; Measures = 207 }
)

New-Item -ItemType Directory -Force -Path $auditRoot | Out-Null

foreach ($source in $sources) {
  $inputPath = Join-Path $videoCache $source.Video
  if (-not (Test-Path -LiteralPath $inputPath)) {
    throw "Missing audit source: $inputPath"
  }

  $outputDirectory = Join-Path $auditRoot "$($source.Song)-$($source.Track)"
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  $outputPattern = Join-Path $outputDirectory "measure-%03d.jpg"
  $measureSeconds = 240.0 / $source.Bpm
  # The normal set is retained for quick OCR experiments.  The high-resolution
  # audit set is sampled in the middle of each measure and keeps the video's
  # native 1920x1080 pixels so a fret number cannot drift onto another string.
  $seekOffset = if ($HighResolution) { $source.Offset + ($measureSeconds / 2.0) } else { $source.Offset }
  $filter = if ($HighResolution) { "fps=1/$measureSeconds" } else { "fps=1/$measureSeconds,scale=1280:-2" }
  $quality = if ($HighResolution) { 1 } else { 3 }

  & $Ffmpeg -hide_banner -loglevel error -y -ss $seekOffset -i $inputPath -vf $filter -frames:v $source.Measures -q:v $quality -start_number 1 $outputPattern
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed for $($source.Song) $($source.Track)"
  }

  $manifest = for ($measure = 1; $measure -le $source.Measures; $measure++) {
    $timestamp = $seekOffset + (($measure - 1) * $measureSeconds)
    [pscustomobject]@{
      song = $source.Song
      track = $source.Track
      measure = $measure
      video_seconds = [math]::Round($timestamp, 3)
      frame = "measure-{0:d3}.jpg" -f $measure
      status = if ($HighResolution) { "pending-visual-review" } else { "pending-review" }
      note = ""
    }
  }
  $manifest | Export-Csv -LiteralPath (Join-Path $outputDirectory "manifest.csv") -NoTypeInformation -Encoding utf8
}

Write-Host "Audit frames and manifests generated in $auditRoot"
