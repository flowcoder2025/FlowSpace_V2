param([switch]$EmitFingerprint)

# flowset_stop_gate.ps1 - FlowSpace .flowset process Stop gate
#
# Two modes:
#   (default)        Stop hook gate. Reads stdin JSON; blocks stopping when the ACTIVE WI has
#                    source (.ts/.tsx/.prisma) changes but no valid .pass marker.
#   -EmitFingerprint Prints the current source fingerprint (hex) and exits. Use this when writing
#                    a .pass file so its sourceFingerprint matches what the gate computes.
#
# Design : deterministic + light (runs once per turn, no LLM judgment).
#          "signal != truth" - only git / .flowset / .pass are authoritative.
# Output : exit 0; on block, stdout JSON {"decision":"block","reason":...}.
# On error: never blocks UX -> silent pass (fail-open). This gate is a reminder, not a security boundary.
# Encoding: ASCII-only literals so Windows PowerShell 5.1 (which reads BOM-less .ps1 as ANSI) is safe;
#           stdin/stdout handled as raw UTF-8 bytes for any non-ASCII paths in the event JSON.
#
# Refs: .claude/process/03-dual-verification.md, 04-ground-truth-gates.md

$ErrorActionPreference = 'Stop'

function Resolve-Root($evt) {
  $root = $env:CLAUDE_PROJECT_DIR
  if ([string]::IsNullOrWhiteSpace($root) -and $evt -and $evt.cwd) { $root = [string]$evt.cwd }
  if ([string]::IsNullOrWhiteSpace($root)) { $root = (Get-Location).Path }
  return $root
}

# Returns @{ changed = <string[]>; fp = <sha256 hex of sorted "path:blobsha"> }
function Get-SourceState($root) {
  $tracked = & git -C "$root" diff --name-only --diff-filter=ACMRTUX HEAD -- 2>$null
  $untracked = & git -C "$root" ls-files --others --exclude-standard 2>$null
  $changed = @()
  foreach ($f in (@($tracked) + @($untracked))) {
    if ($f -and ($f -match '\.(ts|tsx|prisma)$')) { $changed += $f }
  }
  $changed = @($changed | Sort-Object -Unique)
  $parts = foreach ($f in $changed) {
    $sha = & git -C "$root" hash-object -- "$f" 2>$null
    "$f`:$sha"
  }
  $joined = ($parts -join "`n")
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  $fp = ([System.BitConverter]::ToString($hasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($joined)))).Replace('-', '').ToLower()
  return @{ changed = $changed; fp = $fp }
}

function Block([string]$reason) {
  $json = (@{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $out = [Console]::OpenStandardOutput()
  $out.Write($bytes, 0, $bytes.Length); $out.Flush()
  exit 0
}

# --- EmitFingerprint mode: print current source fingerprint, exit (for .pass authoring) ---
if ($EmitFingerprint) {
  try {
    $root = Resolve-Root $null
    $st = Get-SourceState $root
    [Console]::Out.Write($st.fp)
  } catch { }
  exit 0
}

# --- Stop gate mode ---
try {
  $reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
  $raw = $reader.ReadToEnd()
  $evt = $null
  if ($raw -and $raw.Trim().Length -gt 0) {
    try { $evt = $raw | ConvertFrom-Json } catch { $evt = $null }
  }

  $root = Resolve-Root $evt

  $stopActive = $false
  if ($evt -and ($evt.PSObject.Properties.Name -contains 'stop_hook_active')) { $stopActive = [bool]$evt.stop_hook_active }

  $curPath = Join-Path $root '.flowset/current.json'
  if (-not (Test-Path -LiteralPath $curPath)) { exit 0 }   # process not in use -> pass

  $cur = Get-Content -Raw -LiteralPath $curPath | ConvertFrom-Json
  $wi = [string]$cur.activeWI
  if ([string]::IsNullOrWhiteSpace($wi) -or $cur.status -ne 'ACTIVE') { exit 0 }

  $st = Get-SourceState $root
  if ($st.changed.Count -eq 0) { exit 0 }                  # no source change -> pass

  $passPath = Join-Path $root ".flowset/eval-results/$wi.pass"
  if (-not (Test-Path -LiteralPath $passPath)) {
    Block "WI '$wi' has source changes ($($st.changed.Count) file(s)) but .flowset/eval-results/$wi.pass is missing. Run dual verification (codex + evaluator), confirm .merged.json has no P0/P1/fixNow and machine gates (tsc/lint/vitest/build) pass, then write .pass (including sourceFingerprint) before stopping. See .claude/process/03,04."
  }

  $passText = Get-Content -Raw -LiteralPath $passPath
  $passFp = $null
  foreach ($line in ($passText -split "`n")) {
    if ($line -match '^\s*sourceFingerprint\s*=\s*(.+?)\s*$') { $passFp = $Matches[1].Trim() }
  }
  if ($passFp -and ($passFp -ne $st.fp) -and (-not $stopActive)) {
    Block "WI '$wi' .pass sourceFingerprint does not match the current source changes (stale). Re-verify the changes and refresh .pass before stopping."
  }

  exit 0
}
catch {
  exit 0
}
