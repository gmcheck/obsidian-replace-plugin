import { promises as fs } from "fs";
import * as path from "path";
import {
	Plugin,
	App,
	Editor,
	MarkdownView,
	Modal,
	Setting,
	PluginSettingTab,
} from "obsidian";

import { FindModal } from "src/modal/FindModal";
import { ReplaceModal } from "src/modal/ReplaceModal";
import { FindReplaceSettingTab } from "src/tab/FindReplaceSettingTab";

import "src/modal/findmodal.css";

// // 添加 Plugin 类的类型声明
// declare module "obsidian" {
// 	interface Plugin {
// 		addStyleSheet(css: string): void;
// 		loadCssFile(css: string): void;
// 	}
// }

interface FindReplaceSettings {
	useRegex: boolean;
}

const DEFAULT_SETTINGS: FindReplaceSettings = {
	useRegex: false,
};

export default class FindReplacePlugin extends Plugin {
	settings: FindReplaceSettings;
	currentSearchTerm: string = "";
	currentMatches: number[] = [];
	currentMatchIndex: number = -1;
	// 将 styleElement 属性声明移到类作用域内
	styleElement: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		const style = document.createElement("style");
		style.id = "find-replace-plugin-styles";
		style.textContent = `
			.cm-line .search-highlight {
				background-color: yellow !important;
				color: black !important;
				padding: 0 2px;
				border-radius: 2px;
				display: inline !important;
				position: relative;
				z-index: 9999;
			}
		`;
		document.head.appendChild(style);

		// 添加调试输出
		console.log(
			"样式已加载:",
			document.getElementById("find-replace-plugin-styles") !== null
		);

		this.register(() => style.remove());

		this.addCommand({
			id: "find-in-current-file",
			name: "Find in Current File",
			hotkeys: [{ modifiers: ["Mod"], key: "f" }],
			callback: () => new FindModal(this.app, this).open(),
		});

		this.addCommand({
			id: "replace-in-current-file",
			name: "Replace in Current File",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "f" }],
			callback: () => new ReplaceModal(this.app, this).open(),
		});

		this.addSettingTab(new FindReplaceSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	findInEditor(
		editor: Editor,
		searchTerm: string,
		useRegex: boolean
	): number[] {
		const content = editor.getValue();
		const matches: number[] = [];
		let match;

		try {
			const regex = useRegex
				? new RegExp(searchTerm, "g")
				: new RegExp(
						searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
						"g"
				  );

			while ((match = regex.exec(content)) !== null) {
				matches.push(match.index);
			}
		} catch (e) {
			console.error("Regex error:", e);
		}

		return matches;
	}

	highlightMatch(editor: Editor, pos: number, length: number) {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to }, true);
	}
}
