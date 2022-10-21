import { HighlighterOptions, ILanguageRegistration } from "shiki";
import { readFile } from "fs/promises";
import type { Plugin, LoadResult, PluginContext } from "rollup";

export type mapExtension = Record<string, string>;

export type SyntaxHighlightOptions = HighlighterOptions & {
  mapExtension?: mapExtension;
};

const defaultMapExtension: mapExtension = {
  svg: "xml",
};

const SYNTAX_SUFFIX = "?syntax";
const SYNTAX_EXTENSION = ".syntax";
const EXTENSION_REGEXP = /([^\.]+)(\.syntax)?$/;

/**
 * Allow us to bypass Vite's special behaviour for e.g. CSS files
 */
function wrapPath(path: string) {
  // "\0" is Rollup's way of telling other plugins not to resolve the file.
  // By appending .syntax as extension, Vite won't do special handling of e.g. CSS files.

  return "\0" + path + SYNTAX_EXTENSION;
}

/**
 * Undo our bypass in `wrapPath`
 */
function unWrapPath(path: string) {
  return path.slice(1, path.lastIndexOf(SYNTAX_EXTENSION));
}

type ViteLoadHookOptions = {
  ssr?: boolean;
};

type ViteLoadHook = (
  this: PluginContext,
  id: string,
  options: ViteLoadHookOptions
) => Promise<LoadResult>;

type VitePlugin = Pick<Plugin, "name" | "resolveId"> & {
  load?: ViteLoadHook;
  enforce?: "pre" | "post";
};

export type HandleContent = (params: {
  content: string;
  shikiOptions: HighlighterOptions;
  language: string;
  loadOptions: ViteLoadHookOptions;
  customLanguage: undefined|ILanguageRegistration;
}) => Promise<LoadResult>;

export const basePlugin = (handleContent: HandleContent) => {
  return function (options: SyntaxHighlightOptions | undefined,customLanguage: undefined|ILanguageRegistration): VitePlugin {
    const { mapExtension, ...shikiOptions } = {
      mapExtension: {
        ...defaultMapExtension,
        ...options?.mapExtension,
      },
      ...options,
    };

    return {
      name: "syntax-highlight",

      enforce: "pre", // vite specific

      async resolveId(id, importer, options) {
        if (!id.endsWith(SYNTAX_SUFFIX)) {
          return null;
        }

        const suffixIndex = id.indexOf(SYNTAX_SUFFIX);
        const path = id.slice(0, suffixIndex);

        const resolution = await this.resolve(path, importer, {
          skipSelf: true,
          ...options,
        });

        if (!resolution) {
          this.warn(`"${id}" couldn't be resolved, falling back to default`);
          return null;
        }

        return wrapPath(resolution.id);
      },

      async load(id, loadOptions) {
        if (!id.endsWith(SYNTAX_EXTENSION)) {
          return null;
        }

        const path = id.startsWith("\0") ? unWrapPath(id) : id;

        let content;

        try {
          content = await readFile(path, "utf-8");
        } catch (ex) {
          this.warn(`"${id}" couldn't be loaded, falling back to default`);
          return;
        }

        const extensionMatch = path.match(EXTENSION_REGEXP);

        if (!extensionMatch) {
          this.warn(
            `"${id}" doesn't have an extension, falling back to default`
          );
          return;
        }

        const extension = extensionMatch[1];
        const language = mapExtension[extension] || extension;

        return handleContent({
          content,
          shikiOptions,
          language,
          loadOptions,
          customLanguage,
        });
      },
    };
  };
};
