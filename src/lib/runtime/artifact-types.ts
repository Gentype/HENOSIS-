/**
 * Типы артефактов bolt-формата для HENOSIS.
 * Адаптировано из bolt.diy/app/types/actions.ts — убраны WebContainer-зависимости.
 */

export type ActionType = "file" | "shell" | "start";

export interface BoltArtifactData {
  id: string;
  title: string;
  type?: string;
}

export interface FileAction {
  type: "file";
  filePath: string;
  content: string;
}

export interface ShellAction {
  type: "shell";
  content: string;
}

export interface StartAction {
  type: "start";
  content: string;
}

export type BoltAction = FileAction | ShellAction | StartAction;
export type BoltActionData = Partial<BoltAction> & { content: string };

export interface ArtifactCallbackData extends BoltArtifactData {
  messageId: string;
}

export interface ActionCallbackData {
  artifactId: string;
  messageId: string;
  actionId: string;
  action: BoltAction;
}

export type ArtifactCallback = (data: ArtifactCallbackData) => void;
export type ActionCallback = (data: ActionCallbackData) => void;

export interface ParserCallbacks {
  onArtifactOpen?: ArtifactCallback;
  onArtifactClose?: ArtifactCallback;
  onActionOpen?: ActionCallback;
  onActionStream?: ActionCallback;
  onActionClose?: ActionCallback;
}

export interface StreamingMessageParserOptions {
  callbacks?: ParserCallbacks;
}

export interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  artifactCounter: number;
  currentArtifact?: BoltArtifactData;
  currentAction: BoltActionData;
  actionId: number;
}
