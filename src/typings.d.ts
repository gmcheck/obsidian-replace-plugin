import { Editor } from "obsidian";

declare module "obsidian" {
	interface Editor {
		decorateText: (from: number, to: number, options: any) => void;
	}
}
