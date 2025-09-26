"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanManager = void 0;
const vscode = require("vscode");
const semgrep_1 = require("./semgrep");
function mapSeverity(s) {
    switch (s.toUpperCase()) {
        case 'ERROR': return vscode.DiagnosticSeverity.Error;
        case 'WARNING': return vscode.DiagnosticSeverity.Warning;
        default: return vscode.DiagnosticSeverity.Information;
    }
}
class ScanManager {
    constructor(diagnostics, channel) {
        this.lastTextHash = new Map();
        this.diagnostics = diagnostics;
        this.channel = channel;
        this.runner = new semgrep_1.SemgrepRunner(channel);
    }
    scheduleScan(doc, delayMs = 600) {
        if (doc.uri.scheme !== 'file') {
            return;
        }
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.runSemgrep(doc), delayMs);
    }
    async runSemgrep(doc) {
        try {
            const findings = await this.runner.scanFile(doc);
            const cfg = vscode.workspace.getConfiguration();
            const changedOnly = cfg.get('securecode.scanChangedLinesOnly', true);
            const text = doc.getText();
            const hash = this.simpleHash(text);
            const prev = this.lastTextHash.get(doc.uri.fsPath);
            this.lastTextHash.set(doc.uri.fsPath, hash);
            const diags = [];
            for (const f of findings) {
                if (f.path !== doc.uri.fsPath)
                    continue;
                const startLine = Math.max(0, (f.start.line || 1) - 1);
                const endLine = Math.max(0, (f.end.line || f.start.line || 1) - 1);
                const start = new vscode.Position(startLine, Math.max(0, (f.start.col || 1) - 1));
                const end = new vscode.Position(endLine, Math.max(0, (f.end.col || 1) - 1));
                const range = new vscode.Range(start, end);
                if (changedOnly && prev && prev === hash)
                    continue;
                const d = new vscode.Diagnostic(range, f.extra.message, mapSeverity(f.extra.severity));
                d.source = `Semgrep (${f.check_id})`;
                diags.push(d);
            }
            this.diagnostics.set(doc.uri, diags);
            this.channel.appendLine(`[scan] ${doc.fileName}: ${diags.length} semgrep findings.`);
        }
        catch (e) {
            this.channel.appendLine(`[scan] failed: ${e.message}`);
        }
    }
    simpleHash(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h * 31 + s.charCodeAt(i)) | 0;
        }
        return h;
    }
}
exports.ScanManager = ScanManager;
//# sourceMappingURL=scan.js.map