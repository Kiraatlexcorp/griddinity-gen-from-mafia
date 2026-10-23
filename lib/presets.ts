import {
  DEFAULT_BIN,
  DEFAULT_PLATE,
  DEFAULT_STATE,
  decodeState,
  encodeState,
  type BaseplateParams,
  type BinParams,
  type StudioState,
} from "@/lib/params";
import { PLATE_EDGES } from "@/lib/spec";

/**
 * Built-in designs. "classic" ones are common real-world Gridfinity setups;
 * "mafia" ones are Mafia-flavoured jokes that still build real, printable designs.
 */
export type PresetGroup = "classic" | "mafia";

export type Preset = {
  id: string;
  group: PresetGroup;
  name: string;
  tagline: string;
  state: StudioState;
};

const BARE_BIN: BinParams = {
  ...DEFAULT_BIN,
  elements: [],
  label: "none",
  magnets: "corner",
  screws: "none",
  labelText: "",
};

function bin(id: string, group: PresetGroup, name: string, tagline: string, params: Partial<BinParams>): Preset {
  return { id, group, name, tagline, state: { ...DEFAULT_STATE, tab: "bin", bin: { ...BARE_BIN, ...params } } };
}

function plate(id: string, group: PresetGroup, name: string, tagline: string, params: Partial<BaseplateParams>): Preset {
  return {
    id,
    group,
    name,
    tagline,
    state: { ...DEFAULT_STATE, tab: "baseplate", plate: { ...DEFAULT_PLATE, edges: [...PLATE_EDGES], ...params } },
  };
}

const scoop = [{ id: 1, kind: "scoop" as const, wall: "front" as const }];

export const PRESETS: Preset[] = [
  bin("screw-1x1", "classic", "1×1 screw bin, 2×2", "Four pockets for M2 to M5 hardware.", {
    gridX: 1, gridY: 1, gridZ: 3, dividersX: 1, dividersY: 1, dividerWall: 1, magnets: "full",
  }),
  bin("tool-2x1", "classic", "2×1 tool bin with scoop", "Scoop front, label tab for the tool name.", {
    gridX: 2, gridY: 1, gridZ: 6, elements: scoop, label: "center", labelText: "TOOLS",
  }),
  bin("parts-3x2", "classic", "3×2 deep parts bin", "Nine units deep, three columns, full-width label.", {
    gridX: 3, gridY: 2, gridZ: 9, dividersX: 2, label: "full", labelText: "PARTS", magnets: "full",
  }),
  bin("sd-usb-tray", "classic", "Half-height SD / USB tray", "Three units tall, 4 × 2 slots at 70% height.", {
    gridX: 2, gridY: 1, gridZ: 3, dividersX: 3, dividersY: 1, dividerWall: 0.8, dividerHeight: 70, lip: "thin",
  }),
  plate("drawer-6x4", "classic", "6×4 drawer baseplate, frame only", "Open frame, 252 × 168 mm, one A1 print.", {
    unit: "grid", width: 6, depth: 4, floor: false, magnets: false, screws: false, connectors: "none",
  }),
  plate("a1-5x5", "classic", "5×5 A1-bed baseplate, magnets", "210 mm square with magnet pockets under every cell.", {
    unit: "grid", width: 5, depth: 5, magnets: true, screws: false, connectors: "none",
  }),
  bin("dons-screw-vault", "mafia", "Don's Screw Vault", "Eight pockets, every screw accounted for. Nobody talks.", {
    gridX: 2, gridY: 1, gridZ: 3, dividersX: 3, dividersY: 1, dividerWall: 1, magnets: "full",
  }),
  bin("cement-shoe-tray", "mafia", "Cement Shoe Tray", "Thick walls, heavy floor, sinks fast. For polish and loose ends.", {
    gridX: 2, gridY: 2, gridZ: 3, wall: 2.4, magnets: "full", screws: "corner",
  }),
  bin("consigliere-caddy", "mafia", "Consigliere Desk Caddy", "Pens, clips and quiet advice. Three drawers, no paper trail.", {
    gridX: 3, gridY: 2, gridZ: 6, dividersX: 2, elements: scoop, label: "full", labelText: "COUNSEL",
  }),
  bin("business-card-holder", "mafia", "Family Business Card Holder", "Holds the cards. The business cards. Relax.", {
    gridX: 2, gridY: 1, gridZ: 5, dividersX: 1, label: "center", labelText: "CARDS",
  }),
  plate("offer-6x4", "mafia", "Offer You Can't Refuse", "6×4 baseplate. It fills the drawer whether the drawer likes it or not.", {
    unit: "grid", width: 6, depth: 4, magnets: true, screws: false, connectors: "none",
  }),
  bin("witness-protection", "mafia", "Witness Protection Hidden Bin", "No label, new identity. Nobody asks what is inside.", {
    gridX: 1, gridY: 1, gridZ: 6, lip: "thin",
  }),
  plate("family-drawer", "mafia", "The Family Drawer", "7×5 in puzzle pieces. Splits up for the bed, always comes back together.", {
    unit: "grid", width: 7, depth: 5, magnets: true, screws: false, connectors: "puzzle",
  }),
  bin("cannoli-tray", "mafia", "Cannoli Tray", "Three low lanes sized for pastry. Somebody always takes the last one.", {
    gridX: 3, gridY: 1, gridZ: 3, dividersX: 2, dividerHeight: 50, elements: scoop, lip: "thin",
  }),
  bin("small-favours", "mafia", "Small Favours Bin", "One favour per pocket. Repayment terms on request.", {
    gridX: 1, gridY: 2, gridZ: 4, dividersY: 1, label: "center", labelText: "FAVOURS",
  }),
];

export const PRESET_GROUPS: { id: PresetGroup; label: string }[] = [
  { id: "classic", label: "Gridfinity classics" },
  { id: "mafia", label: "The Family business" },
];

export function presetQuery(preset: Preset) {
  return encodeState(preset.state);
}

/**
 * Identity of the design on the active tab. The other tab's settings are reset
 * to defaults so tweaking the baseplate does not "edit" a bin preset.
 */
export function designKey(state: StudioState) {
  return encodeState({
    tab: state.tab,
    plate: state.tab === "baseplate" ? state.plate : DEFAULT_PLATE,
    bin: state.tab === "bin" ? state.bin : DEFAULT_BIN,
  });
}

/** What the user last loaded from the pack or their saved designs. */
export type PickedPreset = { source: "pack" | "saved"; id: string; name: string; key: string };

export type PresetSelection = { picked: PickedPreset; edited: boolean } | null;

/**
 * The preset the trigger should name. An exact match wins (so shared links and
 * undoing an edit both light up); otherwise the last pick on the same tab shows
 * as edited; otherwise nothing is selected.
 */
export function presetSelection(
  state: StudioState,
  picked: PickedPreset | null,
  saved: { name: string; query: string }[],
): PresetSelection {
  const key = designKey(state);
  if (picked?.key === key) return { picked, edited: false };
  for (const preset of PRESETS) {
    const presetKey = designKey(preset.state);
    if (presetKey === key) return { picked: { source: "pack", id: preset.id, name: preset.name, key }, edited: false };
  }
  for (const item of saved) {
    if (designKey(decodeState(item.query)) === key) {
      return { picked: { source: "saved", id: item.name, name: item.name, key }, edited: false };
    }
  }
  if (picked && new URLSearchParams(picked.key).get("tab") === state.tab) return { picked, edited: true };
  return null;
}
