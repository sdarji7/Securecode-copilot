import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export type SemgrepFinding = {
  check_id: string;
  path: string;
  start: { line: number, col: number };
  end: { line: number, col: number };
  extra: { message: string; severity: 'INFO' | 'WARNING' | 'ERROR' };
};

export class SemgrepRunner {
  private channel: vscode.OutputChannel;

  constructor(channel: vscode.OutputChannel) {
    this.channel = channel;
  }

  public async scanFile(doc: vscode.TextDocument): Promise<SemgrepFinding[]> {
    const cfg = vscode.workspace.getConfiguration();
    const semgrepPath = cfg.get<string>('securecode.semgrepPath', 'semgrep');

    this.channel.appendLine(`[semgrep] Using Semgrep at: ${semgrepPath}`);

    let rulesDir = cfg.get<string>('securecode.rulesDir', '');
    if (rulesDir.includes('${extensionPath}')) {
      const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
      if (ext) rulesDir = rulesDir.replace('${extensionPath}', ext.extensionPath);
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
    } else if (fileName === 'hardcoded_secret.py') {
      ruleFile = path.join(rulesDir, 'hardcoded_secrets.yaml');
    } else {
      ruleFile = path.join(rulesDir, 'hardcoded_secrets.yaml'); // default
    }

    this.channel.appendLine(`[semgrep] Using rule file: ${ruleFile}`);

    const args = ['--json', '--config', ruleFile, filePath];
    this.channel.appendLine(`[semgrep] Running: ${semgrepPath} ${args.join(' ')}`);

    return new Promise((resolve) => {
      execFile(semgrepPath, args, { cwd: path.dirname(filePath) }, (err, stdout, stderr) => {
        if (err) {
          this.channel.appendLine(`[semgrep] error: ${err.message}`);
        }
        if (stderr) {
          this.channel.appendLine(`[semgrep] stderr: ${stderr.trim()}`);
        }

        try {
          const parsed = JSON.parse(stdout || '{}');
          const results = (parsed.results || []) as any[];
          const findings: SemgrepFinding[] = results.map((r: any) => ({
            check_id: r.check_id,
            path: r.path,
            start: { line: r.start.line, col: r.start.col },
            end: { line: r.end.line, col: r.end.col },
            extra: { message: r.extra?.message || r.check_id, severity: (r.extra?.severity || 'WARNING').toUpperCase() }
          }));

          this.channel.appendLine(`[semgrep] Findings: ${JSON.stringify(findings)}`);
          resolve(findings);
        } catch (e: any) {
          this.channel.appendLine(`[semgrep] failed to parse JSON: ${e.message}`);
          resolve([]);
        }
      });
    });
  }

  // Provide LLM-based quick fixes for security issues
  public provideCodeActions(
    doc: vscode.TextDocument,
    range: vscode.Range,
    diagnostics: vscode.Diagnostic[]
  ): vscode.CodeAction[] {
    const codeActions: vscode.CodeAction[] = [];

    diagnostics.forEach(diag => {
      if (!range.intersection(diag.range)) return;

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