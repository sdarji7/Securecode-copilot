import * as vscode from 'vscode';
import { enrichPrompt } from './promptEnricher';
import { ScanManager } from './scan';
import { SemgrepRunner } from './semgrep';
import { generateFix } from './llmFixer';

export function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel('SecureCode Copilot');
  channel.show(); // Show output channel for debugging
  
  const diagnostics = vscode.languages.createDiagnosticCollection('securecode-copilot');
  const scanner = new ScanManager(diagnostics, channel);
  const runner = new SemgrepRunner(channel);

  channel.appendLine('=== SecureCode Copilot: Activation Started ===');

  // ✅ STEP 1: Register LLM Fix Command FIRST
  channel.appendLine('Step 1: Registering LLM fix command...');
  
  const llmFixCmd = vscode.commands.registerCommand(
    'securecode.applyLlmFix',
    async (uri: vscode.Uri, range: vscode.Range, issueType: string) => {
      channel.appendLine('🤖 LLM Fix Command Triggered!');
      channel.appendLine(`  URI: ${uri.toString()}`);
      channel.appendLine(`  Range: Line ${range.start.line + 1}, Col ${range.start.character} to Line ${range.end.line + 1}, Col ${range.end.character}`);
      channel.appendLine(`  Issue Type: ${issueType}`);

      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        
        // For authorization issues, get broader context (include function definition)
        let codeSnippet: string;
        let replaceRange: vscode.Range;
        
        if (issueType.toLowerCase().includes('authorization') || issueType.toLowerCase().includes('auth')) {
          // Expand range to include the entire function for auth issues
          const startLine = range.start.line;
          
          // Find the start of the decorator chain (include all decorators above @app.route)
          let decoratorStart = startLine;
          for (let i = startLine - 1; i >= 0; i--) {
            const lineText = doc.lineAt(i).text.trim();
            if (lineText.startsWith('@') || lineText === '') {
              decoratorStart = i;
            } else {
              break;
            }
          }
          
          // Find the end of the function (next function or end of file)
          let functionEnd = range.end.line;
          for (let i = range.end.line + 1; i < doc.lineCount; i++) {
            const lineText = doc.lineAt(i).text;
            if (lineText.trim() === '' || lineText.match(/^def\s+\w+/) || lineText.match(/^@\w+/)) {
              break;
            }
            functionEnd = i;
          }
          
          replaceRange = new vscode.Range(
            new vscode.Position(decoratorStart, 0),
            new vscode.Position(functionEnd, doc.lineAt(functionEnd).text.length)
          );
          codeSnippet = doc.getText(replaceRange);
        } else {
          // For other issues, use the exact range
          codeSnippet = doc.getText(range);
          replaceRange = range;
        }
        
        channel.appendLine(`  Code to fix (${codeSnippet.length} chars):`);
        channel.appendLine(codeSnippet);

        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Generating secure code with AI...",
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0 });
          
          channel.appendLine('  Calling LLM to generate fix...');
          channel.appendLine(`  Extension path: ${context.extensionPath}`);
          
          const fixedCode = await generateFix(codeSnippet, issueType, context.extensionPath);
          
          progress.report({ increment: 50 });
          channel.appendLine(`  Fixed Code Generated (${fixedCode.length} chars):`);
          channel.appendLine(fixedCode);

          const edit = new vscode.WorkspaceEdit();
          edit.replace(uri, replaceRange, fixedCode);
          const applied = await vscode.workspace.applyEdit(edit);
          
          progress.report({ increment: 100 });

          if (applied) {
            channel.appendLine('  ✅ Fix applied successfully!');
            vscode.window.showInformationMessage('✅ AI-generated fix applied!');

            // Clear diagnostics first, then rescan
            diagnostics.delete(doc.uri);
            
            // Wait a bit before rescanning to allow the edit to complete
            setTimeout(() => {
              scanner.scheduleScan(doc, 0);
            }, 500);
          } 
          else {
            channel.appendLine('  ❌ Failed to apply edit');
            vscode.window.showErrorMessage('Failed to apply fix');
          }
        });

      } catch (error: any) {
        channel.appendLine(`  ❌ Error: ${error.message}`);
        channel.appendLine(`  Stack: ${error.stack}`);
        vscode.window.showErrorMessage(`LLM Fix failed: ${error.message}`);
      }
    }
  );
  
  context.subscriptions.push(llmFixCmd);
  channel.appendLine('✅ Step 1 Complete: LLM command registered');

  // Verify command registration
  vscode.commands.getCommands(true).then(commands => {
    const exists = commands.includes('securecode.applyLlmFix');
    channel.appendLine(`Command 'securecode.applyLlmFix' registered: ${exists}`);
  });

  // ✅ STEP 2: Register Code Action Provider
  channel.appendLine('Step 2: Registering code action provider...');
  
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    'python',
    {
      provideCodeActions: (doc: vscode.TextDocument, range: vscode.Range) => {
        channel.appendLine('🔍 Code actions requested for range');
        const docDiagnostics = vscode.languages.getDiagnostics(doc.uri);
        channel.appendLine(`  Found ${docDiagnostics.length} diagnostics`);
        
        const actions = runner.provideCodeActions(doc, range, docDiagnostics);
        channel.appendLine(`  Returning ${actions.length} actions`);
        
        return actions;
      }
    },
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  
  context.subscriptions.push(codeActionProvider);
  channel.appendLine('✅ Step 2 Complete: Code action provider registered');

  // ✅ STEP 3: Register document event hooks
  channel.appendLine('Step 3: Registering document hooks...');
  
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => scanner.scheduleScan(doc, 100)),
    vscode.workspace.onDidChangeTextDocument(e => scanner.scheduleScan(e.document, 300)),
    vscode.workspace.onDidSaveTextDocument(doc => scanner.scheduleScan(doc, 50))
  );
  
  channel.appendLine('✅ Step 3 Complete: Document hooks registered');

  // ✅ STEP 4: Register refresh command
  channel.appendLine('Step 4: Registering refresh command...');
  
  const refreshCmd = vscode.commands.registerCommand('securecode.refreshSemgrep', async (uri: vscode.Uri) => {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      scanner.scheduleScan(doc, 0);
    } catch (e: any) {
      channel.appendLine(`[refreshSemgrep] failed: ${e.message}`);
    }
  });
  
  context.subscriptions.push(refreshCmd);
  channel.appendLine('✅ Step 4 Complete: Refresh command registered');

  // ✅ STEP 5: Register enrich prompt command
  const enrichCmd = vscode.commands.registerCommand('securecode.enrichPrompt', async () => {
    const editor = vscode.window.activeTextEditor;
    let raw = '';
    if (editor && !editor.selection.isEmpty) {
      raw = editor.document.getText(editor.selection);
    } else {
      raw = await vscode.window.showInputBox({
        prompt: 'Enter your prompt to enrich with security guardrails',
        ignoreFocusOut: true,
        placeHolder: 'e.g., Build an Express.js login route with JWT...'
      }) || '';
    }
    if (!raw.trim()) { return; }
    const enriched = enrichPrompt(raw);
    const newDoc = await vscode.workspace.openTextDocument({ language: 'markdown', content: enriched });
    await vscode.window.showTextDocument(newDoc, { preview: false });
    vscode.window.showInformationMessage('SecureCode Copilot: Prompt enriched.');
  });

  context.subscriptions.push(enrichCmd, diagnostics, channel);

  // ✅ STEP 6: Scan active editor
  if (vscode.window.activeTextEditor) {
    channel.appendLine('Scanning active editor...');
    scanner.scheduleScan(vscode.window.activeTextEditor.document, 50);
  }

  channel.appendLine('=== Activation Complete ===');
}

export function deactivate() {}