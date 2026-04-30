import { defineConfig } from '@vscode/test-cli';
import os from 'os';
import path from 'path';
import fs from 'fs';

const workspaceFolder = path.join(os.tmpdir(), 'vscode-md-test');
fs.mkdirSync(workspaceFolder, { recursive: true });

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder,
});
