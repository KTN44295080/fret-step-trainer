param(
  [string]$Ffmpeg = "ffmpeg",
  [ValidateSet("life-over", "madow")]
  [string]$Song,
  [switch]$HighResolution
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$videoCache = Join-Path $workspace "audit\video-cache"
$auditRoot = Join-Path $workspace $(if ($HighResolution) { "audit\measure-frames-highres" } else { "audit\measure-frames" })

$sources = @(
  [pscustomobject]@{ Song = "life-over"; Track = "lead"; Video = "6LfUfHSIiMw.mp4"; Offset = 215.0; Bpm = 170; Measures = 151; MeterMap = @{} },
  [pscustomobject]@{ Song = "life-over"; Track = "backing"; Video = "6LfUfHSIiMw.mp4"; Offset = 215.0; Bpm = 170; Measures = 151; MeterMap = @{} },
  [pscustomobject]@{ Song = "madow"; Track = "lead"; Video = "85ORTRtwmF4.mp4"; Offset = 1.2; Bpm = 194; Measures = 207; MeterMap = @{ 18 = 6; 117 = 5; 118 = 5; 119 = 5; 120 = 6; 121 = 5; 122 = 5; 123 = 5; 124 = 6 } },
  [pscustomobject]@{ Song = "madow"; Track = "backing"; Video = "vPexB7CEMGY.mp4"; Offset = 1.0; Bpm = 194; Measures = 207; MeterMap = @{ 18 = 6; 117 = 5; 118 = 5; 119 = 5; 120 = 6; 121 = 5; 122 = 5; 123 = 5; 124 = 6 } }
)

New-Item -ItemType Directory -Force -Path $auditRoot | Out-Null

foreach ($source in $sources) {
  if ($Song -and $source.Song -ne $Song) { continue }
  $inputPath = Join-Path $videoCache $source.Video
  if (-not (Test-Path -LiteralPath $inputPath)) {
    throw "Missing audit source: $inputPath"
  }

  $outputDirectory = Join-Path $auditRoot "$($source.Song)-$($source.Track)"
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  $stepSeconds = 15.0 / $source.Bpm
  # The normal set is retained for quick OCR experiments.  The high-resolution
  # audit set is sampled in the middle of each measure and keeps the video's
  # native 1920x1080 pixels so a fret number cannot drift onto another string.
  $quality = if ($HighResolution) { 1 } else { 3 }
  $elapsedSteps = 0
  $manifest = for ($measure = 1; $measure -le $source.Measures; $measure++) {
    $beats = if ($source.MeterMap.ContainsKey($measure)) { $source.MeterMap[$measure] } else { 4 }
    $measureSteps = $beats * 4
    # Guitar Pro changes the yellow selection shortly after a bar boundary.
    # Sampling at the boundary can therefore capture the previous measure even
    # when the timestamp math is correct.  Both OCR and visual-audit frames use
    # the middle of the measure so their highlighted bar is unambiguous.
    $sampleStep = $measureSteps / 2.0
    $timestamp = $source.Offset + (($elapsedSteps + $sampleStep) * $stepSeconds)
    $outputPath = Join-Path $outputDirectory ("measure-{0:d3}.jpg" -f $measure)
    $filterArguments = if ($HighResolution) { @() } else { @("-vf", "scale=1280:-2") }
    & $Ffmpeg -hide_banner -loglevel error -y -ss $timestamp -i $inputPath @filterArguments -frames:v 1 -q:v $quality $outputPath
    if ($LASTEXITCODE -ne 0) {
      throw "ffmpeg failed for $($source.Song) $($source.Track) measure $measure"
    }
    $elapsedSteps += $measureSteps
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
