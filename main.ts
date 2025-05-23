
import { Plugin, App, Editor, MarkdownView, Modal, Setting, PluginSettingTab } from 'obsidian';

interface FindReplaceSettings {
    searchPattern: string;
    replacePattern: string;
    useRegex: boolean;
}

const DEFAULT_SETTINGS: FindReplaceSettings = {
    searchPattern: '',
    replacePattern: '',
    useRegex: false
};

export default class FindReplacePlugin extends Plugin {
    settings: FindReplaceSettings;

    async onload() {
        await this.loadSettings();
        
        this.addCommand({
            id: 'find-replace-current-file',
            name: 'Find and Replace in Current File',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "f" }],
            callback: () => {
                new FindReplaceModal(this.app, this).open();
            }
        });

        this.addSettingTab(new FindReplaceSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class FindReplaceModal extends Modal {
    plugin: FindReplacePlugin;
    searchPattern: string;
    replacePattern: string;
    useRegex: boolean;

    constructor(app: App, plugin: FindReplacePlugin) {
        super(app);
        this.plugin = plugin;
        this.searchPattern = this.plugin.settings.searchPattern;
        this.replacePattern = this.plugin.settings.replacePattern;
        this.useRegex = this.plugin.settings.useRegex;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Find and Replace' });

        new Setting(contentEl)
            .setName('Search Pattern')
            .addText(text => text
                .setValue(this.searchPattern)
                .onChange(value => this.searchPattern = value));

        new Setting(contentEl)
            .setName('Replace Pattern')
            .addText(text => text
                .setValue(this.replacePattern)
                .onChange(value => this.replacePattern = value));

        new Setting(contentEl)
            .setName('Use Regular Expression')
            .addToggle(toggle => toggle
                .setValue(this.useRegex)
                .onChange(value => this.useRegex = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Replace All')
                .setCta()
                .onClick(() => {
                    this.replaceAll();
                    this.close();
                }));
    }

    replaceAll() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            let text = editor.getValue();
            
            try {
                if (this.useRegex) {
                    text = text.replace(new RegExp(this.searchPattern, 'g'), this.replacePattern);
                } else {
                    const escaped = this.searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    text = text.replace(new RegExp(escaped, 'g'), this.replacePattern);
                }
                
                editor.setValue(text);
                this.plugin.settings.searchPattern = this.searchPattern;
                this.plugin.settings.replacePattern = this.replacePattern;
                this.plugin.settings.useRegex = this.useRegex;
                this.plugin.saveSettings();
            } catch (e) {
                console.error('Replace error:', e);
            }
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class FindReplaceSettingTab extends PluginSettingTab {
    plugin: FindReplacePlugin;

    constructor(app: App, plugin: FindReplacePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Find and Replace Settings' });

        new Setting(containerEl)
            .setName('Default Search Pattern')
            .addText(text => text
                .setValue(this.plugin.settings.searchPattern)
                .onChange(async (value) => {
                    this.plugin.settings.searchPattern = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Replace Pattern')
            .addText(text => text
                .setValue(this.plugin.settings.replacePattern)
                .onChange(async (value) => {
                    this.plugin.settings.replacePattern = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Use Regex')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useRegex)
                .onChange(async (value) => {
                    this.plugin.settings.useRegex = value;
                    await this.plugin.saveSettings();
                }));
    }
}
