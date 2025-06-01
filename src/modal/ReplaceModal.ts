import { App, MarkdownView, Setting, Notice, Editor } from "obsidian";
import { BaseModal } from "./BaseModal";
import { scrollToMatch } from "../common/textUtils";

export class ReplaceModal extends BaseModal {
	currentIndex: number = -1;
	countSetting: Setting;
	useSelectedTextFlag: boolean = false;
	replaceTerm: string = "";
	totalMatches: number = 0;
	lastHighlightedMatches: any[] = [];

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const titleEl = contentEl.createDiv({ cls: "modal-title" });
		titleEl.createEl("h2", { text: "Replace in File" });

		const bodyEl = contentEl.createDiv({ cls: "modal-content" });

		new Setting(bodyEl)
			.setName("Search Term")
			.addText((text) =>
				text
					.setPlaceholder("Enter search term")
					.onChange((value) => (this.searchTerm = value.trim())),
			);

		new Setting(bodyEl)
			.setName("Replace With")
			.addText((text) =>
				text
					.setPlaceholder("Enter replacement")
					.onChange((value) => (this.replaceTerm = value)),
			);

		const optionsRow = contentEl.createDiv({ cls: "options-row" });
		this.useRegex = false;
		this.useSelectedTextFlag = false;

		new Setting(optionsRow)
			.setName("Use Regular Expression")
			.addToggle((toggle) =>
				toggle.setValue(this.useRegex).onChange((value) => {
					this.useRegex = value;
				}),
			);

		new Setting(optionsRow)
			.setName("Use Selected Text")
			.addToggle((toggle) =>
				toggle.setValue(this.useSelectedTextFlag).onChange((value) => {
					this.useSelectedTextFlag = value;
					if (value) {
						this.useSelectedTextRangeOnly();
					} else {
						this.selectedRange = null;
					}
				}),
			);

		const buttonRow = contentEl.createDiv({ cls: "button-row" });
		new Setting(buttonRow)
			.addButton((btn) =>
				btn.setButtonText("Find All").onClick(() => this.findAll()),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Replace Next")
					.setCta()
					.onClick(() => this.replaceNext()),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Replace All")
					.onClick(() => this.replaceAll()),
			);

		this.countSetting = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Progress: 0/0").setDisabled(true),
		);

		this.modalEl.addClass("replace-modal");
		this.modalEl.style.top = "120px";
		this.modalEl.style.left = "120px";
		this.makeDraggable(titleEl);
	}

	protected findAllMatches(editor: Editor) {
		if (this.useSelectedTextFlag) {
			if (!this.selectedRange) {
				this.useSelectedTextRangeOnly();
			}
		} else {
			this.selectedRange = null;
		}
		return super.findAllMatches(editor);
	}

	private findAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice("Please enter a search term");
			return;
		}
		this.clearAllHighlights(activeView.editor, this.lastHighlightedMatches);
		this.matches = this.findAllMatches(activeView.editor);
		this.currentIndex = -1;
		this.totalMatches = this.matches.length;
		this.updateCount(0);
		this.highlightAll(activeView.editor);
		this.lastHighlightedMatches = [...this.matches];
		if (this.matches.length === 0) {
			new Notice("No matches found");
		}
	}

	private replaceNext() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}
		const editor = activeView.editor;

		this.clearAllHighlights(editor, this.lastHighlightedMatches);
		this.matches = this.findAllMatches(editor);

		if (this.matches.length === 0) {
			new Notice("No matches found");
			this.currentIndex = -1;
			this.updateCount(this.totalMatches);
			return;
		}
		if (
			this.currentIndex === -1 ||
			this.currentIndex >= this.matches.length
		) {
			this.currentIndex = 0;
		}
		const match = this.matches[this.currentIndex];
		if (!match) return;

		editor.replaceRange(
			this.replaceTerm,
			editor.offsetToPos(match.pos),
			editor.offsetToPos(match.pos + match.length),
		);

		this.clearAllHighlights(editor, this.lastHighlightedMatches);
		const replacedEnd = match.pos + this.replaceTerm.length;
		this.matches = this.findAllMatches(editor);

		let replacedCount = this.totalMatches - this.matches.length;
		this.currentIndex = this.matches.findIndex((m) => m.pos >= replacedEnd);
		if (this.currentIndex === -1 && this.matches.length > 0)
			this.currentIndex = 0;

		this.updateCount(replacedCount);

		if (this.matches.length > 0 && this.currentIndex !== -1) {
			this.highlightAll(editor);
			this.lastHighlightedMatches = [...this.matches];
			const nextMatch = this.matches[this.currentIndex];
			this.scrollToMatch(editor, nextMatch.pos, nextMatch.length);
		} else {
			this.currentIndex = -1;
			this.updateCount(this.totalMatches);
		}
	}

	private replaceAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}
		const editor = activeView.editor;

		this.clearAllHighlights(editor, this.lastHighlightedMatches);
		this.matches = this.findAllMatches(editor);

		if (this.matches.length === 0) {
			new Notice("No matches found");
			return;
		}

		this.totalMatches = this.matches.length;

		for (let i = this.matches.length - 1; i >= 0; i--) {
			const match = this.matches[i];
			editor.replaceRange(
				this.replaceTerm,
				editor.offsetToPos(match.pos),
				editor.offsetToPos(match.pos + match.length),
			);
		}

		this.clearAllHighlights(editor, this.lastHighlightedMatches);
		this.matches = this.findAllMatches(editor);
		this.currentIndex = -1;
		this.updateCount(this.totalMatches);
		this.highlightAll(editor);
		this.lastHighlightedMatches = [...this.matches];

		new Notice(`Replaced ${this.totalMatches} occurrences`);
	}

	private scrollToMatch(editor: Editor, pos: number, length: number) {
		scrollToMatch(editor, pos, length);
	}

	private updateCount(replacedCount = 0) {
		if (this.countSetting) {
			const countText =
				this.totalMatches > 0
					? `Progress: ${replacedCount}/${this.totalMatches}`
					: `Progress: 0/0`;
			this.countSetting.controlEl
				.querySelector("button")!
				.setText(countText);
		}
	}

	onClose(): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			this.clearAllHighlights(
				activeView.editor,
				this.lastHighlightedMatches,
			);
		}
		super.onClose();
	}
}
