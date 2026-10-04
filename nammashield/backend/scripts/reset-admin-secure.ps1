$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $adminUsername = Read-Host 'Administrator username'
    $adminPassword = Read-Host 'New password (at least 14 characters)' -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassword)
    try {
        $env:ADMIN_NEW_USERNAME = $adminUsername
        $env:ADMIN_NEW_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        node scripts/reset-admin.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Administrator password was not changed.' }
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        Remove-Item Env:ADMIN_NEW_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:ADMIN_NEW_USERNAME -ErrorAction SilentlyContinue
        $adminPassword.Dispose()
    }
} finally {
    Pop-Location
}
