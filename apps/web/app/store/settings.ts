import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GradingSettings } from "@answerlens/types";

interface SettingsState {
  settings: GradingSettings;
  updateSettings: (s: Partial<GradingSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: { focus: "steps", allowPartial: true },
      updateSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } }))
    }),
    { name: "answerlens-settings", storage: createJSONStorage(() => localStorage) }
  )
);
