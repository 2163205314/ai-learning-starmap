$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Find-PythonCommand {
    $candidates = @(
        @("py", "-3.12"),
        @("python"),
        @("python3")
    )
    foreach ($candidate in $candidates) {
        $exe = Get-Command $candidate[0] -ErrorAction SilentlyContinue
        if (-not $exe) { continue }
        try {
            $candidateArgs = @()
            if ($candidate.Length -gt 1) {
                $candidateArgs = $candidate[1..($candidate.Length - 1)]
            }
            $version = & $candidate[0] @candidateArgs -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
            if ($LASTEXITCODE -eq 0) {
                $parts = $version.Trim().Split('.')
                if ([int]$parts[0] -gt 3 -or ([int]$parts[0] -eq 3 -and [int]$parts[1] -ge 12)) {
                    return $candidate
                }
            }
        } catch {}
    }
    return $null
}

Write-Host "AI Learning Starmap Windows PowerShell bootstrap"
$python = Find-PythonCommand
if (-not $python) {
    Write-Host "Python 3.12+ was not found." -ForegroundColor Red
    Write-Host "Install Python from https://www.python.org/downloads/ and enable Add python.exe to PATH."
    exit 1
}

$pythonArgs = @()
if ($python.Length -gt 1) {
    $pythonArgs = $python[1..($python.Length - 1)]
}
& $python[0] @pythonArgs scripts\bootstrap.py @args
if ($LASTEXITCODE -ne 0) {
    Write-Host "Startup failed. Please follow the hints above and retry." -ForegroundColor Red
    exit $LASTEXITCODE
}
