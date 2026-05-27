# Contributing

Keep the project clean-room and self-host friendly.

## Rules

- Keep the implementation clean-room and based on public docs or user-owned configs only.
- Do not commit keys, auth files, or generated runtime data.
- Keep normal-user setup simple.
- Keep advanced server knobs in docs, not in the first-run flow.

## Checks

```bash
npm run check
```

On Windows, also parse PowerShell scripts before release:

```powershell
$errors=$null
[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw scripts\install-windows-bridge.ps1), [ref]$errors) | Out-Null
$errors
```
