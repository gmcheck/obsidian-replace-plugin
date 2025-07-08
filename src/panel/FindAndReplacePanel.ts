import { App, MarkdownView, Editor, EditorPosition } from "obsidian";

function findAllMatches(
	text: string,
	search: string,
	useRegex: boolean,
): { pos: number; length: number }[] {
	const matches: { pos: number; length: number }[] = [];
	if (!search) return matches;
	if (useRegex) {
		try {
			const re = new RegExp(search, "g");
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				matches.push({ pos: m.index, length: m[0].length });
				if (m.index === re.lastIndex) re.lastIndex++; // 防止死循环
			}
		} catch {
			// 正则无效
		}
	} else {
		let idx = 0;
		while ((idx = text.indexOf(search, idx)) !== -1) {
			matches.push({ pos: idx, length: search.length });
			idx += search.length;
		}
	}
	return matches;
}

export class FindAndReplacePanel {
	app: App;
	panelEl: HTMLDivElement;
	inputEl: HTMLInputElement;
	replaceEl: HTMLInputElement;
	regexEl: HTMLInputElement;
	selectionEl: HTMLInputElement;
	editor: Editor | null = null;
	matches: { pos: number; length: number }[] = [];
	currentIndex: number = -1;
	selectionRange: { from: EditorPosition; to: EditorPosition } | null = null;

	constructor(app: App) {
		this.app = app;
		this.panelEl = document.createElement("div");
		this.panelEl.className = "my-find-panel";
		this.panelEl.innerHTML = `
    <div class="find-row">
        <input type="text" placeholder="Find..." />
    </div>
    <div class="replace-row">
        <input type="text" placeholder="Replace..." />
    </div>
    <div class="options-row">
        <label style="display:flex;align-items:center;gap:2px;">
            <input type="checkbox" class="regex-checkbox" />Regex
        </label>
        <label style="display:flex;align-items:center;gap:2px;">
            <input type="checkbox" class="selection-checkbox" />Selection
        </label>
    </div>
    <div class="buttons-row">
        <button>Find All</button>
        <button>Prev</button>
        <button>Next</button>
        <button>Replace</button>
        <button>Replace All</button>
        <span class="find-count"></span>
        <button class="close-btn" style="margin-left:auto;">×</button>
    </div>
`;
		const inputs = this.panelEl.querySelectorAll("input[type='text']");
		this.inputEl = inputs[0] as HTMLInputElement;
		this.replaceEl = inputs[1] as HTMLInputElement;
		this.regexEl = this.panelEl.querySelector(
			".regex-checkbox",
		) as HTMLInputElement;
		this.selectionEl = this.panelEl.querySelector(
			".selection-checkbox",
		) as HTMLInputElement;

		this.panelEl
			.querySelector(".close-btn")!
			.addEventListener("click", () => this.close());
		this.panelEl
			.querySelector("button:nth-of-type(1)")!
			.addEventListener("click", () => this.findAll());
		this.panelEl
			.querySelector("button:nth-of-type(2)")!
			.addEventListener("click", () => this.findPrev());
		this.panelEl
			.querySelector("button:nth-of-type(3)")!
			.addEventListener("click", () => this.findNext());
		this.panelEl
			.querySelector("button:nth-of-type(4)")!
			.addEventListener("click", () => this.replaceOne());
		this.panelEl
			.querySelector("button:nth-of-type(5)")!
			.addEventListener("click", () => this.replaceAll());

		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") this.findAll();
		});
		this.regexEl.addEventListener("change", () => this.findAll());
		this.selectionEl.addEventListener("change", () => this.findAll());
	}

	open() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		this.editor = view.editor;

		// 插入到页面内容顶部，固定在最上方
		const viewContent = view.containerEl.querySelector(".view-content");
		if (!viewContent) return;
		this.panelEl.style.position = "sticky";
		this.panelEl.style.top = "0";
		this.panelEl.style.left = "0";
		this.panelEl.style.right = "0";
		this.panelEl.style.zIndex = "100";
		viewContent.prepend(this.panelEl);

		this.inputEl.focus();

		// 记录选区
		if (this.editor && this.editor.somethingSelected()) {
			this.selectionRange = {
				from: this.editor.getCursor("from"),
				to: this.editor.getCursor("to"),
			};
			this.selectionEl.checked = true;
		} else {
			this.selectionRange = null;
			this.selectionEl.checked = false;
		}
	}

	close() {
		this.panelEl.remove();
	}

	findAll() {
		if (!this.editor) return;
		const value = this.inputEl.value.trim();
		if (!value) return;
		const useRegex = this.regexEl.checked;
		const onlySelection = this.selectionEl.checked;

		// 实时获取选区
		if (onlySelection) {
			if (this.editor.somethingSelected()) {
				this.selectionRange = {
					from: this.editor.getCursor("from"),
					to: this.editor.getCursor("to"),
				};
			} else {
				this.selectionRange = null;
			}
		}

		let text = this.editor.getValue();
		let offset = 0;
		if (onlySelection && this.selectionRange) {
			const fromOffset = this.editor.posToOffset(
				this.selectionRange.from,
			);
			const toOffset = this.editor.posToOffset(this.selectionRange.to);
			text = text.slice(fromOffset, toOffset);
			offset = fromOffset;
		}
		const matches = findAllMatches(text, value, useRegex).map((m) => ({
			pos: m.pos + offset,
			length: m.length,
		}));
		this.matches = matches;
		this.currentIndex = -1;
		this.updateCount();
		if (matches.length > 0) {
			this.currentIndex = 0;
			this.scrollToMatch();
		}
	}

	findNext() {
		if (!this.editor || this.matches.length === 0) return;
		this.currentIndex = (this.currentIndex + 1) % this.matches.length;
		this.scrollToMatch();
		this.updateCount();
	}

	findPrev() {
		if (!this.editor || this.matches.length === 0) return;
		this.currentIndex =
			(this.currentIndex - 1 + this.matches.length) % this.matches.length;
		this.scrollToMatch();
		this.updateCount();
	}

	replaceOne() {
		if (!this.editor || this.matches.length === 0 || this.currentIndex < 0)
			return;
		const match = this.matches[this.currentIndex];
		const from = this.editor.offsetToPos(match.pos);
		const to = this.editor.offsetToPos(match.pos + match.length);
		this.editor.replaceRange(this.replaceEl.value, from, to);

		// 替换后重新查找所有匹配
		const prevPos = match.pos;
		const prevLen = this.replaceEl.value.length;
		this.findAll();

		// 定位到下一个匹配（即刚刚替换位置之后的第一个匹配）
		const nextIndex = this.matches.findIndex(
			(m) => m.pos >= prevPos + prevLen,
		);
		if (nextIndex !== -1) {
			this.currentIndex = nextIndex;
			this.scrollToMatch();
			this.updateCount();
		} else {
			// 没有下一个匹配，重置
			this.currentIndex = -1;
			this.updateCount();
		}
	}

	replaceAll() {
		if (!this.editor || this.matches.length === 0) return;
		const value = this.inputEl.value.trim();
		const replaceValue = this.replaceEl.value;
		const useRegex = this.regexEl.checked;
		const onlySelection = this.selectionEl.checked;

		// 实时获取选区
		if (onlySelection) {
			if (this.editor.somethingSelected()) {
				this.selectionRange = {
					from: this.editor.getCursor("from"),
					to: this.editor.getCursor("to"),
				};
			} else {
				this.selectionRange = null;
			}
		}

		let text = this.editor.getValue();
		let fromOffset = 0,
			toOffset = text.length;
		if (onlySelection && this.selectionRange) {
			fromOffset = this.editor.posToOffset(this.selectionRange.from);
			toOffset = this.editor.posToOffset(this.selectionRange.to);
		}
		let replaced = 0;
		if (useRegex) {
			const re = new RegExp(value, "g");
			const target = text.slice(fromOffset, toOffset);
			const newText = target.replace(re, (...args) => {
				replaced++;
				return replaceValue;
			});
			text = text.slice(0, fromOffset) + newText + text.slice(toOffset);
		} else {
			const target = text.slice(fromOffset, toOffset);
			const newText = target.split(value).join(replaceValue);
			replaced = (
				target.match(
					new RegExp(
						value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
						"g",
					),
				) || []
			).length;
			text = text.slice(0, fromOffset) + newText + text.slice(toOffset);
		}
		this.editor.setValue(text);
		this.findAll();
	}

	scrollToMatch() {
		if (
			!this.editor ||
			this.currentIndex < 0 ||
			this.currentIndex >= this.matches.length
		)
			return;
		const match = this.matches[this.currentIndex];
		const from = this.editor.offsetToPos(match.pos);
		const to = this.editor.offsetToPos(match.pos + match.length);
		this.editor.setSelection(from, to);
		this.editor.scrollIntoView({ from, to }, true);
		this.editor.focus(); // 关键：让选区高亮
	}

	updateCount() {
		const countEl = this.panelEl.querySelector(".find-count")!;
		if (this.matches.length === 0) {
			countEl.textContent = "No matches";
		} else {
			countEl.textContent = `Match: ${this.currentIndex + 1}/${this.matches.length}`;
		}
	}
}
