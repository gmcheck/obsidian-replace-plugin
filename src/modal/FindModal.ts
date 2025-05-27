import {
	App,
	MarkdownView,
	Modal,
	Setting,
	Notice,
	Editor,
	EditorPosition,
} from "obsidian";

import { findInEditor, scrollToMatch, MatchResult } from "../common/textUtils";
import { HighlightManager } from '../common/highlightManager'; // 假设存在高亮管理类
import { BaseModal } from './BaseModal';

export class FindModal extends BaseModal {
	searchTerm: string = "";
	useRegex: boolean;
	matches: { pos: number; length: number }[] = [];
	currentIndex: number = -1;
	countSetting: Setting;
	highlightManager: HighlightManager; // 添加属性声明
	contentArray: {pos:number, text: string}[] = []; // 用于存储匹配的文本内容

	constructor(app: App, private plugin: any, searchTerm: string) {
		super(app, plugin?.settings?.useRegex || false, searchTerm);
		this.highlightManager = new HighlightManager(); // 初始化高亮管理类
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

		// 将原有UI元素添加到bodyEl中而不是contentEl
		new Setting(bodyEl)
			.setName("Search Term")
			.addText((text) =>
				text
					.setPlaceholder("Enter search term")
					.onChange((value) => (this.searchTerm = value.trim()))
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
		this.modalEl.addClass("find-modal");
		this.modalEl.style.top = "100px";
		this.modalEl.style.left = "100px";
		this.makeDraggable(titleEl);
	}

	private findAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice("Please enter a search term");
			return;
		}
		// 清除高亮匹配的文本内容，可能多次执行
		if(this.contentArray.length > 0) {
			this.highlightManager.clearHighlights(activeView.editor, this.contentArray);
		}

		this.matches = super.findAllMatches(activeView.editor);
		this.currentIndex = -1; // 重置索引为-1，以便下一次从第一个匹配项开始search
        this.updateCount();
		this.generateContentArray(this.matches, activeView);
		if (this.matches.length === 0) {
			new Notice("No matches found");
			return
		}

		this.highlightManager.addHighlight(activeView.editor, this.contentArray);

		// 高亮后重新计算匹配项
		this.matches = super.findAllMatches(activeView.editor);
		console.log("this.new.matches", this.matches)
		this.generateContentArray(this.matches, activeView);
	}

	private findNext() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}
		// 获取所有匹配内容
		if(this.matches.length == 0 && this.currentIndex == -1) {
			this.findAll()
		}
		console.log("this.currentIndex", this.currentIndex)
		this.currentIndex = (this.currentIndex + 1) % this.matches.length;
		const match = this.contentArray[this.currentIndex];
		if (!match) {
            return;
        }
		console.log("matches", this.matches)
		console.log("this.currentIndex", this.currentIndex)
		console.log("match", match)
		this.scrollToMatch(activeView.editor, match.pos, match.text.length);
		this.updateCount();
	}

	private findPrevious() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView ||!this.searchTerm.trim()) {
			new Notice("Please enter a search term");
			return;
		}
		// 获取所有匹配内容
		if(this.matches.length == 0 && this.currentIndex == -1) {
			this.findAll()
		}
		this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
		const match = this.contentArray[this.currentIndex];
		this.scrollToMatch(activeView.editor, match.pos, match.text.length);
		this.updateCount();
	}

	private scrollToMatch(editor: Editor, pos: number, length: number) {
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
		super.closeTab(activeView);
	}
	
}
