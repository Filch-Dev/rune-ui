# Cuts a part out of a screenshot and enlarges it z times, with sharp pixels, to check a few units by eye.
# Run: powershell -File crop.ps1 <src> <x> <y> <w> <h> <z> <out.png>
param([string]$src, [int]$x, [int]$y, [int]$w, [int]$h, [int]$z, [string]$out)
Add-Type -AssemblyName System.Drawing
# .NET reads relative paths from its own folder, not from PowerShell's
$src = (Resolve-Path $src).Path
if (-not [System.IO.Path]::IsPathRooted($out)) { $out = Join-Path (Get-Location).Path $out }
$i = [System.Drawing.Image]::FromFile($src)
$b = New-Object System.Drawing.Bitmap ($w * $z), ($h * $z)
$g = [System.Drawing.Graphics]::FromImage($b)
$g.InterpolationMode = 'NearestNeighbor'
$g.DrawImage($i, (New-Object System.Drawing.Rectangle 0, 0, ($w * $z), ($h * $z)), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
$b.Save($out)
$g.Dispose(); $b.Dispose(); $i.Dispose()
