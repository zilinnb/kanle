import { createContext, useContext } from "react";
import type { PostMusic } from "@/lib/mock-data";

export interface EditorContextValue {
  token: string;
  /** Called when music embed edit button is clicked; parent opens MusicPanel */
  onEditMusic?: (nodeId: unknown, music: PostMusic) => void;
}

export const EditorContext = createContext<EditorContextValue>({ token: "" });

export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext);
}
