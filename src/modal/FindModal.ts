import {
	App,
	MarkdownView,
	Modal,
	Setting,
	Notice,
	Editor,
	EditorPosition,
} from "obsidian";
import * as Prism from "prismjs";
import "prismjs/themes/prism.css"; // 引入 Prism.js 的样式

// import type FindReplacePlugin from "main";

export class FindModal extends Modal {
	private searchTerm: string = "";
	private useRegex: boolean;
	private matches: { pos: number; length: number }[] = [];
	private currentIndex: number = -1;
	private countSetting: Setting;
	private currentHighlight: HTMLElement | null = null; // 修改类型，用于跟踪当前高亮元素
	private allHighlights: HTMLElement[] = []; // 修改类型，用于跟踪所有匹配的高亮元素

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

	private findInEditor(editor: Editor): { pos: number; length: number }[] {
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

	private highlightAllMatches(editor: Editor) {
		// 移除旧的高亮
		this.removeAllHighlights(editor);
		const content = editor.getValue();
		const codeEl = document.createElement("code");
		codeEl.textContent = content;

		this.matches.forEach((match) => {
			const highlightedElement = this.createHighlightElement(
				content,
				match.pos,
				match.length
			);
			this.allHighlights.push(highlightedElement);
		});
	}

	private createHighlightElement(
		content: string,
		pos: number,
		length: number
	): HTMLElement {
		const before = content.slice(0, pos);
		const matchText = content.slice(pos, pos + length);
		const after = content.slice(pos + length);

		const wrapper = document.createElement("span");
		const codeEl = document.createElement("code");
		codeEl.innerHTML =
			before +
			`<span class="prism-highlight">${matchText}</span>` +
			after;
		wrapper.appendChild(codeEl);

		// 使用 Prism.js 高亮代码
		const codeElement = wrapper.querySelector("code");
		if (codeElement) {
			Prism.highlightElement(codeElement);
		}

		return wrapper;
	}

	private removeAllHighlights(editor: Editor) {
		this.allHighlights.forEach((highlight) => {
			highlight.remove();
		});
		this.allHighlights = [];
	}

	private highlightCurrentMatch(editor: Editor) {
		if (this.currentIndex < 0 || this.currentIndex >= this.matches.length)
			return;

		const match = this.matches[this.currentIndex];
		// 移除旧的当前高亮
		if (this.currentHighlight) {
			this.currentHighlight.remove();
		}
		// 添加新的当前高亮
		this.currentHighlight = this.createHighlightElement(
			editor.getValue(),
			match.pos,
			match.length
		);
		this.scrollToMatch(editor, match.pos, match.length);
	}

	private scrollToMatch(editor: any, pos: number, length: number) {
		try {
			const from = editor.offsetToPos(pos);
			const to = editor.offsetToPos(pos + length);
			// 移除 at 属性，直接传入 from 和 to
			editor.scrollIntoView({ from, to });
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
			this.removeAllHighlights(activeView.editor);
			if (this.currentHighlight) {
				this.currentHighlight.remove();
			}
		}
		this.contentEl.empty();
	}
}
