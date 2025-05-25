import { App, MarkdownView, Modal, Setting, Notice, Editor } from "obsidian";
import type FindReplacePlugin from "main";
import { findInEditor, scrollToMatch, MatchResult } from "../common/textUtils";

const modalStyle = `
.replace-replace-modal {
    position: absolute;
    min-width: 300px;
    max-width: 80%;
    z-index: 9999;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
.replace-replace-modal .modal-title {
    cursor: move;
    padding: 8px 12px;
    background-color: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
}
.button-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}
.button-row .setting-item {
    flex: 1;
    margin-bottom: 0;
}
.button-row .setting-item-control {
    justify-content: center;
}
`;

export class ReplaceModal extends Modal {
	plugin: FindReplacePlugin;
	searchTerm: string = "";
	replaceTerm: string = "";
	useRegex: boolean;
	matches: { pos: number; length: number }[] = [];
	currentIndex: number = -1;
	countSetting: Setting;

	constructor(app: App, plugin: FindReplacePlugin) {
		super(app);
		this.plugin = plugin;
		this.useRegex = this.plugin.settings.useRegex;
	}

	onOpen() {
		const styleEl = document.createElement("style");
		styleEl.textContent = modalStyle;
		document.head.appendChild(styleEl);

		const { contentEl } = this;
		contentEl.empty();

		// 添加可拖动标题栏
		const titleEl = contentEl.createDiv({ cls: "modal-title" });
		titleEl.createEl("h2", { text: "Replace in File" });

		new Setting(contentEl).setName("Search Term").addText((text) =>
			text.setValue("").onChange((value) => {
				this.searchTerm = value;
				this.matches = [];
				this.currentIndex = -1;
				this.updateCount();
			})
		);

		new Setting(contentEl)
			.setName("Replace With")
			.addText((text) =>
				text
					.setValue("")
					.onChange((value) => (this.replaceTerm = value))
			);

		new Setting(contentEl)
			.setName("Use Regular Expression")
			.addToggle((toggle) =>
				toggle.setValue(this.useRegex).onChange((value) => {
					this.useRegex = value;
					this.matches = [];
					this.currentIndex = -1;
					this.updateCount();
				})
			);

		// 按钮行
		const buttonRow = contentEl.createDiv({ cls: "button-row" });

		new Setting(buttonRow)
			.addButton((btn) =>
				btn.setButtonText("Find All").onClick(() => this.findAll())
			)
			.addButton((btn) =>
				btn
					.setButtonText("Replace Next")
					.setCta()
					.onClick(() => this.replaceNext())
			)
			.addButton((btn) =>
				btn
					.setButtonText("Replace All")
					.onClick(() => this.replaceAll())
			);

		// 计数显示
		this.countSetting = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Count: 0").setDisabled(true)
		);

		// 启用拖动
		this.modalEl.addClass("replace-replace-modal");
		this.modalEl.style.top = "100px";
		this.modalEl.style.left = "100px";
		this.makeDraggable(titleEl);
	}

	private makeDraggable(handle: HTMLElement) {
		let pos1 = 0,
			pos2 = 0,
			pos3 = 0,
			pos4 = 0;

		const dragMouseDown = (e: MouseEvent) => {
			e.preventDefault();
			pos3 = e.clientX;
			pos4 = e.clientY;
			document.addEventListener("mouseup", closeDragElement);
			document.addEventListener("mousemove", elementDrag);
		};

		const elementDrag = (e: MouseEvent) => {
			e.preventDefault();
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;

			this.modalEl.style.top = this.modalEl.offsetTop - pos2 + "px";
			this.modalEl.style.left = this.modalEl.offsetLeft - pos1 + "px";
		};

		const closeDragElement = () => {
			document.removeEventListener("mouseup", closeDragElement);
			document.removeEventListener("mousemove", elementDrag);
		};

		handle.addEventListener("mousedown", dragMouseDown);
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
		}
	}

	private findInEditor(editor: Editor): MatchResult[] {
		return findInEditor(editor, this.searchTerm, this.useRegex);
	}

	private scrollToMatch(editor: Editor, pos: number, length: number) {
		scrollToMatch(editor, pos, length);
	}

	private replaceNext() {
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

		// 执行替换
		const content = activeView.editor.getValue();
		const newContent =
			content.substring(0, match.pos) +
			this.replaceTerm +
			content.substring(match.pos + match.length);

		activeView.editor.setValue(newContent);
		this.scrollToMatch(
			activeView.editor,
			match.pos,
			this.replaceTerm.length
		);
		this.updateCount();
	}

	private updateCount() {
		if (this.countSetting) {
			const countText =
				this.matches.length > 0
					? `Count: ${this.matches.length} (${
							this.currentIndex + 1
					  }/${this.matches.length})`
					: `Count: ${this.matches.length}`;
			this.countSetting.controlEl
				.querySelector("button")!
				.setText(countText);
		}
	}

	private replaceAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}

		let text = activeView.editor.getValue();
		let replacementCount = 0;

		try {
			if (this.useRegex) {
				// console.log("Using regex with pattern:", this.searchTerm);
				// 添加多行模式标志'm'
				const regex = new RegExp(this.searchTerm, "gm");
				// console.log("Regex flags:", regex.flags);

				// 先查找所有匹配项
				const matches = [...text.matchAll(regex)];
				console.log("Matches found:", matches);
				replacementCount = matches.length;

				// 执行替换
				text = text.replace(regex, (match) => {
					// 自定义替换逻辑
					if (match.startsWith("g") && match.length > 1) {
						return "o" + match.substring(1);
					}
					return this.replaceTerm;
				});
				// console.log("Text after replacement:", text);
			} else {
				const escaped = this.searchTerm.replace(
					/[.*+?^${}()|[\]\\]/g,
					"\\$&"
				);
				const regex = new RegExp(escaped, "g");
				replacementCount = (text.match(regex) || []).length;
				text = text.replace(regex, this.replaceTerm);
			}

			if (replacementCount > 0) {
				activeView.editor.setValue(text);
				this.plugin.settings.useRegex = this.useRegex;
				this.plugin.saveSettings();
			}

			// 更新匹配结果和计数
			this.matches = this.findInEditor(activeView.editor);
			this.updateCount();

			new Notice(`Replaced ${replacementCount} occurrences`);
		} catch (e) {
			console.error("Replace error:", e);
			new Notice(`Replace error: ${e.message}`);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
