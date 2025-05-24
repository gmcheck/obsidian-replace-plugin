import {
	Plugin,
	App,
	Editor,
	MarkdownView,
	Modal,
	Setting,
	PluginSettingTab,
} from "obsidian";

import { promises as fs } from "fs";
import * as path from "path";

import { FindModal } from "src/modal/FindModal";
import { ReplaceModal } from "src/modal/ReplaceModal";
import { FindReplaceSettingTab } from "src/tab/FindReplaceSettingTab";

// 添加 Plugin 类的类型声明
declare module "obsidian" {
	interface Plugin {
		addStyleSheet(css: string): void;
	}
}

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

	async onload() {
		await this.loadSettings();
		// 加载 CSS 文件
		try {
			const pluginDir = this.manifest.dir || __dirname; // 确保 pluginDir 有值
			const cssFilePath = path.join(pluginDir, "styles.css");
			console.error("css 文件目录为： ", cssFilePath);
			const cssContent = await fs.readFile(cssFilePath, "utf-8");
			this.addStyleSheet(cssContent);
		} catch (error) {
			console.error("加载并添加 CSS 文件失败:", error);
		}

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
