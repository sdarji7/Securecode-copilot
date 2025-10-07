"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFix = generateFix;
const child_process_1 = require("child_process");
const path = require("path");
async function generateFix(code, issueType, extensionPath) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ code, issueType });
        // ✅ Use absolute path to Python script
        const scriptPath = path.join(extensionPath, 'llm_fix.py');
        console.log(`[llmFixer] Using Python script at: ${scriptPath}`);
        const pyProcess = (0, child_process_1.spawn)('python3', [scriptPath, payload]);
        let result = '';
        let error = '';
        const timeout = setTimeout(() => {
            pyProcess.kill();
            reject(new Error('LLM generation timed out after 60 seconds'));
        }, 60000);
        pyProcess.stdout.on('data', (data) => {
            result += data.toString();
        });
        pyProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error('[llmFixer] stderr:', data.toString());
        });
        pyProcess.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve(result.trim());
            }
            else {
                reject(new Error(`Python process exited with code ${code}: ${error}`));
            }
        });
        pyProcess.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to spawn Python process: ${err.message}`));
        });
    });
}
//# sourceMappingURL=llmFixer.js.map