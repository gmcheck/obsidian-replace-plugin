import { Editor } from "obsidian";

export interface MatchResult {
	pos: number;
	length: number;
}

export function findInEditor(
	editor: Editor,
	searchTerm: string,
	useRegex: boolean
): MatchResult[] {
	const content = editor.getValue();
	const matches: MatchResult[] = [];
	let match;

	if (useRegex) {
		try {
			const regex = new RegExp(searchTerm, "gm");
			let lastIndex = 0;

			while ((match = regex.exec(content)) !== null) {
				matches.push({
					pos: match.index,
					length: match[0].length,
				});

				if (match.index === regex.lastIndex) {
					regex.lastIndex++;
				}
				lastIndex = regex.lastIndex;
			}
		} catch (e) {
			console.error("Regex error:", e);
			throw new Error("Invalid regular expression");
		}
	} else {
		let pos = 0;
		while ((pos = content.indexOf(searchTerm, pos)) !== -1) {
			matches.push({
				pos: pos,
				length: searchTerm.length,
			});
			pos += searchTerm.length;
		}
	}
	return matches;
}

export function scrollToMatch(
	editor: Editor,
	pos: number,
	length: number
): void {
	try {
		const from = editor.offsetToPos(pos);
		const to = editor.offsetToPos(pos + length);
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to });
	} catch (error) {
		console.error("Error scrolling to match:", error);
		throw new Error("Failed to scroll to the match");
	}
}
