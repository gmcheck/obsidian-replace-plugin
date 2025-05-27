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

import "src/modal/customModal.css";

interface FindReplaceSettings {
	useRegex: boolean;
}

const DEFAULT_SETTINGS: FindReplaceSettings = {
	useRegex: false,
};

export default class FindReplacePlugin extends Plugin {
	settings: FindReplaceSettings;
	currentSearchTerm: string = "";
	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "find-in-current-file",
			name: "Find in Current File",
			// hotkeys: [{ modifiers: ["Mod"], key: "f" }],
			callback: () => new FindModal(this.app, this, this.currentSearchTerm).open(),
		});

		this.addCommand({
			id: "replace-in-current-file",
			name: "Replace in Current File",
			// hotkeys: [{ modifiers: ["Mod", "Shift"], key: "f" }],
			callback: () => new ReplaceModal(this.app, this, this.currentSearchTerm).open(),
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
}
