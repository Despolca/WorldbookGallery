# Quản lý Ảnh bìa Worldbook - Script Cài đặt / Gỡ cài đặt
#
# Cách sử dụng (Nhấp chuột phải vào thư mục này chọn "Run with PowerShell", hoặc kéo thả vào cửa sổ PowerShell):
#
#   .\install.ps1 -Action install     Cài plugin vào SillyTavern
#   .\install.ps1 -Action uninstall   Xóa plugin khỏi SillyTavern
#   .\install.ps1 -Action status      Chỉ kiểm tra xem đã cài chưa, không đụng chạm gì cả
#
# Script này chỉ làm một việc duy nhất: copy/xóa duy nhất thư mục worldbook-gallery này.
# Không đụng đến bất kỳ file nào khác của SillyTavern, không đụng đến thẻ nhân vật và Worldbook của bạn.

param(
    [ValidateSet('install', 'update', 'uninstall', 'status')]
    [string]$Action = 'status',

    # Thư mục gốc cài đặt SillyTavern. Mặc định để trống, script sẽ tự đi tìm;
    # Khi không tìm thấy, dùng -TavernRoot 'Đường dẫn SillyTavern của bạn' để chỉ định thủ công.
    [string]$TavernRoot = ''
)

$ErrorActionPreference = 'Stop'

# ---- Cấu hình đường dẫn ----
# Extension này có thể tồn tại dưới hai tên thư mục:
#   Khi cài từ Git URL, SillyTavern dùng tên repo -> sillytavern-visual-worldbook
#   Khi copy thủ công thư mục này               -> worldbook-gallery
# Phải nhận diện được cả hai trường hợp.
$PluginNames = @('sillytavern-visual-worldbook', 'worldbook-gallery')
$SourceDir   = $PSScriptRoot

function Find-InstalledDir {
    param([string]$ThirdPartyPath)
    foreach ($n in $PluginNames) {
        $p = Join-Path $ThirdPartyPath $n
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Find-TavernRoot {
    param([string]$Hint)

    if ($Hint) {
        if (Test-Path $Hint) { return (Resolve-Path $Hint).Path }
        Write-Host "Thư mục SillyTavern được chỉ định không tồn tại: $Hint" -ForegroundColor Red
        return $null
    }

    # Thử lần lượt các vị trí phổ biến
    $candidates = @()

    # Tìm ngược lên từ vị trí của script này (khi plugin được cài trong SillyTavern, đây là đường dẫn nhanh nhất)
    $walk = $SourceDir
    for ($i = 0; $i -lt 8; $i++) {
        $walk = Split-Path $walk -Parent
        if (-not $walk) { break }
        $candidates += $walk
    }

    # SillyTavern ở một vài ổ đĩa phổ biến
    foreach ($drive in @('C:', 'D:', 'E:', 'F:', 'G:')) {
        $base = "$drive\"
        if (-not (Test-Path $base)) { continue }
        Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like '*SillyTavern*' } |
            ForEach-Object { $candidates += $_.FullName }
    }

    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c 'public\scripts\extensions')) { return $c }
    }
    return $null
}

$TavernRoot = Find-TavernRoot -Hint $TavernRoot
$ThirdParty = if ($TavernRoot) { Join-Path $TavernRoot 'public\scripts\extensions\third-party' } else { $null }
# Cài thủ công thì dùng tên gốc của thư mục này; nếu đã cài rồi thì đi theo tên thực tế đang tồn tại
$ManualName = 'worldbook-gallery'
$InstalledDir = if ($ThirdParty) { Find-InstalledDir -ThirdPartyPath $ThirdParty } else { $null }
$TargetDir = if ($ThirdParty) { Join-Path $ThirdParty $ManualName } else { $null }

function Write-Head($text) {
    Write-Host ''
    Write-Host "==== $text ====" -ForegroundColor Cyan
}

function Assert-TavernRoot {
    if (-not $TavernRoot) {
        Write-Host 'Không tự động tìm thấy thư mục SillyTavern.' -ForegroundColor Red
        Write-Host 'Vui lòng chỉ định thủ công, ví dụ:' -ForegroundColor Yellow
        Write-Host '  .\install.ps1 -Action install -TavernRoot "D:\SillyTavern"' -ForegroundColor Yellow
        exit 1
    }
    if (-not (Test-Path $ThirdParty)) {
        Write-Host "Trong thư mục này không có thư mục third-party: $ThirdParty" -ForegroundColor Red
        Write-Host 'Thường là do phiên bản SillyTavern quá cũ, hoặc chỉ định sai thư mục.' -ForegroundColor Yellow
        exit 1
    }
}

switch ($Action) {

    'status' {
        Write-Head 'Kiểm tra trạng thái cài đặt'
        Write-Host "Thư mục nguồn plugin: $SourceDir"
        Write-Host "Thư mục SillyTavern  : $TavernRoot"
        Write-Host ''
        if ($InstalledDir) {
            $files = Get-ChildItem $InstalledDir -Recurse -File -Exclude '.git'
            Write-Host "Trạng thái: Đã cài đặt" -ForegroundColor Green
            Write-Host "Vị trí: $InstalledDir"
            Write-Host "Số file: $($files.Count)"
        }
        else {
            Write-Host "Trạng thái: Chưa cài đặt" -ForegroundColor Yellow
            Write-Host "(Không tìm thấy extension này trong third-party của SillyTavern)"
        }
    }

    'install' {
        Write-Head 'Cài đặt Quản lý Ảnh bìa Worldbook'
        Assert-TavernRoot

        # Đã cài rồi (loại cài bằng Git URL) thì đừng cài lặp lại
        if ($InstalledDir) {
            Write-Host "Extension này đã được cài rồi: $InstalledDir" -ForegroundColor Yellow
            Write-Host ''
            Write-Host 'Nếu bạn dùng tính năng "Install from Git URL" của SillyTavern, thì không cần chạy lại script này nữa,' -ForegroundColor Cyan
            Write-Host 'Chỉ cần nhấp "Update" trong trình quản lý extension của SillyTavern là được.'
            exit 0
        }

        if (Test-Path $TargetDir) {
            Write-Host "Vị trí đích đã có thư mục trùng tên: $TargetDir" -ForegroundColor Yellow
            $ans = Read-Host 'Có muốn ghi đè lên nó không? (Nhập yes để ghi đè, phím bất kỳ khác để hủy)'
            if ($ans -ne 'yes') {
                Write-Host 'Đã hủy, không đụng chạm gì cả.' -ForegroundColor Yellow
                exit 0
            }
            # Sao lưu bản cũ trước, tránh vô tình ghi đè lên phiên bản mà người dùng tự sửa
            $stamp  = Get-Date -Format 'yyyyMMdd_HHmmss'
            $backup = Join-Path $SourceDir "_backup_$stamp"
            Move-Item $TargetDir $backup
            Write-Host "Phiên bản cũ đã được dời sang bản sao lưu: $backup" -ForegroundColor Green
        }

        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

        # Chỉ copy bản thể plugin, bỏ qua các script tự kiểm tra và thư mục sao lưu
        $exclude = @('_selftest.mjs', '_selftest_toggle.mjs', '_verify_api.mjs',
                     '_verify_load.mjs', 'check.mjs', 'install.ps1')
        Get-ChildItem $SourceDir -File | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
            Copy-Item $_.FullName -Destination $TargetDir -Force
        }
        Get-ChildItem $SourceDir -Directory | Where-Object { $_.Name -notlike '_backup_*' } | ForEach-Object {
            Copy-Item $_.FullName -Destination $TargetDir -Recurse -Force
        }

        Write-Host 'Cài đặt hoàn tất.' -ForegroundColor Green
        Write-Host ''
        Write-Host 'Bước tiếp theo:' -ForegroundColor Cyan
        Write-Host '  1. Làm mới trang SillyTavern (hoặc khởi động lại SillyTavern)'
        Write-Host '  2. Nhấp vào nút phích cắm ở góc trên bên phải để mở cài đặt extension'
        Write-Host '  3. Tìm "Quản lý Ảnh bìa Worldbook", nhấp "Mở bảng ảnh bìa"'
    }

    'update' {
        Write-Head 'Cập nhật Quản lý Ảnh bìa Worldbook'

        $victim = if ($InstalledDir) { $InstalledDir } else { $TargetDir }

        if (-not (Test-Path $victim)) {
            Write-Host 'Extension này chưa từng được cài, không thể cập nhật.' -ForegroundColor Yellow
            Write-Host 'Vui lòng dùng: .\install.ps1 -Action install' -ForegroundColor Cyan
            exit 0
        }

        # Sao lưu bản cũ, có vấn đề thì lùi lại được
        $stamp  = Get-Date -Format 'yyyyMMdd_HHmmss'
        $backup = Join-Path $SourceDir "_backup_$stamp"
        Move-Item $victim $backup
        Write-Host "Phiên bản cũ đã được sao lưu tại: $backup" -ForegroundColor Green

        New-Item -ItemType Directory -Path $victim -Force | Out-Null

        # Chỉ copy bản thể plugin, bỏ qua các script tự kiểm tra và thư mục sao lưu
        $exclude = @('_selftest.mjs', '_selftest_toggle.mjs', '_verify_api.mjs',
                     '_verify_load.mjs', 'check.mjs', 'install.ps1')
        Get-ChildItem $SourceDir -File | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
            Copy-Item $_.FullName -Destination $victim -Force
        }
        Get-ChildItem $SourceDir -Directory | Where-Object { $_.Name -notlike '_backup_*' } | ForEach-Object {
            Copy-Item $_.FullName -Destination $victim -Recurse -Force
        }

        Write-Host 'Cập nhật hoàn tất.' -ForegroundColor Green
        Write-Host ''
        Write-Host 'Bước tiếp theo: Làm mới trang SillyTavern.' -ForegroundColor Cyan
        Write-Host "Nếu bản mới có vấn đề, bản cũ nằm ở: $backup" -ForegroundColor Cyan
        Write-Host "Lùi lại: Xóa $victim đi, rồi đổi tên bản sao lưu về lại tên này là được."
    }

    'uninstall' {
        Write-Head 'Gỡ cài đặt Quản lý Ảnh bìa Worldbook'

        $victim = if ($InstalledDir) { $InstalledDir } else { $TargetDir }

        if (-not (Test-Path $victim)) {
            Write-Host "Trong SillyTavern vốn dĩ không có plugin này" -ForegroundColor Yellow
            Write-Host 'Không cần làm gì cả.' -ForegroundColor Green
            exit 0
        }

        Write-Host "Sẽ xóa: $victim" -ForegroundColor Yellow
        Write-Host '(Chỉ xóa mỗi thư mục này, các nội dung khác của SillyTavern và toàn bộ thẻ, Worldbook của bạn đều không bị ảnh hưởng)'
        $ans = Read-Host 'Xác nhận xóa? (Nhập yes để tiếp tục, phím bất kỳ khác để hủy)'
        if ($ans -ne 'yes') {
            Write-Host 'Đã hủy, không đụng chạm gì cả.' -ForegroundColor Yellow
            exit 0
        }

        Remove-Item $victim -Recurse -Force
        Write-Host 'Đã xóa. Làm mới trang SillyTavern là được.' -ForegroundColor Green
        Write-Host 'Nếu muốn dùng lại, chạy lại install bất cứ lúc nào.'
    }
}