# Run from project root, such as `.\server\prepub.ps1 darwin-arm64`
# This helps prepare for `vsce publish --target <platform>` by putting the appropriate
# server executable in `./server` and removing all others.
# It also makes some basic checks on the workspace.
param (
	[Parameter(Mandatory)]
	[ValidateSet("win32-x64","linux-x64","darwin-x64","darwin-arm64","universal")]
	[string]$platform
)

$changelog = Get-Content .\CHANGELOG.md
if ($changelog.ToLower() -match "unreleased") {
	Write-Error "unreleased appears in CHANGELOG"
	exit 1
}

$package1 = Get-Content .\package.json | ConvertFrom-Json
Write-Output ("package version is " + $package1.version)

$expected_re_patt = "## \[" + $package1.version + "\] - " + (Get-Date -Format yyyy-M-d)
if (! ($changelog -match $expected_re_patt)) {
	Write-Error ("expected pattern " + "not found in the CHANGELOG (" + $expected_re_patt + ")")
	exit 1
}

if ($platform -eq "universal") {
	Remove-Item server/**/a2kit*
	Get-ChildItem server -R
	return
}

if ($platform -eq "win32-x64") {
	$server = "x86_64-pc-windows-msvc"
} elseif ($platform -eq "linux-x64") {
	$server = "x86_64-unknown-linux-musl"
} elseif ($platform -eq "darwin-x64") {
	$server = "x86_64-apple-darwin"
} elseif ($platform -eq "darwin-arm64") {
	$server = "aarch64-apple-darwin"
}

$srcPath = $home + "/Downloads/result-" + $server + "/" + "a2kit-" + $server
$srcPath = Get-ChildItem (Get-ChildItem ($srcPath + "-*[0-9a-f]"))
Write-Output $srcPath

Remove-Item server/**/a2kit*
if (! (Test-Path -Path server/$platform)) {
    mkdir server/$platform
}
Copy-Item -Path $srcPath -Destination server/$platform/
Get-ChildItem server -R
