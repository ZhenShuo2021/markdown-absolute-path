import * as vscode from 'vscode';
import { loadConfig } from './helper';
import { linkProvider } from './followLink';
import { completionProvider } from './autocomplete';
import { hoverProvider } from './hoverProvider';

export function activate(context: vscode.ExtensionContext): void {
	loadConfig();

	// Debounce config changes: rapid saves can fire
	// onDidChangeConfiguration many times in quick succession.
	let configDebounce: ReturnType<typeof setTimeout> | undefined;

	let hoverRegistration: vscode.Disposable | undefined;

	const updateHoverProvider = () => {
		const cfg = vscode.workspace.getConfiguration('markdownAbsPath');
		const isEnabled = cfg.get<boolean>('hover.enable', false);

		if (isEnabled && !hoverRegistration) {
			hoverRegistration = vscode.languages.registerHoverProvider(
				{ language: 'markdown', scheme: 'file' },
				hoverProvider
			);
			context.subscriptions.push(hoverRegistration);
		} else if (!isEnabled && hoverRegistration) {
			hoverRegistration.dispose();
			hoverRegistration = undefined;
		}
	};

	updateHoverProvider();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (!e.affectsConfiguration('markdownAbsPath')) {
				return;
			}
			clearTimeout(configDebounce);
			configDebounce = setTimeout(() => {
				loadConfig();
				updateHoverProvider();
			}, 300);
		})
	);

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			{ language: 'markdown', scheme: 'file' },
			completionProvider,
			'/',
			'#'
		)
	);

	context.subscriptions.push(
		vscode.languages.registerDocumentLinkProvider(
			{ language: 'markdown', scheme: 'file' },
			linkProvider
		)
	);
}

export function deactivate(): void {}
