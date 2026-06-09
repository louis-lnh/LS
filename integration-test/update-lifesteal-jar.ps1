$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$jarName = "shd-lifesteal-0.1.0.jar"
$source = Join-Path $root "LIFESTEAL\build\libs\$jarName"

$targets = @(
    Join-Path $PSScriptRoot "mods\$jarName"
    "B:\.minecraft-server\mods\$jarName"
    "B:\CourseForge\Instances\LS PVP 1.21.11\mods\$jarName"
    "B:\CourseForge\Instances\LS PVP 1.21.11 (1)\mods\$jarName"
)

if (!(Test-Path -LiteralPath $source)) {
    throw "Missing artifact: $source"
}

$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash

foreach ($target in $targets) {
    $targetDirectory = Split-Path -Parent $target
    if (!(Test-Path -LiteralPath $targetDirectory)) {
        throw "Missing target directory: $targetDirectory"
    }

    Copy-Item -LiteralPath $source -Destination $target -Force
}

$targets | ForEach-Object {
    [PSCustomObject]@{
        Path = $_
        Sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash
        MatchesSource = ((Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash -eq $sourceHash)
    }
}
