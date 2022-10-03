import * as vscode from "vscode";

var modifiedClipboardList: ModifiedClipboard[] = [];

export function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration ("modified-clipboard");
	var maximumClips = config.get ("maximumClips", 200);

	vscode.workspace.onDidChangeConfiguration (event => {
		let affected = event.affectsConfiguration ("modified-clipboard.maximumClips");
		if (affected) {
			maximumClips = config.get ("maximumClips", 200);
			if (modifiedClipboardList.length > maximumClips && maximumClips > 0) {
				modifiedClipboardList = modifiedClipboardList.reverse ().slice (0, maximumClips).reverse ();
			}
		}
	});

	function createTreeView () {
		vscode.window.createTreeView ("modified-clipboard.history",  {
			treeDataProvider: new ModifiedClipboardProvider ()
		});
	};

	async function addItem() {
		let copied = await vscode.env.clipboard.readText ();
		copied = copied.replace (/\n/gi, "↵");
		const item = new ModifiedClipboard (copied, vscode.TreeItemCollapsibleState.None);
		if (modifiedClipboardList.find (c => c.label === copied)) {
			modifiedClipboardList = modifiedClipboardList.filter (c => c.label !== copied);
		}
		modifiedClipboardList.push (item);

		if (maximumClips > 0) {
			modifiedClipboardList = modifiedClipboardList.reverse ().slice (0, maximumClips).reverse ();
		}
	};
	
	let copy = vscode.commands.registerCommand ("modified-clipboard.copy", () => {
		vscode.commands.executeCommand ("editor.action.clipboardCopyAction").then (() => {
			addItem ().then (() => {
				vscode.window.setStatusBarMessage ("Copy!");
				createTreeView ();
			});
		});
	});

	let cut = vscode.commands.registerCommand ("modified-clipboard.cut", () => {
		vscode.commands.executeCommand ("editor.action.clipboardCutAction").then (() => {
			addItem ().then (() => {
				vscode.window.setStatusBarMessage ("Cut!");
				createTreeView ();
			});
		});
	});

	let pasteFromCilipboard = vscode.commands.registerCommand ("modified-clipboard.pasteFromClipboard", () => {
		vscode.window.setStatusBarMessage ("paste From Clipboard!");
		createTreeView ();
		
		const items = modifiedClipboardList.map (c => {
			return {
				label: c.label,
				description: ""
			};
		}).reverse ();

		vscode.window.showQuickPick (items).then (item => {
			const label = ((item as vscode.QuickPickItem).label as string).replace (/↵/gi, "\n");
			vscode.env.clipboard.writeText (label).then (() => {
				vscode.window.setStatusBarMessage ("copied in history!");
				if (!!vscode.window.activeTextEditor) {
					const editor = vscode.window.activeTextEditor;
					editor.edit ((textInserter => textInserter.delete (editor.selection))).then (() => {
						editor.edit ((textInserter => textInserter.insert (editor.selection.start, label)));
					});
				}
			});
		});
	});

	let historyCopy = vscode.commands.registerCommand ("modified-clipboard.history.copy", (item: vscode.TreeItem) => {
		const label = (item.label as string).replace (/↵/gi, "\n");
		vscode.env.clipboard.writeText (label).then (() => {
			vscode.window.setStatusBarMessage ("Copied in history!");
		});
	});

	let historyRemove = vscode.commands.registerCommand ("modified-clipboard.history.remove", (item: vscode.TreeItem) => {
		modifiedClipboardList = modifiedClipboardList.filter (c => c.label !== item.label);
		createTreeView ();
		vscode.window.setStatusBarMessage ("removed in history!");
	});

	let historyModify = vscode.commands.registerCommand ('modified-clipboard.history.modify', (item: vscode.TreeItem) => {
		const org = (item as ModifiedClipboard);
		vscode.window.showInputBox ({value: item.label?.toString ()}).then (val => {
			var idx = modifiedClipboardList.indexOf (org);
			if (!!val) {
				modifiedClipboardList[idx] = new ModifiedClipboard (val, vscode.TreeItemCollapsibleState.None);
				vscode.window.setStatusBarMessage ("modify in history!");
				createTreeView ();
			} else {
				vscode.window.showInformationMessage (idx.toString ());
				vscode.window.setStatusBarMessage ("modify in history Fail!");
			}
		});
	})

	context.subscriptions.push (copy);
	context.subscriptions.push (cut);
	context.subscriptions.push (pasteFromCilipboard);
	context.subscriptions.push (historyModify);
	context.subscriptions.push (historyCopy);
	context.subscriptions.push (historyRemove);
}

export function deactivate() {}

class ModifiedClipboard extends vscode.TreeItem {
	constructor (
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super (label, collapsibleState);
		this.contextValue = "historyItem";
	}
}

export class ModifiedClipboardProvider implements vscode.TreeDataProvider <ModifiedClipboard> {
	constructor () {}
	getTreeItem(element: ModifiedClipboard): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ModifiedClipboard): Thenable<ModifiedClipboard[]> {
		const temp = Object.assign([], modifiedClipboardList);
		return Promise.resolve(temp.reverse ());
	}
}