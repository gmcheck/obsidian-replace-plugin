import { App, MarkdownView, Modal, Setting } from "obsidian";
import type FindReplacePlugin from "main";

export class ReplaceModal extends Modal {
	plugin: FindReplacePlugin;
	searchTerm: string = "";
	replaceTerm: string = "";
	useRegex: boolean;

	constructor(app: App, plugin: FindReplacePlugin) {
		super(app);
		this.plugin = plugin;
		this.useRegex = this.plugin.settings.useRegex;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Replace in File" });

		new Setting(contentEl)
			.setName("Search Term")
			.addText((text) =>
				text.setValue("").onChange((value) => (this.searchTerm = value))
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
				toggle
					.setValue(this.useRegex)
					.onChange((value) => (this.useRegex = value))
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Replace All")
				.setCta()
				.onClick(() => this.replaceAll())
		);
	}

	replaceAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView && this.searchTerm) {
			let text = activeView.editor.getValue();

			try {
				if (this.useRegex) {
					text = text.replace(
						new RegExp(this.searchTerm, "g"),
						this.replaceTerm
					);
				} else {
					const escaped = this.searchTerm.replace(
						/[.*+?^${}()|[\]\\]/g,
						"\\$&"
					);
					text = text.replace(
						new RegExp(escaped, "g"),
						this.replaceTerm
					);
				}

				activeView.editor.setValue(text);
				this.plugin.settings.useRegex = this.useRegex;
				this.plugin.saveSettings();
			} catch (e) {
				console.error("Replace error:", e);
			}
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
