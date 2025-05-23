import { App, MarkdownView, Modal, Setting } from "obsidian";
import type FindReplacePlugin from "main";

export class FindModal extends Modal {
	plugin: FindReplacePlugin;
	searchTerm: string = "";
	useRegex: boolean;
	matches: number[] = [];
	currentIndex: number = -1;

	constructor(app: App, plugin: FindReplacePlugin) {
		super(app);
		this.plugin = plugin;
		this.useRegex = this.plugin.settings.useRegex;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Find in File" });

		new Setting(contentEl)
			.setName("Search Term")
			.addText((text) =>
				text.setValue("").onChange((value) => (this.searchTerm = value))
			);

		new Setting(contentEl)
			.setName("Use Regular Expression")
			.addToggle((toggle) =>
				toggle
					.setValue(this.useRegex)
					.onChange((value) => (this.useRegex = value))
			);

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Find All").onClick(() => this.findAll())
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Next")
				.setCta()
				.onClick(() => this.findNext())
		);

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Count: 0").setDisabled(true)
		);
	}

	findAll() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView && this.searchTerm) {
			this.matches = this.plugin.findInEditor(
				activeView.editor,
				this.searchTerm,
				this.useRegex
			);
			this.currentIndex = -1;
			this.updateCount();
			this.findNext();
		}
	}

	findNext() {
		if (this.matches.length === 0) return;

		this.currentIndex = (this.currentIndex + 1) % this.matches.length;
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			const length = this.useRegex
				? new RegExp(this.searchTerm).exec(
						activeView.editor.getValue()
				  )?.[0]?.length || 0
				: this.searchTerm.length;

			this.plugin.highlightMatch(
				activeView.editor,
				this.matches[this.currentIndex],
				length
			);
		}
	}

	updateCount() {
		const countBtn = this.contentEl.querySelector(
			'button:contains("Count:")'
		);
		if (countBtn) {
			countBtn.setText(`Count: ${this.matches.length}`);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
