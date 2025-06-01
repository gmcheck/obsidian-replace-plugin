import { App, Modal, Setting, Notice, Editor, MarkdownView } from "obsidian";
import { findInEditor, scrollToMatch, MatchResult } from "../common/textUtils";
import { HighlightManager } from "../common/highlightManager";

export class BaseModal extends Modal {
	searchTerm: string;
	useRegex: boolean;
	matches: MatchResult[] = [];
	lastHighlightedMatches: MatchResult[] = []; // 新增
	highlightManager: HighlightManager;
	selectedRange: { from: any; to: any } | null = null;
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

	constructor(app: App, useRegex: boolean, searchTerm: string) {
		super(app);
		this.useRegex = useRegex;
		this.searchTerm = searchTerm.trim();
		this.highlightManager = new HighlightManager();
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

	/**
	 * 获取选中文本并填入搜索框，同时记录选区范围
	 */
	protected useSelectedText(inputSelector = 'input[type="text"]') {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return;
		const selection = activeView.editor.getSelection();
		if (selection) {
			this.searchTerm = selection;
			const input = this.containerEl.querySelector(inputSelector);
			if (input) (input as HTMLInputElement).value = selection;
			this.selectedRange = {
				from: activeView.editor.getCursor("from"),
				to: activeView.editor.getCursor("to"),
			};
		} else {
			this.selectedRange = null;
		}
	}

	/**
	 * 只记录选区范围，不修改 searchTerm
	 */
	protected useSelectedTextRangeOnly() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return;
		const selection = activeView.editor.getSelection();
		if (selection) {
			this.selectedRange = {
				from: activeView.editor.getCursor("from"),
				to: activeView.editor.getCursor("to"),
			};
		} else {
			this.selectedRange = null;
		}
	}

	/**
	 * 查找所有匹配项，仅在选区查找（如有选区），并为每个 MatchResult 添加 content 字段
	 */
	protected findAllMatches(editor: Editor): MatchResult[] {
		if (!editor) {
			new Notice("Please enter a search term");
			return [];
		}
		let matches: MatchResult[];
		if (this.selectedRange) {
			const fromOffset = editor.posToOffset(this.selectedRange.from);
			const toOffset = editor.posToOffset(this.selectedRange.to);
			const content = editor.getValue().slice(fromOffset, toOffset);
			matches = findInEditor(
				{
					...editor,
					getValue: () => content,
				} as Editor,
				this.searchTerm,
				this.useRegex,
			).map((m) => ({
				...m,
				pos: m.pos + fromOffset,
				content: content.slice(m.pos, m.pos + m.length),
			}));
		} else {
			const fullContent = editor.getValue();
			matches = findInEditor(editor, this.searchTerm, this.useRegex).map(
				(m) => ({
					...m,
					content: fullContent.slice(m.pos, m.pos + m.length),
				}),
			);
		}
		this.matches = matches;
		if (this.matches.length === 0) {
			new Notice("No matches found");
			return [];
		}
		return this.matches;
	}

	/**
	 * 高亮所有匹配项，并记录本轮高亮
	 */
	highlightAll(editor: Editor) {
		if (this.matches.length > 0) {
			this.highlightManager.addHighlight(
				editor,
				this.matches.map((m) => ({
					pos: m.pos,
					length: m.length,
					content: m.content,
				})),
			);
			this.lastHighlightedMatches = [...this.matches]; // 记录本轮高亮
		}
	}

	/**
	 * 清除所有高亮（只清除本轮高亮）
	 */
	clearAllHighlights(editor: Editor, matches?: MatchResult[]) {
		const toClear = matches ?? this.lastHighlightedMatches;
		if (toClear && toClear.length > 0) {
			this.highlightManager.clearHighlights(
				editor,
				toClear.map((m) => ({
					pos: m.pos,
					length: m.length,
					content: m.content,
				})),
			);
		}
	}

	/**
	 * 关闭时清除高亮
	 */
	closeTab(activeView: MarkdownView | null) {
		if (activeView) {
			this.clearAllHighlights(
				activeView.editor,
				this.lastHighlightedMatches,
			);
			this.matches = [];
			this.lastHighlightedMatches = [];
		}
	}
}
