import * as vscode from 'vscode';
import {
	rootDirs,
	splitHref,
	AUTOCOMPLETE_INLINE_RE,
	AUTOCOMPLETE_REFDEF_RE,
	AUTOCOMPLETE_QUOTED_RE,
} from './helper';

const TTL = 3000; // cache (ms)
const CACHE_SIZE = 5000; // cache entries

const cache = new Map<string, { data: string[] | [string, vscode.FileType][]; ts: number }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit && Date.now() - hit.ts < TTL) return hit.data as T;
	const data = await fn();
	if (cache.size > CACHE_SIZE) cache.clear();
	cache.set(key, { data: data as string[], ts: Date.now() });
	return data;
}

const IGNORED_NAMES = new Set([
	'.DS_Store',
	'Thumbs.db',
	'desktop.ini',
	'.git',
	'.svn',
	'.hg',
	'node_modules',
	'.vscode',
]);

function isIgnored(name: string): boolean {
	return IGNORED_NAMES.has(name) || name.startsWith('._');
}

export const completionProvider: vscode.CompletionItemProvider = {
	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position
	): Promise<vscode.CompletionItem[]> {
		const line = document.lineAt(position).text;
		const linePrefix = line.slice(0, position.character);
		const lineSuffix = line.slice(position.character);

		const inlineMatch = AUTOCOMPLETE_INLINE_RE.exec(linePrefix);
		const refDefMatch = AUTOCOMPLETE_REFDEF_RE.exec(linePrefix);
		const quotedMatch = AUTOCOMPLETE_QUOTED_RE.exec(linePrefix);

		let raw: string;
		if (inlineMatch && lineSuffix.match(/^[^)]*>/)) {
			// angle-bracket inline: `[text](<href|>)`
			raw = inlineMatch[1];
		} else if (inlineMatch && lineSuffix.includes(')')) {
			// plain inline: `[text](href|)`
			raw = inlineMatch[1];
		} else if (refDefMatch) {
			raw = refDefMatch[1];
		} else if (quotedMatch) {
			// unclosed quoted path: `'/path` or `"/path`
			raw = quotedMatch[1];
		} else {
			return [];
		}

		// ── Path completion ──────────────────────────────────────────────────────
		const { filePath: typed } = splitHref(raw);
		if (!typed.startsWith('/')) {
			return [];
		}

		const lastSlash = typed.lastIndexOf('/');
		const virtualDir = typed.slice(0, lastSlash);
		const partial = typed.slice(lastSlash + 1).toLowerCase();

		const ws = vscode.workspace.workspaceFolders?.[0];
		if (!ws) {
			return [];
		}

		const relativeDir = virtualDir.replace(/^\/+/, '');

		interface Entry {
			name: string;
			type: vscode.FileType;
			rootDir: string;
		}
		const entries: Entry[] = [];

		for (const dir of rootDirs) {
			const rootUri = vscode.Uri.joinPath(ws.uri, dir);
			const candidateUri = relativeDir ? vscode.Uri.joinPath(rootUri, relativeDir) : rootUri;

			if (!candidateUri.fsPath.startsWith(rootUri.fsPath)) {
				continue;
			}

			let dirEntries: [string, vscode.FileType][];
			try {
				dirEntries = await cached(candidateUri.toString(), () =>
					Promise.resolve(vscode.workspace.fs.readDirectory(candidateUri))
				);
			} catch {
				continue;
			}

			for (const [name, type] of dirEntries) {
				if (isIgnored(name)) continue;
				if (partial && !name.toLowerCase().startsWith(partial)) continue;
				entries.push({ name, type, rootDir: dir });
			}
		}

		const nameCount = new Map<string, number>();
		for (const { name } of entries) {
			nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
		}

		const items: vscode.CompletionItem[] = [];
		for (const { name, type, rootDir } of entries) {
			const kind =
				type === vscode.FileType.Directory
					? vscode.CompletionItemKind.Folder
					: vscode.CompletionItemKind.File;

			const item = new vscode.CompletionItem(name, kind);
			item.insertText = type === vscode.FileType.Directory ? name + '/' : name;

			if (type === vscode.FileType.Directory) {
				item.command = { command: 'editor.action.triggerSuggest', title: '' };
			}

			if ((nameCount.get(name) ?? 0) > 1) {
				item.detail = rootDir;
			}

			items.push(item);
		}

		return items;
	},
};
