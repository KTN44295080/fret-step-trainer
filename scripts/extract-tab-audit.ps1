param(
  [string]$Ffmpeg = "ffmpeg"
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$videoCache = Join-Path $workspace "audit\video-cache"
$auditRoot = Join-Path $workspace "audit\measure-frames"

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
  $filter = "fps=1/$measureSeconds,scale=1280:-2"

  & $Ffmpeg -hide_banner -loglevel error -y -ss $source.Offset -i $inputPath -vf $filter -frames:v $source.Measures -q:v 3 -start_number 1 $outputPattern
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed for $($source.Song) $($source.Track)"
  }

  $manifest = for ($measure = 1; $measure -le $source.Measures; $measure++) {
    $timestamp = $source.Offset + (($measure - 1) * $measureSeconds)
    [pscustomobject]@{
      song = $source.Song
      track = $source.Track
      measure = $measure
      video_seconds = [math]::Round($timestamp, 3)
      frame = "measure-{0:d3}.jpg" -f $measure
      status = "pending-review"
      note = ""
    }
  }
  $manifest | Export-Csv -LiteralPath (Join-Path $outputDirectory "manifest.csv") -NoTypeInformation -Encoding utf8
}

Write-Host "Audit frames and manifests generated in $auditRoot"
