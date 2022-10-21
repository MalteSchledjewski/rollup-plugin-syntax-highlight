import { getHighlighter } from "shiki";

import { basePlugin } from "../../../shared/base-plugin";

export {toShikiTheme as toShikiTheme} from "shiki";

export type { SyntaxHighlightOptions } from "../../../shared/base-plugin";

export const syntaxHighlight = basePlugin(
  async ({ content, shikiOptions, language, customLanguage }) => {
    const highlighter = await getHighlighter(shikiOptions);
    if (customLanguage!==undefined){
      await highlighter.loadLanguage(customLanguage);
    };
    const code = highlighter.codeToHtml(content, { lang: language });
    return {
      code: `export default ${JSON.stringify(code)}`,
    };
  }
);
