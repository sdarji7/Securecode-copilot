import * as vscode from 'vscode';
import { SemgrepRunner } from './semgrep';

function mapSeverity(s: string): vscode.DiagnosticSeverity {
  switch (s.toUpperCase()) {
    case 'ERROR': return vscode.DiagnosticSeverity.Error;
    case 'WARNING': return vscode.DiagnosticSeverity.Warning;
    default: return vscode.DiagnosticSeverity.Information;
  }
}

export class ScanManager {
  private diagnostics: vscode.DiagnosticCollection;
  private channel: vscode.OutputChannel;
  private debounceTimer?: NodeJS.Timeout;
  private runner: SemgrepRunner;
  private lastTextHash = new Map<string, number>();

  constructor(diagnostics: vscode.DiagnosticCollection, channel: vscode.OutputChannel) {
    this.diagnostics = diagnostics;
    this.channel = channel;
    this.runner = new SemgrepRunner(channel);
  }

  public scheduleScan(doc: vscode.TextDocument, delayMs = 300): void {
    if (doc.uri.scheme !== 'file') { return; }
    clearTimeout(this.debounceTimer as unknown as number);
    this.debounceTimer = setTimeout(() => this.runSemgrep(doc), delayMs);
  }

  private async runSemgrep(doc: vscode.TextDocument): Promise<void> {
    try {
      const version = doc.version;
      const findings = await this.runner.scanFile(doc);
      
      // Document changed during scan, abort
      if (doc.version !== version) return;

      const diags: vscode.Diagnostic[] = [];
      
      for (const f of findings) {
        if (f.path !== doc.uri.fsPath) continue;
        
        const startLine = Math.max(0, (f.start.line || 1) - 1);
        const endLine = Math.max(0, (f.end.line || f.start.line || 1) - 1);
        const start = new vscode.Position(startLine, Math.max(0, (f.start.col || 1) - 1));
        const end = new vscode.Position(endLine, Math.max(0, (f.end.col || 1) - 1));
        const range = new vscode.Range(start, end);
        
        const d = new vscode.Diagnostic(range, f.extra.message, mapSeverity(f.extra.severity));
        d.source = `Semgrep (${f.check_id})`;
        diags.push(d);
      }
      
      // Set all diagnostics at once (after loop completes)
      this.diagnostics.set(doc.uri, diags);
      this.channel.appendLine(`[scan] ${doc.fileName}: ${diags.length} semgrep findings.`);
      
    } catch (e: any) {
      this.channel.appendLine(`[scan] failed: ${e.message}`);
    }
  }

  private simpleHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h;
  }
}