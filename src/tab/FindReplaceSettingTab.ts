import { App, PluginSettingTab, Setting } from "obsidian";
import type FindReplacePlugin from "main";

export class FindReplaceSettingTab extends PluginSettingTab {
	plugin: FindReplacePlugin;

	constructor(app: App, plugin: FindReplacePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Find and Replace Settings" });

		new Setting(containerEl)
			.setName("Default Use Regex")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useRegex)
					.onChange(async (value) => {
						this.plugin.settings.useRegex = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
