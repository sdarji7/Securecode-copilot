"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemgrepRunner = void 0;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const path = require("path");
class SemgrepRunner {
    constructor(channel) {
        this.channel = channel;
    }
    async scanFile(doc) {
        const cfg = vscode.workspace.getConfiguration();
        const semgrepPath = cfg.get('securecode.semgrepPath', 'semgrep');
        this.channel.appendLine(`[semgrep] Using Semgrep at: ${semgrepPath}`);
        let rulesDir = cfg.get('securecode.rulesDir', '');
        if (rulesDir.includes('${extensionPath}')) {
            const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
            if (ext)
                rulesDir = rulesDir.replace('${extensionPath}', ext.extensionPath);
        }
        if (!rulesDir) {
            const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
            rulesDir = ext ? path.join(ext.extensionPath, 'semgrep-rules') : 'semgrep-rules';
        }
        const filePath = doc.uri.fsPath;
        // Dynamically select rule file based on filename
        const fileName = path.basename(filePath);
        let ruleFile = '';
        if (fileName === 'missing_auth.py') {
            ruleFile = path.join(rulesDir, 'missing_auth_check.yaml');
        }
        else if (fileName === 'hardcoded_secret.py') {
            ruleFile = path.join(rulesDir, 'hardcoded_secrets.yaml');
        }
        else {
            ruleFile = path.join(rulesDir, 'hardcoded_secrets.yaml'); // default
        }
        this.channel.appendLine(`[semgrep] Using rule file: ${ruleFile}`);
        const args = ['--json', '--config', ruleFile, filePath];
        this.channel.appendLine(`[semgrep] Running: ${semgrepPath} ${args.join(' ')}`);
        return new Promise((resolve) => {
            (0, child_process_1.execFile)(semgrepPath, args, { cwd: path.dirname(filePath) }, (err, stdout, stderr) => {
                if (err) {
                    this.channel.appendLine(`[semgrep] error: ${err.message}`);
                }
                if (stderr) {
                    this.channel.appendLine(`[semgrep] stderr: ${stderr.trim()}`);
                }
                try {
                    const parsed = JSON.parse(stdout || '{}');
                    const results = (parsed.results || []);
                    const findings = results.map((r) => ({
                        check_id: r.check_id,
                        path: r.path,
                        start: { line: r.start.line, col: r.start.col },
                        end: { line: r.end.line, col: r.end.col },
                        extra: { message: r.extra?.message || r.check_id, severity: (r.extra?.severity || 'WARNING').toUpperCase() }
                    }));
                    this.channel.appendLine(`[semgrep] Findings: ${JSON.stringify(findings)}`);
                    resolve(findings);
                }
                catch (e) {
                    this.channel.appendLine(`[semgrep] failed to parse JSON: ${e.message}`);
                    resolve([]);
                }
            });
        });
    }
    // Provide LLM-based quick fixes for security issues
    provideCodeActions(doc, range, diagnostics) {
        const codeActions = [];
        diagnostics.forEach(diag => {
            if (!range.intersection(diag.range))
                return;
            // LLM-based fix for hardcoded secrets
            if (diag.message.includes('hardcoded') || diag.message.includes('API_KEY') || diag.message.includes('Bearer')) {
                this.channel.appendLine(`[semgrep] Creating LLM fix for hardcoded secret`);
                const action = new vscode.CodeAction('🤖 Fix with AI (Hardcoded Secret)', vscode.CodeActionKind.QuickFix);
                action.command = {
                    title: 'Apply LLM Fix',
                    command: 'securecode.applyLlmFix',
                    arguments: [doc.uri, diag.range, 'hardcoded secret']
                };
                codeActions.push(action);
            }
            // LLM-based fix for missing authorization
            if (diag.message.includes('authorization')) {
                this.channel.appendLine(`[semgrep] Creating LLM fix for missing authorization`);
                const action = new vscode.CodeAction('🤖 Fix with AI (Missing Auth)', vscode.CodeActionKind.QuickFix);
                action.command = {
                    title: 'Apply LLM Fix',
                    command: 'securecode.applyLlmFix',
                    arguments: [doc.uri, diag.range, 'missing authorization']
                };
                codeActions.push(action);
            }
        });
        this.channel.appendLine(`[semgrep] Returning ${codeActions.length} code actions`);
        return codeActions;
    }
}
exports.SemgrepRunner = SemgrepRunner;
//# sourceMappingURL=semgrep.js.map