import { App, MarkdownView, Setting, Notice, Editor } from "obsidian";
import { BaseModal } from "./BaseModal";
import { scrollToMatch } from "../common/textUtils";

export class FindModal extends BaseModal {
	currentIndex: number = -1;
	countSetting: Setting;
	useSelectedTextFlag: boolean = false;
	lastHighlightedMatches: any[] = [];

	constructor(
		app: App,
		private plugin: any,
		searchTerm: string,
	) {
		super(app, plugin?.settings?.useRegex || false, searchTerm);
	}

	onOpen() {
		// 添加CSS样式
		const styleEl = document.createElement("style");
		styleEl.textContent = this.modalStyle;
		document.head.appendChild(styleEl);
		const { contentEl } = this;
		contentEl.empty();

		// 添加可拖动标题栏
		const titleEl = contentEl.createDiv({ cls: "modal-title" });
		titleEl.createEl("h2", { text: "Find in File" });

		// 创建内容容器
		const bodyEl = contentEl.createDiv({ cls: "modal-content" });

		new Setting(bodyEl)
			.setName("Search Term")
			.addText((text) =>
				text
					.setPlaceholder("Enter search term")
					.onChange((value) => (this.searchTerm = value.trim())),
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

		// 创建按钮容器
		const buttonRow = contentEl.createDiv({ cls: "button-row" });
		new Setting(buttonRow)
			.addButton((btn) =>
				btn.setButtonText("Find All").onClick(() => this.findAll()),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Previous")
					.onClick(() => this.findPrevious()),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Next")
					.setCta()
					.onClick(() => this.findNext()),
			);

		this.countSetting = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Count: 0").setDisabled(true),
		);

		// 启用模态框拖动
		this.modalEl.addClass("find-modal");
		this.modalEl.style.top = "100px";
		this.modalEl.style.left = "100px";
		this.makeDraggable(titleEl);
	}

	protected findAllMatches(editor: Editor) {
		if (this.useSelectedTextFlag) {
			// 只在未设置选区时才设置一次
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
		this.updateCount();
		this.highlightAll(activeView.editor);
		this.lastHighlightedMatches = [...this.matches];
		if (this.matches.length === 0) {
			new Notice("No matches found");
		}
	}

	private findNext() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}
		if (this.matches.length == 0 && this.currentIndex == -1) {
			this.findAll();
		}
		this.currentIndex = (this.currentIndex + 1) % this.matches.length;
		const match = this.matches[this.currentIndex];
		if (!match) return;
		this.scrollToMatch(activeView.editor, match.pos, match.content.length);
		this.updateCount();
	}

	private findPrevious() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}
		if (this.matches.length == 0 && this.currentIndex == -1) {
			this.findAll();
		}
		this.currentIndex =
			(this.currentIndex - 1 + this.matches.length) % this.matches.length;
		const match = this.matches[this.currentIndex];
		this.scrollToMatch(activeView.editor, match.pos, match.content.length);
		this.updateCount();
	}

	private scrollToMatch(editor: Editor, pos: number, length: number) {
		// 可直接用 scrollToMatch 工具函数
		scrollToMatch(editor, pos, length);
	}

	private updateCount(count = this.currentIndex + 1) {
		if (this.countSetting) {
			const countText =
				this.matches.length > 0
					? `Count: ${this.matches.length} (${count}/${this.matches.length})`
					: `Count: ${this.matches.length}`;
			this.countSetting.controlEl
				.querySelector("button")!
				.setText(countText);
		}
	}

	/**
	 * 清除 高亮格式
	 */
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
