"use strict";
// import * as vscode from 'vscode';
// import { enrichPrompt } from './promptEnricher';
// import { ScanManager } from './scan';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// export function activate(context: vscode.ExtensionContext) {
//   const channel = vscode.window.createOutputChannel('SecureCode Copilot');
//   const diagnostics = vscode.languages.createDiagnosticCollection('securecode-copilot');
//   const scanner = new ScanManager(diagnostics, channel);
//   channel.appendLine('SecureCode Copilot: activated (Step 2 — Semgrep).');
//   // Hooks
//   context.subscriptions.push(
//     vscode.workspace.onDidChangeTextDocument(e => scanner.scheduleScan(e.document, 700)),
//     vscode.workspace.onDidSaveTextDocument(doc => scanner.scheduleScan(doc, 100))
//   );
//   // Command: Enrich Prompt
//   const enrichCmd = vscode.commands.registerCommand('securecode.enrichPrompt', async () => {
//     const editor = vscode.window.activeTextEditor;
//     let raw = '';
//     if (editor && !editor.selection.isEmpty) {
//       raw = editor.document.getText(editor.selection);
//     } else {
//       raw = await vscode.window.showInputBox({
//         prompt: 'Enter your prompt to enrich with security guardrails',
//         ignoreFocusOut: true,
//         placeHolder: 'e.g., Build an Express.js login route with JWT...'
//       }) || '';
//     }
//     if (!raw.trim()) { return; }
//     const enriched = enrichPrompt(raw);
//     const newDoc = await vscode.workspace.openTextDocument({ language: 'markdown', content: enriched });
//     await vscode.window.showTextDocument(newDoc, { preview: false });
//     vscode.window.showInformationMessage('SecureCode Copilot: Prompt enriched.');
//   });
//   context.subscriptions.push(enrichCmd, diagnostics, channel);
//   if (vscode.window.activeTextEditor) {
//     scanner.scheduleScan(vscode.window.activeTextEditor.document, 50);
//   }
// }
// export function deactivate() {}
const vscode = require("vscode");
const promptEnricher_1 = require("./promptEnricher");
const scan_1 = require("./scan");
const semgrep_1 = require("./semgrep"); // Import the SemgrepRunner class for quick fixes
function activate(context) {
    const channel = vscode.window.createOutputChannel('SecureCode Copilot');
    const diagnostics = vscode.languages.createDiagnosticCollection('securecode-copilot');
    const scanner = new scan_1.ScanManager(diagnostics, channel);
    const runner = new semgrep_1.SemgrepRunner(channel); // Initialize SemgrepRunner for quick fixes
    channel.appendLine('SecureCode Copilot: activated (Step 2 — Semgrep).');
    // Hooks
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => scanner.scheduleScan(e.document, 700)), vscode.workspace.onDidSaveTextDocument(doc => scanner.scheduleScan(doc, 100)));
    // Registering Code Action Provider (Quick Fixes)
    // context.subscriptions.push(
    //   vscode.languages.registerCodeActionsProvider('python', {
    //     provideCodeActions: async (doc: vscode.TextDocument, range: vscode.Range) => {
    //       const findings = await runner.scanFile(doc);
    //       return runner.provideCodeActions(doc, range);  // Trigger code actions
    //     }
    //   })
    // );
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('python', {
        provideCodeActions: async (doc, range) => {
            // Get diagnostics for this document
            const docDiagnostics = vscode.languages.getDiagnostics(doc.uri);
            return runner.provideCodeActions(doc, range, docDiagnostics);
        }
    }));
    // Command: Enrich Prompt
    const enrichCmd = vscode.commands.registerCommand('securecode.enrichPrompt', async () => {
        const editor = vscode.window.activeTextEditor;
        let raw = '';
        if (editor && !editor.selection.isEmpty) {
            raw = editor.document.getText(editor.selection);
        }
        else {
            raw = await vscode.window.showInputBox({
                prompt: 'Enter your prompt to enrich with security guardrails',
                ignoreFocusOut: true,
                placeHolder: 'e.g., Build an Express.js login route with JWT...'
            }) || '';
        }
        if (!raw.trim()) {
            return;
        }
        const enriched = (0, promptEnricher_1.enrichPrompt)(raw);
        const newDoc = await vscode.workspace.openTextDocument({ language: 'markdown', content: enriched });
        await vscode.window.showTextDocument(newDoc, { preview: false });
        vscode.window.showInformationMessage('SecureCode Copilot: Prompt enriched.');
    });
    context.subscriptions.push(enrichCmd, diagnostics, channel);
    if (vscode.window.activeTextEditor) {
        scanner.scheduleScan(vscode.window.activeTextEditor.document, 50);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map