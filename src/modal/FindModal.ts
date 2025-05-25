import {
	App,
	MarkdownView,
	Modal,
	Setting,
	Notice,
	Editor,
	EditorPosition,
} from "obsidian";

// import type FindReplacePlugin from "main";

// 在文件顶部添加类型扩展
declare module "obsidian" {
	interface Editor {
		cm: any; // 或更具体的CodeMirror.Editor类型
		containerEl: HTMLElement;
	}
}

// 在文件顶部添加CSS类定义
const modalStyle = `
.find-replace-modal {
    position: absolute;
    min-width: 300px;
    max-width: 80%;
    z-index: 9999;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
.find-replace-modal .modal-title {
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

export class FindModal extends Modal {
	private searchTerm: string = "";
	private useRegex: boolean;
	private matches: { pos: number; length: number }[] = [];
	private currentIndex: number = -1;
	private countSetting: Setting;

	constructor(app: App, private plugin: any) {
		super(app);
		this.useRegex = this.plugin?.settings?.useRegex || false;
	}

	onOpen() {
		// 添加CSS样式
		const styleEl = document.createElement("style");
		styleEl.textContent = modalStyle;
		document.head.appendChild(styleEl);

		const { contentEl } = this;
		contentEl.empty();

		// 添加可拖动标题栏
		const titleEl = contentEl.createDiv({ cls: "modal-title" });
		titleEl.createEl("h2", { text: "Enhanced Find in File" });

		// 创建内容容器
		const bodyEl = contentEl.createDiv({ cls: "modal-content" });

		// 将原有UI元素添加到bodyEl中而不是contentEl
		new Setting(bodyEl)
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

		// 创建按钮容器
		const buttonRow = contentEl.createDiv({ cls: "button-row" });

		// 将查找按钮放在同一行
		new Setting(buttonRow)
			.addButton((btn) =>
				btn.setButtonText("Find All").onClick(() => this.findAll())
			)
			.addButton((btn) =>
				btn.setButtonText("Previous").onClick(() => this.findPrevious())
			)
			.addButton((btn) =>
				btn
					.setButtonText("Next")
					.setCta()
					.onClick(() => this.findNext())
			);

		// 单独一行显示计数
		this.countSetting = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Count: 0").setDisabled(true)
		);

		// 启用模态框拖动
		this.modalEl.addClass("find-replace-modal");
		this.modalEl.style.top = "100px";
		this.modalEl.style.left = "100px";
		this.makeDraggable(titleEl);
	}

	private makeDraggable(handle: HTMLElement) {
		let pos1 = 0,
			pos2 = 0,
			pos3 = 0,
			pos4 = 0;

		handle.onmousedown = (e) => {
			e.preventDefault();
			pos3 = e.clientX;
			pos4 = e.clientY;
			document.onmouseup = closeDragElement;
			document.onmousemove = elementDrag;
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
			document.onmouseup = null;
			document.onmousemove = null;
		};
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
	private scrollToMatch(editor: any, pos: number, length: number) {
		try {
			const from = editor.offsetToPos(pos);
			const to = editor.offsetToPos(pos + length);
			editor.setSelection(from, to); // 设置选中区域
			editor.scrollIntoView({ from, to }); // 滚动到选中区域
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
		this.updateCount(); // 添加这行，每次查找后更新进度
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
		this.updateCount(); // 添加这行，每次查找后更新进度
	}

	onClose() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			// 清除选中状态
			const from = { line: 0, ch: 0 };
			const to = { line: 0, ch: 0 };
			activeView.editor.setSelection(from, to);
		}
		this.contentEl.empty();
	}
}
