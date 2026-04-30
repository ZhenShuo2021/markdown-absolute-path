import * as vscode from 'vscode';
import {
	resolveVirtualPath,
	splitHref,
	LINK_INLINE_ANGLE_RE,
	LINK_INLINE_BARE_RE,
	LINK_QUOTED_RE,
	LINK_REFDEF_RE,
} from './helper';

const out = vscode.window.createOutputChannel('markdownAbsPath: followLink');

export interface ExtractedHref {
	href: string;
	index: number;
	length: number;
}

export function extractHrefsFromSource(source: string): ExtractedHref[] {
	const results: ExtractedHref[] = [];

	for (const re of [
		new RegExp(LINK_INLINE_ANGLE_RE.source, 'g'),
		new RegExp(LINK_INLINE_BARE_RE.source, 'g'),
	]) {
		let m: RegExpExecArray | null;
		while ((m = re.exec(source)) !== null) {
			const href = m.groups!.href;
			if (!href?.startsWith('/')) continue;
			const index = m.index + m[0].indexOf(href);
			results.push({ href, index, length: href.length });
		}
	}

	{
		const re = new RegExp(LINK_QUOTED_RE.source, 'g');
		let m: RegExpExecArray | null;
		while ((m = re.exec(source)) !== null) {
			const href = m.groups!.sq ?? m.groups!.dq;
			if (!href) continue;
			const index = m.index + m[0].indexOf(href);
			results.push({ href, index, length: href.length });
		}
	}

	{
		const re = new RegExp(LINK_REFDEF_RE.source, 'gm');
		let m: RegExpExecArray | null;
		while ((m = re.exec(source)) !== null) {
			const href = m[1] ?? m[2];
			if (!href?.startsWith('/')) continue;
			const index = m.index + m[0].indexOf(href);
			results.push({ href, index, length: href.length });
		}
	}

	return results;
}

export const linkProvider: vscode.DocumentLinkProvider = {
	provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
		out.appendLine(`\n── provideDocumentLinks: ${document.fileName} ──`);

		const hrefs = extractHrefsFromSource(document.getText());
		const links: vscode.DocumentLink[] = [];
		for (const { href, index, length } of hrefs) {
			const range = new vscode.Range(
				document.positionAt(index),
				document.positionAt(index + length)
			);
			const link = new vscode.DocumentLink(range);
			// Stash href in tooltip so resolveDocumentLink can access it
			// without needing the document again.
			link.tooltip = href;
			links.push(link);
			out.appendLine(`[provide] href="${href}" index=${index}`);
		}
		return links;
	},

	async resolveDocumentLink(link: vscode.DocumentLink): Promise<vscode.DocumentLink | undefined> {
		const href = link.tooltip;
		if (!href) return undefined;
		const { filePath, fragment } = splitHref(href);
		const resolved = await resolveVirtualPath(filePath);
		if (!resolved) {
			return undefined;
		}
		link.target = fragment ? resolved.with({ fragment }) : resolved;
		link.tooltip = undefined; // restore to default (no tooltip)
		out.appendLine(`[resolve] href="${href}" target="${link.target}"`);
		return link;
	},
};
