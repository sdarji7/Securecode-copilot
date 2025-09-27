// import * as vscode from 'vscode';
// import { execFile } from 'child_process';
// import * as path from 'path';

// export type SemgrepFinding = {
//   check_id: string;
//   path: string;
//   start: { line: number, col: number };
//   end: { line: number, col: number };
//   extra: { message: string; severity: 'INFO'|'WARNING'|'ERROR' };
// };

// export class SemgrepRunner {
//   private channel: vscode.OutputChannel;
//   constructor(channel: vscode.OutputChannel) { this.channel = channel; }

//   public async scanFile(doc: vscode.TextDocument): Promise<SemgrepFinding[]> {
//     const cfg = vscode.workspace.getConfiguration();
//     const semgrepPath = cfg.get<string>('securecode.semgrepPath', 'semgrep');
//     let rulesDir = cfg.get<string>('securecode.rulesDir', '');
//     if (rulesDir.includes('${extensionPath}')) {
//       const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
//       if (ext) rulesDir = rulesDir.replace('${extensionPath}', ext.extensionPath);
//     }
//     if (!rulesDir) {
//       const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
//       rulesDir = ext ? path.join(ext.extensionPath, 'semgrep-rules') : 'semgrep-rules';
//     }
//     const filePath = doc.uri.fsPath;
//     return new Promise((resolve) => {
//       const args = ['--json', '--config', rulesDir, filePath];
//       execFile(semgrepPath, args, { cwd: path.dirname(filePath) }, (err, stdout, stderr) => {
//         if (err) this.channel.appendLine(`[semgrep] error: ${err.message}`);
//         if (stderr) this.channel.appendLine(`[semgrep] ${stderr.trim()}`);
//         try {
//           const parsed = JSON.parse(stdout || '{}');
//           const results = (parsed.results || []) as any[];
//           const findings: SemgrepFinding[] = results.map((r: any) => ({
//             check_id: r.check_id,
//             path: r.path,
//             start: { line: r.start.line, col: r.start.col },
//             end: { line: r.end.line, col: r.end.col },
//             extra: { message: r.extra?.message || r.check_id, severity: (r.extra?.severity || 'WARNING').toUpperCase() }
//           }));
//           resolve(findings);
//         } catch (e: any) {
//           this.channel.appendLine(`[semgrep] failed to parse JSON: ${e.message}`);
//           resolve([]);
//         }
//       });
//     });
//   }
// }

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
    
    // Log the Semgrep path being used
    this.channel.appendLine(`[semgrep] Using Semgrep at: ${semgrepPath}`);
    console.log(`[semgrep] Using Semgrep at: ${semgrepPath}`);

    let rulesDir = cfg.get<string>('securecode.rulesDir', '');
    
    // Check if we need to use the extension path for the rules directory
    if (rulesDir.includes('${extensionPath}')) {
      const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
      if (ext) rulesDir = rulesDir.replace('${extensionPath}', ext.extensionPath);
    }

    if (!rulesDir) {
      const ext = vscode.extensions.getExtension('your-name.securecode-copilot');
      rulesDir = ext ? path.join(ext.extensionPath, 'semgrep-rules') : 'semgrep-rules';
    }

    const filePath = doc.uri.fsPath;

    // Ensure the full rule file path is used (e.g., missing-auth-check.yml)
    const ruleFile = path.join(rulesDir, 'missing_auth_check.yaml'); // Using specific rule file

    // Log the full rule file path being used
    this.channel.appendLine(`[semgrep] Using rule file: ${ruleFile}`);
    console.log(`[semgrep] Using rule file: ${ruleFile}`);

    // Log the full command to be run
    const args = ['--json', '--config', ruleFile, filePath];
    this.channel.appendLine(`[semgrep] Running: ${semgrepPath} ${args.join(' ')}`);
    console.log(`[semgrep] Running: ${semgrepPath} ${args.join(' ')}`);

    return new Promise((resolve) => {
      execFile(semgrepPath, args, { cwd: path.dirname(filePath) }, (err, stdout, stderr) => {
        if (err) {
          this.channel.appendLine(`[semgrep] error: ${err.message}`);
          console.log(`[semgrep] error: ${err.message}`);
        }
        if (stderr) {
          this.channel.appendLine(`[semgrep] stderr: ${stderr.trim()}`);
          console.log(`[semgrep] stderr: ${stderr.trim()}`);
        }

        // Parse and log the Semgrep result
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

          console.log("[semgrep] Findings:", findings);
          this.channel.appendLine(`[semgrep] Findings: ${JSON.stringify(findings)}`);
          resolve(findings);
        } catch (e: any) {
          this.channel.appendLine(`[semgrep] failed to parse JSON: ${e.message}`);
          console.log(`[semgrep] failed to parse JSON: ${e.message}`);
          resolve([]);
        }
      });
    });
  }

  // Add Code Action (Quick Fixes) for hardcoded secrets
  // public provideCodeActions(doc: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
  //   const codeActions: vscode.CodeAction[] = [];

  //   // Hardcoded secret detection fix
  //   const action = new vscode.CodeAction('Replace with process.env.MY_SECRET', vscode.CodeActionKind.QuickFix);
  //   action.edit = new vscode.WorkspaceEdit();
    
  //   // Get the text of the line with the hardcoded secret
  //   const lineText = doc.getText(new vscode.Range(range.start, range.end));
    
  //   // If it’s a hardcoded secret, suggest replacing it
  //   if (lineText.includes('Bearer') || lineText.includes('API_KEY')) {
  //     action.edit.replace(doc.uri, range, 'process.env.MY_SECRET');
  //     codeActions.push(action);
  //   }

  //   // Missing authorization check fix
  //   const authAction = new vscode.CodeAction('Add @login_required', vscode.CodeActionKind.QuickFix);
  //   authAction.edit = new vscode.WorkspaceEdit();
    
  //   // For missing auth checks in Flask routes
  //   if (lineText.includes('@app.route') && !lineText.includes('@login_required')) {
  //     const authDecorator = '@login_required\n';
  //     const position = new vscode.Position(0, 0); // Add to the top of the function
  //     authAction.edit.insert(doc.uri, position, authDecorator);
  //     codeActions.push(authAction);
  //   }

  //   return codeActions;
  // }
  public provideCodeActions(doc: vscode.TextDocument, range: vscode.Range, diagnostics: vscode.Diagnostic[]): vscode.CodeAction[] {
      const codeActions: vscode.CodeAction[] = [];

      diagnostics.forEach(diag => {
          if (!range.intersection(diag.range)) return;

          // Hardcoded secret fix
          if (diag.message.includes('hardcoded') || diag.message.includes('API_KEY') || diag.message.includes('Bearer')) {
              const action = new vscode.CodeAction('Replace with process.env.MY_SECRET', vscode.CodeActionKind.QuickFix);
              action.edit = new vscode.WorkspaceEdit();
              action.edit.replace(doc.uri, diag.range, 'process.env.MY_SECRET');
              codeActions.push(action);
          }

          // Missing authorization fix
          if (diag.message.includes('authorization') && doc.getText(diag.range).includes('@app.route')) {
              const action = new vscode.CodeAction('Add @login_required', vscode.CodeActionKind.QuickFix);
              action.edit = new vscode.WorkspaceEdit();
              action.edit.insert(doc.uri, new vscode.Position(diag.range.start.line, 0), '@login_required\n');
              codeActions.push(action);
          }
      });

      return codeActions;
  }
}

