/**
 * StreamingMessageParser — адаптирован из bolt.diy для HENOSIS.
 *
 * Парсит стриминговый текст от LLM и распознаёт теги:
 *   <boltArtifact id="..." title="..."> ... </boltArtifact>
 *   <boltAction type="file" filePath="..."> ... </boltAction>
 *   <boltAction type="shell"> ... </boltAction>
 *   <boltAction type="start"> ... </boltAction>
 *
 * Работает как state machine поверх побайтового потока — вызывай parse()
 * с каждым новым чанком и коллбэки сработают в нужный момент.
 *
 * Убраны: WebContainer, nanostores, Supabase action, build action.
 */

import type {
  ActionCallbackData,
  ArtifactCallbackData,
  BoltAction,
  BoltActionData,
  BoltArtifactData,
  FileAction,
  MessageState,
  ShellAction,
  StreamingMessageParserOptions,
} from "./artifact-types";

const ARTIFACT_TAG_OPEN = "<boltArtifact";
const ARTIFACT_TAG_CLOSE = "</boltArtifact>";
const ARTIFACT_ACTION_TAG_OPEN = "<boltAction";
const ARTIFACT_ACTION_TAG_CLOSE = "</boltAction>";

function cleanMarkdownSyntax(content: string): string {
  const codeBlockRegex = /^\s*```\w*\n([\s\S]*?)\n\s*```\s*$/;
  const match = content.match(codeBlockRegex);
  return match ? match[1] : content;
}

function cleanEscapedTags(content: string): string {
  return content.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export class StreamingMessageParser {
  #messages = new Map<string, MessageState>();

  constructor(private _options: StreamingMessageParserOptions = {}) {}

  parse(messageId: string, input: string): string {
    let state = this.#messages.get(messageId);

    if (!state) {
      state = {
        position: 0,
        insideAction: false,
        insideArtifact: false,
        artifactCounter: 0,
        currentAction: { content: "" },
        actionId: 0,
      };
      this.#messages.set(messageId, state);
    }

    let output = "";
    let i = state.position;
    let earlyBreak = false;

    while (i < input.length) {
      if (state.insideArtifact) {
        const currentArtifact = state.currentArtifact!;

        if (state.insideAction) {
          const closeIndex = input.indexOf(ARTIFACT_ACTION_TAG_CLOSE, i);
          const currentAction = state.currentAction;

          if (closeIndex !== -1) {
            currentAction.content += input.slice(i, closeIndex);

            let content = currentAction.content.trim();

            if ("type" in currentAction && currentAction.type === "file") {
              const fa = currentAction as Partial<FileAction>;
              if (!fa.filePath?.endsWith(".md")) {
                content = cleanMarkdownSyntax(content);
                content = cleanEscapedTags(content);
              }
              content += "\n";
            }

            currentAction.content = content;

            this._options.callbacks?.onActionClose?.({
              artifactId: currentArtifact.id,
              messageId,
              actionId: String(state.actionId - 1),
              action: currentAction as BoltAction,
            });

            state.insideAction = false;
            state.currentAction = { content: "" };
            i = closeIndex + ARTIFACT_ACTION_TAG_CLOSE.length;
          } else {
            // Streaming — emit partial file content
            if ("type" in currentAction && currentAction.type === "file") {
              let content = input.slice(i);
              const fa = currentAction as Partial<FileAction>;
              if (!fa.filePath?.endsWith(".md")) {
                content = cleanMarkdownSyntax(content);
                content = cleanEscapedTags(content);
              }

              this._options.callbacks?.onActionStream?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId - 1),
                action: {
                  ...(currentAction as FileAction),
                  content,
                  filePath: fa.filePath ?? "",
                },
              });
            }
            break;
          }
        } else {
          const actionOpenIndex = input.indexOf(ARTIFACT_ACTION_TAG_OPEN, i);
          const artifactCloseIndex = input.indexOf(ARTIFACT_TAG_CLOSE, i);

          if (
            actionOpenIndex !== -1 &&
            (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)
          ) {
            const actionEndIndex = input.indexOf(">", actionOpenIndex);

            if (actionEndIndex !== -1) {
              state.insideAction = true;
              state.currentAction = this.#parseActionTag(
                input,
                actionOpenIndex,
                actionEndIndex
              );

              this._options.callbacks?.onActionOpen?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId++),
                action: state.currentAction as BoltAction,
              });

              i = actionEndIndex + 1;
            } else {
              break;
            }
          } else if (artifactCloseIndex !== -1) {
            this._options.callbacks?.onArtifactClose?.({
              messageId,
              artifactId: currentArtifact.id,
              ...currentArtifact,
            });

            state.insideArtifact = false;
            state.currentArtifact = undefined;
            i = artifactCloseIndex + ARTIFACT_TAG_CLOSE.length;
          } else {
            break;
          }
        }
      } else if (input[i] === "<" && input[i + 1] !== "/") {
        let j = i;
        let potentialTag = "";

        while (j < input.length && potentialTag.length < ARTIFACT_TAG_OPEN.length) {
          potentialTag += input[j];

          if (potentialTag === ARTIFACT_TAG_OPEN) {
            const nextChar = input[j + 1];

            if (nextChar && nextChar !== ">" && nextChar !== " ") {
              output += input.slice(i, j + 1);
              i = j + 1;
              break;
            }

            const openTagEnd = input.indexOf(">", j);

            if (openTagEnd !== -1) {
              const artifactTag = input.slice(i, openTagEnd + 1);
              const artifactTitle = this.#extractAttribute(artifactTag, "title") as string;
              const artifactType = this.#extractAttribute(artifactTag, "type") as string;
              const artifactId = `${messageId}-${state.artifactCounter++}`;

              state.insideArtifact = true;

              const currentArtifact: BoltArtifactData = {
                id: artifactId,
                title: artifactTitle || "Project",
                type: artifactType,
              };
              state.currentArtifact = currentArtifact;

              this._options.callbacks?.onArtifactOpen?.({
                messageId,
                artifactId: currentArtifact.id,
                ...currentArtifact,
              });

              i = openTagEnd + 1;
            } else {
              earlyBreak = true;
            }
            break;
          } else if (!ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
            output += input.slice(i, j + 1);
            i = j + 1;
            break;
          }

          j++;
        }

        if (j === input.length && ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
          break;
        }
      } else {
        output += input[i];
        i++;
      }

      if (earlyBreak) break;
    }

    state.position = i;
    return output;
  }

  reset() {
    this.#messages.clear();
  }

  #parseActionTag(
    input: string,
    actionOpenIndex: number,
    actionEndIndex: number
  ): BoltActionData {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);
    const actionType = this.#extractAttribute(actionTag, "type") as BoltAction["type"];

    const actionAttributes: BoltActionData = {
      type: actionType,
      content: "",
    };

    if (actionType === "file") {
      const filePath = this.#extractAttribute(actionTag, "filePath") as string;
      (actionAttributes as Partial<FileAction>).filePath = filePath || "";
    }

    return actionAttributes;
  }

  #extractAttribute(tag: string, attributeName: string): string | undefined {
    const match = tag.match(new RegExp(`${attributeName}="([^"]*)"`, "i"));
    return match ? match[1] : undefined;
  }
}

/**
 * Собирает все файлы из стримингового текста в Map<filePath, content>.
 * Удобная утилита для серверной стороны (API route) где WebContainer не нужен.
 */
export function extractFilesFromText(text: string): Map<string, string> {
  const files = new Map<string, string>();

  const parser = new StreamingMessageParser({
    callbacks: {
      onActionClose: (data) => {
        if (data.action.type === "file") {
          files.set(data.action.filePath, data.action.content);
        }
      },
    },
  });

  parser.parse("extract", text);
  return files;
}
