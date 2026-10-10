param(
    [string]$Architectures = 'arm64-v8a',
    [string]$AppDirectory = (Split-Path $PSScriptRoot -Parent),
    [string]$ToolsDirectory,
    [string]$CredentialsPath,
    [switch]$SkipRuntime
)
$ErrorActionPreference = 'Stop'
$taskApp = $AppDirectory
$taskRepo = Split-Path $taskApp -Parent
$taskTools = if ($ToolsDirectory) { $ToolsDirectory } else { Join-Path $taskRepo '.tools/android-local' }
# Native tools cannot consistently handle long Windows paths and mixed subst roots.
# Build in an ASCII staging path; it is a disposable copy, with no credentials copied.
if (!$PSBoundParameters.ContainsKey('AppDirectory')) {
    Push-Location $taskApp
    try {
        node scripts/build-runtime.mjs
        if ($LASTEXITCODE) { throw 'Falha ao gerar os runtimes.' }
        $taskStage = Join-Path $env:TEMP 'dnc'
        $taskStageApp = Join-Path $taskStage 'a'
        New-Item -ItemType Directory -Force -Path $taskStageApp | Out-Null
        $taskExcludes = @('.expo','.export','android','artifacts','credentials') | ForEach-Object { Join-Path $taskApp $_ }
        & robocopy $taskApp $taskStageApp /E /MT:8 /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD $taskExcludes /XF credentials.json
        if ($LASTEXITCODE -ge 8) { throw 'Falha ao preparar a pasta temporária.' }
        New-Item -ItemType Directory -Force -Path (Join-Path $taskStage 'src') | Out-Null
        Copy-Item -LiteralPath (Join-Path $taskRepo 'src/sge-reader.mjs'),(Join-Path $taskRepo 'src/sge-pages.mjs') -Destination (Join-Path $taskStage 'src')
        $taskCredentials = if ($CredentialsPath) { $CredentialsPath } else { Join-Path $taskApp 'credentials.json' }
        & $PSCommandPath -AppDirectory $taskStageApp -ToolsDirectory $taskTools -CredentialsPath $taskCredentials -SkipRuntime -Architectures $Architectures
        New-Item -ItemType Directory -Force -Path (Join-Path $taskApp 'artifacts') | Out-Null
        Copy-Item -LiteralPath (Join-Path $taskStageApp 'artifacts/organizador-donicia-1.0.0-android.apk') -Destination (Join-Path $taskApp 'artifacts/organizador-donicia-1.0.0-android.apk')
    } finally { Pop-Location }
    return
}
$env:JAVA_HOME = (Get-ChildItem -LiteralPath $taskTools -Directory -Filter 'jdk-*' | Select-Object -First 1).FullName
if (!$env:JAVA_HOME) { throw 'Instale o JDK em .tools/android-local.' }
$env:ANDROID_HOME = Join-Path $taskTools 'sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $taskTools 'gradle-cache'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:DONICIA_ANDROID_CREDENTIALS = if ($CredentialsPath) { $CredentialsPath } else { Join-Path $taskApp 'credentials.json' }
$env:CI = '1'
$env:NODE_ENV = 'production'
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'
if (!(Test-Path -LiteralPath $env:DONICIA_ANDROID_CREDENTIALS)) { throw 'Baixe as credenciais Android do EAS para credentials.json antes de compilar.' }
Push-Location $taskApp
try {
    if (!$SkipRuntime) {
        node scripts/build-runtime.mjs
        if ($LASTEXITCODE) { throw 'Falha ao gerar os runtimes.' }
    }
    if (!(Test-Path -LiteralPath 'android/gradlew.bat')) {
        node node_modules/expo/bin/cli prebuild --platform android --no-install
        if ($LASTEXITCODE) { throw 'Falha ao gerar o projeto Android.' }
    }
    $taskGradlePath = Join-Path $taskApp 'android/app/build.gradle'
    # Regenerate cached autolinking with UTF-8 for Windows paths containing accents.
    $taskAutolinking = Join-Path $taskApp 'android/build/generated/autolinking/autolinking.json'
    if (Test-Path -LiteralPath $taskAutolinking) { Remove-Item -LiteralPath $taskAutolinking }
    $taskGradle = Get-Content -LiteralPath $taskGradlePath -Raw
    if (!$taskGradle.Contains('// Donicia local release signing')) {
        @'

// Donicia local release signing: secrets stay in the ignored credentials file.
def credentialsFile = new File(System.getenv('DONICIA_ANDROID_CREDENTIALS'))
def localCredentials = new groovy.json.JsonSlurper().parse(credentialsFile).android.keystore
android.signingConfigs.create('organizadorRelease') {
    storeFile new File(credentialsFile.parentFile, localCredentials.keystorePath)
    storePassword localCredentials.keystorePassword
    keyAlias localCredentials.keyAlias
    keyPassword localCredentials.keyPassword
}
android.buildTypes.release.signingConfig = android.signingConfigs.organizadorRelease
'@ | Add-Content -LiteralPath $taskGradlePath
    }
    Push-Location (Join-Path $taskApp 'android')
    try {
        & ./gradlew.bat app:assembleRelease "-PreactNativeArchitectures=$Architectures" --no-daemon --max-workers=2
        if ($LASTEXITCODE) { throw 'Falha na compilação Android.' }
    } finally { Pop-Location }
    New-Item -ItemType Directory -Force -Path 'artifacts' | Out-Null
    $taskApk = Join-Path $taskApp 'artifacts/organizador-donicia-1.0.0-android.apk'
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $taskApk
    & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs $taskApk
    if ($LASTEXITCODE) { throw 'Assinatura do APK inválida.' }
    Get-FileHash -LiteralPath $taskApk -Algorithm SHA256
} finally { Pop-Location }
