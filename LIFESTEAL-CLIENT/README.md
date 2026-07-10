# SHD Lifesteal Client

Client-only Fabric companion for the SHD Lifesteal server mod.

This mod registers the visual/client representation of `shd-lifesteal:heart`, packages heart item assets under the original `shd-lifesteal` namespace, declares a lightweight `shd-lifesteal-client:integrity` networking channel, and reports the active Fabric mod list on server join for audit-only integrity alerts. It intentionally does not include any gameplay rules, persistence, commands, mixins, recipes, or server services.

Install this with Fabric API on clients that connect to servers running the authoritative `shd-lifesteal` mod. The server still owns all heart behavior.

## Build

From this directory:

```powershell
.\\gradlew.bat build
```

The output jar is written to `build/libs/shd-lifesteal-client-0.1.0.jar`.
