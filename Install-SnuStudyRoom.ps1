[CmdletBinding()]
param([string] $SkillHome)

$ErrorActionPreference = 'Stop'
$skillName = 'snu-ssims-study-room'
$source = Join-Path $PSScriptRoot "skills/$skillName"
$files = @('SKILL.md', 'references/journal.md', 'references/ssims.md', 'scripts/attempts.mjs')

if (-not $SkillHome) {
    $SkillHome = Join-Path $HOME '.agents/skills'
}
if (-not [IO.Path]::IsPathRooted($SkillHome)) { throw 'SkillHome must be an absolute path.' }
$root = [IO.Path]::GetFullPath($SkillHome)
$target = Join-Path $root $skillName
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $file) -PathType Leaf)) {
        throw "Missing packaged file: $file"
    }
}

if (Test-Path -LiteralPath $target) {
    foreach ($file in $files) {
        $installed = Join-Path $target $file
        if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) { throw "Existing skill is incomplete: $target" }
        if ((Get-FileHash -LiteralPath $installed).Hash -ne (Get-FileHash -LiteralPath (Join-Path $source $file)).Hash) {
            throw "Existing skill differs. Keep it or install to a separate skill directory: $target"
        }
    }
    Write-Output $target
    return
}

[void][IO.Directory]::CreateDirectory($root)
$parent = [IO.Directory]::GetParent($root).FullName
$staging = Join-Path $parent ('.snu-ssims-install-' + [Guid]::NewGuid().ToString('N'))
if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($staging)) -ine $parent) {
    throw 'Invalid installation staging path.'
}
[void][IO.Directory]::CreateDirectory($staging)
try {
    foreach ($file in $files) {
        $compiled = Join-Path $staging $file
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($compiled))
        Copy-Item -LiteralPath (Join-Path $source $file) -Destination $compiled
    }
    [IO.Directory]::Move($staging, $target)
} finally {
    if (Test-Path -LiteralPath $staging -PathType Container) {
        foreach ($file in $files) {
            $candidate = Join-Path $staging $file
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { [IO.File]::Delete($candidate) }
        }
        foreach ($folder in @('references', 'scripts')) {
            $candidate = Join-Path $staging $folder
            if (Test-Path -LiteralPath $candidate -PathType Container) { [IO.Directory]::Delete($candidate) }
        }
        [IO.Directory]::Delete($staging)
    }
}
Write-Output $target
