import { App, Editor, MarkdownView } from "obsidian";

declare module "obsidian" {
	interface Editor {
		addHighlighter(options: {
			from: { line: number; ch: number };
			to: { line: number; ch: number };
			class?: string;
			attributes?: Record<string, string>;
		}): void;
		clearHighlights(): void;
	}
}
