$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$mods = Join-Path $PSScriptRoot "mods"

New-Item -ItemType Directory -Force -Path $mods | Out-Null

$artifacts = @(
    @{ Source = Join-Path $root "LIFESTEAL\build\libs\shd-lifesteal-0.1.0.jar"; Name = "shd-lifesteal-0.1.0.jar" },
    @{ Source = Join-Path $root ".archive\SHD-CORE\build\libs\shd-core-0.1.0.jar"; Name = "shd-core-0.1.0.jar" },
    @{ Source = Join-Path $root ".archive\SHD-UI-CLIENT\build\libs\shd-ui-client-0.1.0.jar"; Name = "shd-ui-client-0.1.0.jar" }
)

foreach ($artifact in $artifacts) {
    if (!(Test-Path -LiteralPath $artifact.Source)) {
        throw "Missing artifact: $($artifact.Source)"
    }

    Copy-Item -LiteralPath $artifact.Source -Destination (Join-Path $mods $artifact.Name) -Force
}

Get-ChildItem -LiteralPath $mods | Select-Object Name, Length
