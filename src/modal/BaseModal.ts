import { App, Modal, Setting, Notice, Editor, MarkdownView } from "obsidian";
import { findInEditor, scrollToMatch, MatchResult } from "../common/textUtils";
import { HighlightManager } from '../common/highlightManager'; // 假设存在高亮管理类

export class BaseModal extends Modal {
    searchTerm: string; // 搜索词
    useRegex: boolean;
    matches: { pos: number; length: number }[] = [];
    highlightManager: HighlightManager; 
	contentArray: {pos:number, text: string}[] = []; // 用于存储匹配的文本内容
    modalStyle = `
    .find-modal {
        position: absolute;
        min-width: 300px;
        max-width: 80%;
        z-index: 9999;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    .find-modal .modal-title {
        cursor: move;
        padding: 8px 12px;
        background-color: var(--background-primary);
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .replace-modal {
        position: absolute;
        min-width: 300px;
        max-width: 80%;
        z-index: 9999;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    .replace-modal .modal-title {
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

    constructor(app: App, useRegex: boolean, searchTerm:string) {
        super(app);
        this.useRegex = useRegex;
        this.searchTerm = searchTerm;
        this.searchTerm = this.searchTerm.trim(); // 去除开头和结尾的空白字符
        this.highlightManager = new HighlightManager(); // 初始化高亮管理类
    }

    protected makeDraggable(handle: HTMLElement) {
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

    protected findAllMatches(editor: Editor) {
        if (!editor) {
            new Notice("Please enter a search term");
            return [];
        }
        this.matches = findInEditor(editor, this.searchTerm, this.useRegex);
        if (this.matches.length === 0) {
            new Notice('No matches found');
            return [];
        }
        return this.matches;
    }

    closeTab(activeView:MarkdownView | null) {
        if (activeView) {
            // 清除之前的高亮
            if(this.contentArray.length > 0) {
                this.highlightManager.clearHighlights(activeView.editor, this.contentArray);
            }
            // 初始化 this.contentArray
            this.contentArray = [];
        }
    }
    
	/**
	 * 生成需要高亮的内容数组。
	 * 赋值给 this.contentArray。
	 * @param matches - 匹配项数组。
	 * @param activeView - 当前活动的 MarkdownView。
	 * 
	 **/
	protected generateContentArray(matches: any[], activeView: any){
		this.contentArray = matches.map(({ pos, length }) => {
			const text = activeView.editor.getRange({
				line: activeView.editor.offsetToPos(pos).line,
				ch: activeView.editor.offsetToPos(pos).ch
			}, {
				line: activeView.editor.offsetToPos(pos + length).line,
				ch: activeView.editor.offsetToPos(pos + length).ch
			});
			return { pos, text };
		});
	}
}