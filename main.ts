import { Plugin } from "obsidian";
import { FindAndReplacePanel } from "./src/panel/FindAndReplacePanel";
import "./styles.css"; // 修改为 styles.css

export default class FindReplacePlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: "open-find-replace-panel",
			name: "Find & Replace (Panel)",
			callback: () => {
				const panel = new FindAndReplacePanel(this.app);
				panel.open();
			},
		});
	}
}
