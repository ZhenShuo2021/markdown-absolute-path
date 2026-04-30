import * as vscode from 'vscode';
import * as path from 'path';

export let rootDirs: string[] = [];

/**
 * Matches inline links/images with angle-bracket href (spaces allowed):
 * `[text](<path>)` / `![alt](<path> "title")`
 * Named group `href`: the path inside angle brackets.
 */
export const LINK_INLINE_ANGLE_RE =
	/!?\[[^\]]*\]\(<(?<href>[^>]+)>(?:\s+"[^"]*"|\s+'[^']*'|\s+\([^)]*\))?\)/g;

/**
 * Matches inline links/images with bare href (no spaces):
 * `[text](path)` / `![alt](path "title")`
 * Named group `href`: the bare path.
 */
export const LINK_INLINE_BARE_RE =
	/!?\[[^\]]*\]\((?<href>[^)<>\s"']+)(?:\s+"[^"]*"|\s+'[^']*'|\s+\([^)]*\))?\)/g;

/**
 * Matches a reference definition line: `[id]: path` or `[id]: <path>`
 * Angle-bracket form (group 1) allows spaces; bare form (group 2) does not.
 */
export const LINK_REFDEF_RE = /^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|([^>\s"']+))/gm;

/**
 * Matches single- or double-quoted absolute paths:
 * `'/path'` / `"/path"`
 * Named group `sq`: single-quoted href. Named group `dq`: double-quoted href.
 */
export const LINK_QUOTED_RE = /(?:'(?<sq>\/[^']+)'|"(?<dq>\/[^"]+)")/g;

/**
 * Detects whether the cursor (linePrefix) is inside a closed inline link href.
 * Matches `[text](<href` or `[text](href` — requires the suffix to contain `)`.
 * Capture group 1: the href text typed so far.
 */
export const AUTOCOMPLETE_INLINE_RE = /!?\[[^\]]*\]\(<?(\/?[^)>]*)$/;

/**
 * Detects whether the cursor (linePrefix) is on a reference definition line.
 * Matches `[id]: href` — href extends to end of line.
 * Capture group 1: the href text typed so far.
 */
export const AUTOCOMPLETE_REFDEF_RE = /^\s*\[[^\]]+\]:\s*<?(\S*)$/;

/**
 * Detects an unclosed quoted path: `'/path` or `"/path`.
 * Matches the last opening quote followed by the path typed so far.
 * Capture group 1: the path typed so far.
 */
export const AUTOCOMPLETE_QUOTED_RE = /['"](\/[^'"]*)/;

export function loadConfig(): void {
	const cfg = vscode.workspace.getConfiguration('markdownAbsPath');
	rootDirs = [...new Set(cfg.get<string[]>('rootDirs') ?? [])];
}

/**
 * Resolves a virtual absolute path (e.g. "/posts/hello.md") to a workspace URI.
 *
 * Only paths that (a) start with `/`, (b) map into a configured rootDir,
 * AND (c) exist on disk are ever resolved. Anything else returns undefined.
 */
export async function resolveVirtualPath(virtualPath: string): Promise<vscode.Uri | undefined> {
	if (!virtualPath.startsWith('/')) {
		return undefined;
	}

	const ws = vscode.workspace.workspaceFolders?.[0];
	if (!ws) {
		return undefined;
	}

	let decoded: string;
	try {
		decoded = decodeURIComponent(virtualPath);
	} catch {
		decoded = virtualPath;
	}

	const relative = decoded.replace(/^\/+/, '');

	for (const dir of rootDirs) {
		const rootUri = vscode.Uri.joinPath(ws.uri, dir);
		const resolved = vscode.Uri.joinPath(rootUri, relative);

		// Prevent path traversal: resolved path must stay inside rootDir.
		// Append path.sep so "/foo/bar" does not accidentally match "/foo/barbaz".
		if (
			!resolved.fsPath.startsWith(rootUri.fsPath + path.sep) &&
			resolved.fsPath !== rootUri.fsPath
		) {
			continue;
		}

		try {
			await vscode.workspace.fs.stat(resolved);
			return resolved;
		} catch {
			// Does not exist under this rootDir, try next.
		}
	}
	return undefined;
}

/**
 * Split an href into its path component and an optional fragment.
 * e.g. "/foo/bar.md#heading" → { filePath: "/foo/bar.md", fragment: "heading" }
 * Query strings are stripped and not forwarded to VS Code.
 */
export function splitHref(raw: string): { filePath: string; fragment: string } {
	const hashIdx = raw.indexOf('#');
	const queryIdx = raw.indexOf('?');
	const splitAt = Math.min(
		hashIdx === -1 ? Infinity : hashIdx,
		queryIdx === -1 ? Infinity : queryIdx
	);

	if (splitAt === Infinity) {
		return { filePath: raw, fragment: '' };
	}
	const fragment = hashIdx !== -1 ? raw.slice(hashIdx + 1) : '';
	return { filePath: raw.slice(0, splitAt), fragment };
}
