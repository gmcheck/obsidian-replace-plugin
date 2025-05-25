import { App, MarkdownView, Modal, Setting, Notice, Editor } from "obsidian";
import type FindReplacePlugin from "main";

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

	private findInEditor(editor: Editor): { pos: number; length: number }[] {
		const content = editor.getValue();
		// console.log("Content being searched:", content); // 添加内容输出
		const matches: { pos: number; length: number }[] = [];
		let match;

		if (this.useRegex) {
			console.log("Creating regex with:", this.searchTerm);
			try {
				const regex = new RegExp(this.searchTerm, "gm"); // 添加多行模式
				// console.log("Regex flags:", regex.flags); // 检查标志

				let lastIndex = 0;
				while ((match = regex.exec(content)) !== null) {
					// console.log(
					// 	"Match found at:",
					// 	match.index,
					// 	"Content:",
					// 	match[0]
					// );
					matches.push({
						pos: match.index,
						length: match[0].length,
					});

					// 防止无限循环
					if (match.index === regex.lastIndex) {
						regex.lastIndex++;
					}
					lastIndex = regex.lastIndex;
				}
				console.log("Total matches:", matches.length);
			} catch (e) {
				console.error("Regex error:", e);
				new Notice("Invalid regular expression: " + e.message);
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

	private scrollToMatch(editor: Editor, pos: number, length: number) {
		try {
			const from = editor.offsetToPos(pos);
			const to = editor.offsetToPos(pos + length);
			editor.setSelection(from, to);
			editor.scrollIntoView({ from, to });
		} catch (error) {
			console.error("Error scrolling to match:", error);
			new Notice("Failed to scroll to the match.");
		}
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
		if (activeView && this.searchTerm) {
			let text = activeView.editor.getValue();

			try {
				if (this.useRegex) {
					text = text.replace(
						new RegExp(this.searchTerm, "g"),
						this.replaceTerm
					);
				} else {
					const escaped = this.searchTerm.replace(
						/[.*+?^${}()|[\]\\]/g,
						"\\$&"
					);
					text = text.replace(
						new RegExp(escaped, "g"),
						this.replaceTerm
					);
				}

				activeView.editor.setValue(text);
				this.plugin.settings.useRegex = this.useRegex;
				this.plugin.saveSettings();
			} catch (e) {
				console.error("Replace error:", e);
			}
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
