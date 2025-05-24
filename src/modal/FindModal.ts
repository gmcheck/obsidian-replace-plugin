import { App, MarkdownView, Modal, Setting, Notice, Editor } from "obsidian";
import type FindReplacePlugin from "main";

export class FindModal extends Modal {
	private searchTerm: string = "";
	private useRegex: boolean;
	private matches: { pos: number; length: number }[] = [];
	private currentIndex: number = -1;
	private countSetting: Setting;
	private currentHighlight: any; // 新增：跟踪当前高亮装饰

	constructor(app: App, private plugin: any) {
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

	private findInEditor(editor: any): { pos: number; length: number }[] {
		const content = editor.getValue();
		const matches: { pos: number; length: number }[] = [];
		let match;

		if (this.useRegex) {
			const regex = new RegExp(this.searchTerm, "g");
			while ((match = regex.exec(content)) !== null) {
				matches.push({
					pos: match.index,
					length: match[0].length,
				});
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
		this.highlightCurrentMatch(activeView.editor);
	}

	private highlightAllMatches(editor: any) {
		editor.clearHighlights(); // 仅在查找全部时清除旧高亮
		this.matches.forEach((match) => {
			this.addHighlightDecoration(editor, match.pos, match.length);
		});
	}

	private highlightCurrentMatch(editor: any) {
		if (this.currentIndex < 0 || this.currentIndex >= this.matches.length)
			return;

		const match = this.matches[this.currentIndex];
		// 移除旧的当前高亮装饰
		if (this.currentHighlight) {
			editor.removeHighlighter(this.currentHighlight);
		}
		// 添加新的当前高亮（不清除其他匹配高亮）
		this.currentHighlight = this.addCurrentHighlightDecoration(
			editor,
			match.pos,
			match.length
		);
		this.scrollToMatch(editor, match.pos, match.length);
	}

	private scrollToMatch(editor: any, pos: number, length: number) {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);
		// 修正参数格式为对象形式，确保正确滚动定位
		editor.scrollIntoView({ from, to }, { at: "center" });
	}

	private addCurrentHighlightDecoration(
		editor: any,
		pos: number,
		length: number
	) {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);
		// 返回高亮装饰以便后续管理
		return editor.addHighlighter({
			from,
			to,
			class: "find-current-highlight",
		});
	}

	private addHighlightDecoration(editor: any, pos: number, length: number) {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);

		editor.addHighlighter({
			from,
			to,
			class: "find-match-highlight",
		});
	}

	private updateCount() {
		if (this.countSetting) {
			this.countSetting.controlEl
				.querySelector("button")!
				.setText(`Count: ${this.matches.length}`);
		}
	}

	onClose() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			activeView.editor.clearHighlights();
		}
		this.contentEl.empty();
	}
}
