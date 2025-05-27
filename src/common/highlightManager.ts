import { Editor } from "obsidian";

/**
 * 高亮管理类，用于管理编辑器中的文本高亮。
 */
export class HighlightManager {
    /**
     * 清除编辑器中的所有高亮。
     * @param editor - Obsidian 编辑器实例。
     * @param positions - 高亮文本的起始位置和长度的数组，每个元素为 { pos: number, length: number }。
     */
    public clearHighlights(editor: Editor, contentArray: {pos:number, text: string}[]) { 
        console.log('clearHighlights', contentArray);
        let originalText = editor.getRange({ line: 0, ch: 0 }, { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length });
        contentArray.forEach((content) => {
            const escapedContent = content.text.replace(/[.*+?^${}()|[\]\[]/g, '\$&');
            const regex = new RegExp('==(' + escapedContent + ')==', 'g');
            originalText = originalText.replace(regex, '$1');
        });
        editor.setValue(originalText);
    }

    public clearSingleHighlights(editor: Editor, content: string) { 
        console.log('clearSingleHighlights', content);
        let originalText = editor.getRange({ line: 0, ch: 0 }, { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length });
            const escapedContent = content.replace(/[.*+?^${}()|[\]\[]/g, '\$&');
            const regex = new RegExp('==(' + escapedContent + ')==', 'g');
            originalText = originalText.replace(regex, '$1');
        editor.setValue(originalText);
    }

    /**
     * 在编辑器中添加高亮。
     * @param editor - Obsidian 编辑器实例。
     * @param positions - 高亮文本的起始位置和长度的数组，每个元素为 { pos: number, length: number }。
     */
    public addHighlight(editor: Editor, contentArray: {pos:number, text: string}[]) { 
        console.log('addHighlight', contentArray);
        let originalText = editor.getRange({ line: 0, ch: 0 }, { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length });
        contentArray.forEach((content) => {
        // 原正则表达式中 [\]\] 存在未正确转义的问题，修正为 [\]\\[] 以避免未终止的正则表达式字面量错误
        const escapedContent = content.text.replace(/[.*+?^${}()|[\]\\[]/g, '\\$&');
            const regex = new RegExp(escapedContent, 'g');
            originalText = originalText.replace(regex, '==$&==');
            });
        editor.setValue(originalText);
    }

    public addSingleHighlight(editor: Editor, content: string) { 
        console.log('addSingleHighlight', content);
        let originalText = editor.getRange({ line: 0, ch: 0 }, { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length });
        // 原正则表达式中 [\]\] 存在未正确转义的问题，修正为 [\]\\[] 以避免未终止的正则表达式字面量错误
        const escapedContent = content.replace(/[.*+?^${}()|[\]\\[]/g, '\\$&');
        const regex = new RegExp(escapedContent, 'g');
        originalText = originalText.replace(regex, '==$&==');
        editor.setValue(originalText);
    }
}