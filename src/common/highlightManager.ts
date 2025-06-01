import { Editor } from "obsidian";
import { findInEditor, scrollToMatch, MatchResult } from "../common/textUtils";

/**
 * 高亮管理类，用于管理编辑器中的文本高亮。
 */
function escapeRegExp(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class HighlightManager {
	/**
	 * 清除编辑器中的所有高亮。
	 * @param editor - Obsidian 编辑器实例。
	 * @param positions - 高亮文本的起始位置和长度的数组，每个元素为 { pos: number, length: number }。
	 */
	public clearHighlights(editor: Editor, highLightMatches: MatchResult[]) {
		console.log("clearHighlights", highLightMatches);
		let originalText = editor.getValue();
		highLightMatches?.forEach((content) => {
			const escapedContent = escapeRegExp(content.content);
			const regex = new RegExp("==(" + escapedContent + ")==", "g");
			originalText = originalText.replace(regex, "$1");
		});
		editor.setValue(originalText);
		// 可选：恢复光标/选区
	}

	public clearSingleHighlights(editor: Editor, content: string) {
		console.log("clearSingleHighlights", content);
		let originalText = editor.getRange(
			{ line: 0, ch: 0 },
			{
				line: editor.lastLine(),
				ch: editor.getLine(editor.lastLine()).length,
			},
		);
		const escapedContent = content.replace(/[.*+?^${}()|[\]\[]/g, "\$&");
		const regex = new RegExp("==(" + escapedContent + ")==", "g");
		originalText = originalText.replace(regex, "$1");
		editor.setValue(originalText);
	}

	/**
	 * 在编辑器中添加高亮。
	 * @param editor - Obsidian 编辑器实例。
	 * @param positions - 高亮文本的起始位置和长度的数组，每个元素为 { pos: number, length: number }。
	 */
	public addHighlight(editor: Editor, highLightMatches: MatchResult[]) {
		console.log("addHighlight", highLightMatches);

		if (!highLightMatches || highLightMatches.length === 0) return;
		let originalText = editor.getValue();
		highLightMatches.forEach((content) => {
			const escapedContent = escapeRegExp(content.content);
			const regex = new RegExp(escapedContent, "g");
			originalText = originalText.replace(regex, "==$&==");
		});
		editor.setValue(originalText);
	}

	public addSingleHighlight(editor: Editor, content: string) {
		console.log("addSingleHighlight", content);
		let originalText = editor.getRange(
			{ line: 0, ch: 0 },
			{
				line: editor.lastLine(),
				ch: editor.getLine(editor.lastLine()).length,
			},
		);
		// 原正则表达式中 [\]\] 存在未正确转义的问题，修正为 [\]\\[] 以避免未终止的正则表达式字面量错误
		const escapedContent = content.replace(/[.*+?^${}()|[\]\\[]/g, "\\$&");
		const regex = new RegExp(escapedContent, "g");
		originalText = originalText.replace(regex, "==$&==");
		editor.setValue(originalText);
	}
}
