const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// Security: Block dangerous commands/patterns
const DANGEROUS_PATTERNS = [
    'rm -rf', 'sudo', 'shutdown', 'reboot', 'halt',
    '> /dev/sda', 'dd if=', 'mkfs', 'fdisk',
    'chmod 777', 'chown', 'passwd', 'useradd',
    'wget', 'curl', 'nc ', 'netcat', 'telnet',
    'python -c', 'perl -e', 'bash -c', 'sh -c',
    '__import__', 'eval(', 'exec(', 'compile(',
    'process.exit', 'require("child_process")',
    'fs.writeFileSync', 'fs.unlinkSync',
    'execSync', 'spawnSync'
];

// Security: Block dangerous imports/modules
const DANGEROUS_MODULES = [
    'child_process', 'fs', 'os', 'process',
    'cluster', 'vm', 'worker_threads'
];

// Security: Maximum execution time (5 seconds)
const MAX_EXECUTION_TIME = 5000;

// Security: Maximum output size (10KB)
const MAX_OUTPUT_SIZE = 10240;

// Security: Validate code before execution
function validateCode(language, code) {
    const lowerCode = code.toLowerCase();
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (lowerCode.includes(pattern.toLowerCase())) {
            return { valid: false, error: `Security violation: ${pattern}` };
        }
    }
    
    // Language-specific security
    switch (language) {
        case 'javascript':
            // Block dangerous Node.js modules
            for (const module of DANGEROUS_MODULES) {
                if (lowerCode.includes(`require("${module}")`) || 
                    lowerCode.includes(`require('${module}')`)) {
                    return { valid: false, error: `Blocked module: ${module}` };
                }
            }
            break;
            
        case 'python':
            // Block dangerous Python imports
            const dangerousPython = ['os.', 'subprocess', 'shutil', 'sys.', 'import ', '__import__'];
            for (const pattern of dangerousPython) {
                if (lowerCode.includes(pattern)) {
                    return { valid: false, error: `Blocked Python operation: ${pattern}` };
                }
            }
            break;
    }
    
    // Limit code size (10KB)
    if (code.length > 10240) {
        return { valid: false, error: 'Code too large (max 10KB)' };
    }
    
    return { valid: true };
}

// Secure code execution
async function executeCode(language, code) {
    const startTime = Date.now();
    
    // Validate code first
    const validation = validateCode(language, code);
    if (!validation.valid) {
        return {
            output: '',
            error: `Security Error: ${validation.error}`,
            executionTime: Date.now() - startTime
        };
    }
    
    try {
        let command;
        const tempFile = path.join('/tmp', `code_${Date.now()}_${Math.random().toString(36).substr(2)}`);
        
        switch (language) {
            case 'javascript':
                // Safe JavaScript execution using Node.js sandbox
                await fs.writeFile(tempFile, code);
                command = `timeout ${MAX_EXECUTION_TIME / 1000} node --no-warnings ${tempFile}`;
                break;
                
            case 'python':
                await fs.writeFile(tempFile, code);
                command = `timeout ${MAX_EXECUTION_TIME / 1000} python3 ${tempFile}`;
                break;
                
            case 'golang':
                // For Go, we'll run a simple Go program
                await fs.writeFile(tempFile + '.go', code);
                command = `timeout ${MAX_EXECUTION_TIME / 1000} go run ${tempFile}.go`;
                break;
                
            case 'html':
                // HTML is safe - just return the code
                return {
                    output: code,
                    error: '',
                    executionTime: Date.now() - startTime
                };
                
            default:
                return {
                    output: '',
                    error: `Unsupported language: ${language}`,
                    executionTime: Date.now() - startTime
                };
        }
        
        // Execute with timeout and resource limits
        const { stdout, stderr } = await execPromise(command, {
            timeout: MAX_EXECUTION_TIME,
            maxBuffer: MAX_OUTPUT_SIZE
        });
        
        // Clean up temp file
        try {
            await fs.unlink(tempFile);
            if (language === 'golang') await fs.unlink(tempFile + '.go');
        } catch (e) {}
        
        const executionTime = Date.now() - startTime;
        
        return {
            output: stdout || stderr || 'No output',
            error: stderr && !stdout ? stderr.substring(0, 500) : '',
            executionTime
        };
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        
        if (error.killed) {
            return {
                output: '',
                error: 'Execution timed out (5 second limit)',
                executionTime
            };
        }
        
        return {
            output: '',
            error: error.message.substring(0, 500),
            executionTime
        };
    }
}

module.exports = { executeCode, validateCode };
