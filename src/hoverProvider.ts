import * as vscode from 'vscode';
import * as path from 'path';
import { resolveVirtualPath, splitHref } from './helper';
import { extractHrefsFromSource } from './followLink';

const IMAGE_EXTS = new Set([
	'.apng',
	'.avif',
	'.bmp',
	'.gif',
	'.ico',
	'.jpeg',
	'.jpg',
	'.png',
	'.svg',
	'.tif',
	'.tiff',
	'.webp',
]);

const TEXT_EXTS = new Set(['.md', '.mdx', '.markdown', '.txt', '.text']);

async function readTextPreview(uri: vscode.Uri): Promise<string | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		return Buffer.from(bytes).toString('utf8');
	} catch {
		return undefined;
	}
}

export const hoverProvider: vscode.HoverProvider = {
	async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position
	): Promise<vscode.Hover | undefined> {
		const offset = document.offsetAt(position);
		const hit = extractHrefsFromSource(document.getText()).find(
			(l) => offset >= l.index && offset < l.index + l.length
		);
		if (!hit) {
			return undefined;
		}

		const { filePath, fragment } = splitHref(hit.href);
		const resolved = await resolveVirtualPath(filePath);
		if (!resolved) {
			return undefined;
		}

		const ext = path.extname(resolved.fsPath).toLowerCase();
		const md = new vscode.MarkdownString();
		md.isTrusted = false;

		if (IMAGE_EXTS.has(ext)) {
			const dir = vscode.Uri.file(path.dirname(resolved.fsPath) + path.sep);
			const fileName = path.basename(resolved.fsPath);
			md.supportHtml = true;
			md.baseUri = dir;
			md.appendMarkdown(
				`<img src="${encodeURIComponent(fileName)}" width="300" alt="${fileName}">`
			);
		} else if (TEXT_EXTS.has(ext)) {
			const content = await readTextPreview(resolved);
			if (!content) {
				return undefined;
			}
			md.appendMarkdown(content);
		} else {
			md.appendText(resolved.fsPath);
		}

		return new vscode.Hover(md);
	},
};
