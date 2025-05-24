import {
	App,
	MarkdownView,
	Modal,
	Setting,
	Notice,
	Editor,
	EditorPosition,
} from "obsidian";
import type FindReplacePlugin from "main";

export class FindModal extends Modal {
	private searchTerm: string = "";
	private useRegex: boolean;
	private matches: { pos: number; length: number }[] = [];
	private currentIndex: number = -1;
	private countSetting: Setting;
	private currentHighlight: { clear: () => void } | null = null;
	private allHighlights: { clear: () => void }[] = [];

	constructor(app: App, private plugin: FindReplacePlugin) {
		super(app);
		this.useRegex = this.plugin?.settings?.useRegex || false;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Enhanced Find in File" });

		new Setting(contentEl)
			.setName("Search Term")
			.addText((text) =>
				text
					.setPlaceholder("Enter search term")
					.onChange((value) => (this.searchTerm = value))
			);

		new Setting(contentEl)
			.setName("Use Regular Expression")
			.addToggle((toggle) =>
				toggle
					.setValue(this.useRegex)
					.onChange((value) => (this.useRegex = value))
			);

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Find All").onClick(() => this.findAll())
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Next")
				.setCta()
				.onClick(() => this.findNext())
		);

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Previous").onClick(() => this.findPrevious())
		);

		this.countSetting = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Count: 0").setDisabled(true)
		);
	}

	private updateCount() {
		if (this.countSetting && this.countSetting.controlEl) {
			const button = this.countSetting.controlEl.querySelector("button");
			if (button) {
				button.setText(`Count: ${this.matches.length}`);
			}
		}
	}
	private findAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}

		this.matches = this.findInEditor(activeView.editor);
		this.currentIndex = -1;
		this.updateCount();

		if (this.matches.length === 0) {
			new Notice("No matches found");
		} else {
			this.highlightAllMatches(activeView.editor);
			this.findNext();
		}
	}

	private findInEditor(editor: Editor): { pos: number; length: number }[] {
		const content = editor.getValue();
		const matches: { pos: number; length: number }[] = [];
		let match;

		if (this.useRegex) {
			try {
				const regex = new RegExp(this.searchTerm, "g");
				while ((match = regex.exec(content)) !== null) {
					matches.push({
						pos: match.index,
						length: match[0].length,
					});
				}
			} catch (error) {
				new Notice("Invalid regular expression");
				console.error("Invalid regex:", error);
				return [];
			}
		} else {
			let pos = 0;
			while ((pos = content.indexOf(this.searchTerm, pos)) !== -1) {
				matches.push({
					pos: pos,
					length: this.searchTerm.length,
				});
				pos += this.searchTerm.length;
			}
		}
		return matches;
	}

	private scrollToMatch(editor: Editor, pos: number, length: number) {
		try {
			const from = editor.offsetToPos(pos);
			const to = editor.offsetToPos(pos + length);
			// 先滚动到位置
			editor.scrollIntoView({ from, to });
			// 然后计算居中位置
			const cursor = editor.getCursor();
			editor.setCursor(from);
			editor.scrollIntoView({ from: cursor, to: cursor }, true);
		} catch (error) {
			console.error("Error scrolling to match:", error);
			new Notice("Failed to scroll to the match.");
		}
	}

	private findNext() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}

		if (this.matches.length === 0) {
			this.matches = this.findInEditor(activeView.editor);
			this.updateCount();
		}

		if (this.matches.length === 0) {
			new Notice("No matches found");
			return;
		}

		this.currentIndex = (this.currentIndex + 1) % this.matches.length;
		const match = this.matches[this.currentIndex];
		this.scrollToMatch(activeView.editor, match.pos, match.length);
		this.highlightCurrentMatch(activeView.editor);
	}

	private findPrevious() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}

		if (this.matches.length === 0) {
			this.matches = this.findInEditor(activeView.editor);
			this.updateCount();
		}

		if (this.matches.length === 0) {
			new Notice("No matches found");
			return;
		}

		this.currentIndex =
			(this.currentIndex - 1 + this.matches.length) % this.matches.length;
		const match = this.matches[this.currentIndex];
		this.scrollToMatch(activeView.editor, match.pos, match.length);
		this.highlightCurrentMatch(activeView.editor);
	}

	private addCurrentHighlightDecoration(
		editor: Editor,
		pos: number,
		length: number
	): { clear: () => void } {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);
		const mark = (editor as any).getDoc().markText(from, to, {
			className: "find-current-highlight",
			clearWhenEmpty: false,
		});
		return {
			clear: () => mark.clear(),
		};
	}

	private addHighlightDecoration(
		editor: Editor,
		pos: number,
		length: number
	): { clear: () => void } {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);
		const mark = (editor as any).getDoc().markText(from, to, {
			className: "find-match-highlight",
			clearWhenEmpty: false,
		});
		return {
			clear: () => mark.clear(),
		};
	}

	private highlightAllMatches(editor: Editor) {
		this.allHighlights.forEach((h) => h.clear());
		this.allHighlights = [];

		this.matches.forEach((match) => {
			const decoration = this.addHighlightDecoration(
				editor,
				match.pos,
				match.length
			);
			this.allHighlights.push(decoration);
		});
	}

	private highlightCurrentMatch(editor: Editor) {
		if (this.currentHighlight) {
			this.currentHighlight.clear();
		}
	}

	onClose() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			this.allHighlights.forEach((decoration) => decoration.clear());
			if (this.currentHighlight) {
				this.currentHighlight.clear();
			}
		}
		this.contentEl.empty();
	}
}
