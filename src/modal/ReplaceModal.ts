import { App, MarkdownView, Modal, Setting, Notice, Editor } from "obsidian";
import type FindReplacePlugin from "main";
import { findInEditor, scrollToMatch, MatchResult } from "../common/textUtils";
import { BaseModal } from './BaseModal';
import { HighlightManager } from '../common/highlightManager';


// 修改类定义，添加高亮管理属性
// 修改类定义，继承 BaseModal
export class ReplaceModal extends BaseModal {
    plugin: FindReplacePlugin;
    replaceTerm: string = "";
    useRegex: boolean;
    matches: { pos: number; length: number }[] = [];
    currentIndex: number = -1;
    countSetting: Setting;
    highlightManager: HighlightManager; // 添加属性声明
	contentArray: {pos:number, text: string}[] = []; // 用于存储匹配的文本内容

    constructor(app: App, plugin: FindReplacePlugin, searchTerm: string) {
        super(app, plugin?.settings?.useRegex || false, searchTerm);
        this.plugin = plugin;
        this.highlightManager = new HighlightManager(); // 初始化高亮管理类
    }

	onOpen() {
		const styleEl = document.createElement("style");
		styleEl.textContent = this.modalStyle;
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
		this.modalEl.addClass("replace-modal");
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
			console.log("高亮前，清楚之前的高亮");
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
		this.generateContentArray(this.matches, activeView);
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
			new Notice("No matches found");
			return
		}
        this.currentIndex = (this.currentIndex + 1) % this.matches.length;
        const match = this.matches[this.currentIndex];
        if (!match) {
            return;
        }
        // 清除高亮匹配的文本内容，可能多次执行
        if(this.contentArray.length > 0) {
            this.highlightManager.clearHighlights(activeView.editor, this.contentArray);
        }

        const regex = new RegExp(RegExp(this.searchTerm), this.useRegex ? 'm' : '');
        const newContent = activeView.editor.getValue().replace(regex, this.replaceTerm);
		// 先定位，再赋值 editor.setValue()，否则会出现光标位置错误
        this.scrollToMatch(
            activeView.editor,
            match.pos,
            this.replaceTerm.length
        );
		activeView.editor.setValue(newContent);
		// 更新匹配结果和计数
		if(this.currentIndex < 0 || this.currentIndex == this.matches.length -1) {
			console.log("this.currentIndex", this.currentIndex)
			// 先 更新count ，再查询重置matches
			this.updateCount();
			this.matches = this.findAllMatches(activeView.editor);
			if (this.matches.length === 0) {
				new Notice("No matches found");
				return;
			}
		}
        this.updateCount();
    }

    private replaceAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !this.searchTerm.trim()) {
            new Notice("Please enter a search term");
            return;
        }
		if (this.matches.length === 0) {
			new Notice("No matches found");
			return
		}
        this.currentIndex = (this.currentIndex + 1) % this.matches.length;
        const match = this.matches[this.currentIndex];
        if (!match) {
            return;
        }
        // 清除高亮匹配的文本内容，可能多次执行
        if(this.contentArray.length > 0) {
            this.highlightManager.clearHighlights(activeView.editor, this.contentArray);
        }
        let text = activeView.editor.getValue();
        let replacementCount = 0;
        try {
            const regex = new RegExp(this.searchTerm, this.useRegex ? 'gm' : 'g');
            const newContent = text.replace(regex, this.replaceTerm);
            activeView.editor.setValue(newContent);
            replacementCount = (text.match(regex) || []).length;
			console.log("replacementCount", replacementCount)
        } catch (error) {
            new Notice("Invalid regular expression");
        }
		// 记录之前使用的设置，即使用正则
		if (replacementCount > 0) {
			this.plugin.settings.useRegex = this.useRegex;
			this.plugin.saveSettings();
		}
		// 防止先执行 单个替换，再执行全部替换时，显示错误
		this.updateCount(replacementCount == this.matches.length  ? replacementCount : this.matches.length);
		// 重置匹配结果
		this.matches = this.findAllMatches(activeView.editor);
		if(this.matches.length > 0) {
			new Notice("全部替换存在遗漏情况，自动重新查找替换");
			this.replaceAll();
		}

		new Notice(`Replaced ${replacementCount} occurrences`);
        } catch (e: Error) {
            console.error("Replace error:", e);
            new Notice(`Replace error: ${e.message}`);
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

	onClose(): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		super.closeTab(activeView);
	}
}

