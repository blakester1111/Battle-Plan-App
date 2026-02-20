Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
    param($x, $y, $w, $h, $r)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconBitmap {
    param([int]$size)

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'HighQuality'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'

    # Transparent background
    $g.Clear([System.Drawing.Color]::Transparent)

    # Amber gradient background with rounded corners
    $radius = [math]::Round($size * 0.1875)  # ~18.75% corner radius
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-RoundedRectPath 0 0 $size $size $radius

    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 245, 158, 11),   # #f59e0b
        [System.Drawing.Color]::FromArgb(255, 217, 119, 6),    # #d97706
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillPath($gradBrush, $path)

    # "BP" text - white, bold, centered
    $fontSize = [math]::Round($size * 0.46)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'
    $sf.LineAlignment = 'Center'

    $textRect = New-Object System.Drawing.RectangleF(0, ([float]($size * -0.02)), $size, $size)
    $g.DrawString("BP", $font, $textBrush, $textRect, $sf)

    # Subtle accent line near bottom
    $lineY = [math]::Round($size * 0.78)
    $lineH = [math]::Max(1, [math]::Round($size * 0.02))
    $lineX = [math]::Round($size * 0.12)
    $lineW = $size - 2 * $lineX
    $lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 255, 255, 255))
    $lineRadius = [math]::Max(1, [math]::Round($lineH / 2))
    $linePath = New-RoundedRectPath $lineX $lineY $lineW $lineH $lineRadius
    $g.FillPath($lineBrush, $linePath)

    # Cleanup
    $g.Dispose()
    $font.Dispose()
    $textBrush.Dispose()
    $lineBrush.Dispose()
    $gradBrush.Dispose()
    $sf.Dispose()
    $path.Dispose()
    $linePath.Dispose()

    return $bmp
}

# Generate bitmaps at multiple sizes
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$bitmaps = @()
foreach ($s in $sizes) {
    $bitmaps += (New-IconBitmap $s)
}

# Write ICO file manually (System.Drawing.Icon.Save doesn't support multi-size)
$icoPath = Join-Path $PSScriptRoot "bp-app.ico"
$publicIcoPath = Join-Path $PSScriptRoot "public\favicon.ico"

function Write-ICO {
    param($filePath, $bitmapList)

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)

    $count = $bitmapList.Count

    # ICO header
    $bw.Write([UInt16]0)       # reserved
    $bw.Write([UInt16]1)       # type = ICO
    $bw.Write([UInt16]$count)  # image count

    # Collect PNG data for each bitmap
    $pngDataList = @()
    foreach ($bmp in $bitmapList) {
        $pngStream = New-Object System.IO.MemoryStream
        $bmp.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngDataList += ,$pngStream.ToArray()
        $pngStream.Dispose()
    }

    # Calculate data offset (header=6 + entries=count*16)
    $dataOffset = 6 + $count * 16

    # Write directory entries
    for ($i = 0; $i -lt $count; $i++) {
        $s = $bitmapList[$i].Width
        $bw.Write([byte]$(if ($s -ge 256) { 0 } else { $s }))  # width
        $bw.Write([byte]$(if ($s -ge 256) { 0 } else { $s }))  # height
        $bw.Write([byte]0)         # color palette
        $bw.Write([byte]0)         # reserved
        $bw.Write([UInt16]1)       # color planes
        $bw.Write([UInt16]32)      # bits per pixel
        $bw.Write([UInt32]$pngDataList[$i].Length)  # data size
        $bw.Write([UInt32]$dataOffset)              # data offset
        $dataOffset += $pngDataList[$i].Length
    }

    # Write PNG data
    foreach ($pngData in $pngDataList) {
        $bw.Write($pngData)
    }

    # Save to file
    [System.IO.File]::WriteAllBytes($filePath, $ms.ToArray())

    $bw.Dispose()
    $ms.Dispose()
}

Write-ICO $icoPath $bitmaps
Write-ICO $publicIcoPath $bitmaps

Write-Host "Created $icoPath ($((Get-Item $icoPath).Length) bytes) - sizes: $($sizes -join ', ')px"
Write-Host "Created $publicIcoPath"

# Cleanup
foreach ($bmp in $bitmaps) { $bmp.Dispose() }
