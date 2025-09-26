# SecureCode Copilot (Semgrep integration)

## How to run
1. Install dependencies: `npm install`
2. Install Semgrep locally (pick one): `pip install semgrep` | `brew install semgrep` | `scoop install semgrep`
3. Press **F5** to launch the Extension Development Host.
4. Open `test-workspace/` files and save to trigger scans.
5. Findings appear as diagnostics. Check **View → Output → SecureCode Copilot** for logs.

## Settings
- `securecode.semgrepPath`: path to the `semgrep` binary
- `securecode.rulesDir`: directory of rules (defaults to the extension's `semgrep-rules`)
- `securecode.scanChangedLinesOnly`: scan only when file content has changed since last run
