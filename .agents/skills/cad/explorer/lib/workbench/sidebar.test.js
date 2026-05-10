import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSidebarDirectoryTree,
  selectedEntryKeyFromUrl,
  listSidebarItems,
  filenameLabelForEntry,
  normalizeCadFileQueryParam,
  normalizeCadRefQueryParams,
  sidebarDirectoryIdForEntry,
  sidebarLabelForEntry
} from "./sidebar.js";
import {
  readCadWorkspaceGlassTone,
  readCadWorkspaceSessionState,
  resetCadWorkspacePersistence,
  writeCadWorkspaceSessionState
} from "./persistence.js";
import {
  preferredPanelWidthAfterViewportSync
} from "../../components/workbench/hooks/useCadWorkspaceLayout.js";
import { restoredSidebarWidthForViewport } from "../../components/workbench/hooks/useCadWorkspaceSession.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
}

test("filenameLabelForEntry shows canonical step, stl, 3mf, dxf, and urdf suffixes", () => {
  assert.equal(
    filenameLabelForEntry({
      file: "sample_mount.step",
      kind: "part",
      source: { format: "step", path: "parts/sample_mount.step" }
    }),
    "sample_mount.step"
  );

  assert.equal(
    filenameLabelForEntry({
      file: "sample_assembly.step",
      kind: "assembly",
      source: { format: "step", path: "assemblies/sample_assembly.step" }
    }),
    "sample_assembly.step"
  );

  assert.equal(
    filenameLabelForEntry({
      file: "imports/vendor/widget.stp",
      kind: "part",
      source: { format: "stp", path: "imports/vendor/widget.stp" },
      step: { path: "imports/vendor/widget.stp" }
    }),
    "widget.stp"
  );

  assert.equal(
    filenameLabelForEntry({
      file: "sample_robot.urdf",
      kind: "urdf",
      source: { format: "urdf", path: "sample_robot.urdf" },
      name: "sample_robot (URDF)"
    }),
    "sample_robot.urdf"
  );

  assert.equal(
    filenameLabelForEntry({
      file: "sample_plate.dxf",
      kind: "dxf",
      source: { format: "dxf", path: "drawings/sample_plate.dxf" }
    }),
    "sample_plate.dxf"
  );

  assert.equal(
    filenameLabelForEntry({
      file: "fixtures/bracket.stl",
      kind: "stl",
      source: { format: "stl", path: "fixtures/bracket.stl" }
    }),
    "bracket.stl"
  );

  assert.equal(
    filenameLabelForEntry({
      file: "fixtures/bracket.3mf",
      kind: "3mf",
      source: { format: "3mf", path: "fixtures/bracket.3mf" }
    }),
    "bracket.3mf"
  );
});

test("sidebarLabelForEntry uses the same suffix-aware filename labels", () => {
  const entry = {
    file: "sample_assembly.step",
    kind: "assembly",
    source: { format: "step", path: "assemblies/sample_assembly.step" }
  };

  assert.equal(sidebarLabelForEntry(entry), "sample_assembly.step");
});

test("sidebarDirectoryIdForEntry keeps exact CAD file folders", () => {
  assert.equal(
    sidebarDirectoryIdForEntry({
      file: "parts/sample_plate.step",
      kind: "part",
      source: { format: "step", path: "parts/sample_plate.step" }
    }),
    "parts"
  );

  assert.equal(
    sidebarDirectoryIdForEntry({
      file: "drawings/sample_plate.dxf",
      kind: "dxf",
      source: { format: "dxf", path: "drawings/sample_plate.dxf" }
    }),
    "drawings"
  );

  assert.equal(
    sidebarDirectoryIdForEntry({
      file: "sample_robot.urdf",
      kind: "urdf",
      source: { format: "urdf", path: "sample_robot.urdf" }
    }),
    ""
  );

  assert.equal(
    sidebarDirectoryIdForEntry({
      file: "meshes/fixture.stl",
      kind: "stl",
      source: { format: "stl", path: "meshes/fixture.stl" }
    }),
    "meshes"
  );

  assert.equal(
    sidebarDirectoryIdForEntry({
      file: "meshes/fixture.3mf",
      kind: "3mf",
      source: { format: "3mf", path: "meshes/fixture.3mf" }
    }),
    "meshes"
  );

  assert.equal(
    sidebarDirectoryIdForEntry({
      file: "parts/mount.step",
      kind: "part",
      source: { format: "step", path: "parts/mount.step" }
    }),
    "parts"
  );
});

test("buildSidebarDirectoryTree lists CAD files in their exact source directory", () => {
  const tree = buildSidebarDirectoryTree([
    {
      file: "parts/sample_plate.step",
      kind: "part",
      source: { format: "step", path: "parts/sample_plate.step" }
    },
    {
      file: "drawings/sample_plate.dxf",
      kind: "dxf",
      source: { format: "dxf", path: "drawings/sample_plate.dxf" }
    }
  ]);

  const partsDirectory = tree.directories.find((directory) => directory.id === "parts");
  assert.ok(partsDirectory);
  const drawingsDirectory = tree.directories.find((directory) => directory.id === "drawings");
  assert.ok(drawingsDirectory);
  assert.deepEqual(
    [
      ...listSidebarItems(drawingsDirectory).map((item) => `${item.type}:${item.label}`),
      ...listSidebarItems(partsDirectory).map((item) => `${item.type}:${item.label}`),
    ],
    ["entry:sample_plate.dxf", "entry:sample_plate.step"]
  );
});

test("workspace session state persists expanded directories, unified sidebars, and URDF entry animation preference", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  try {
    writeCadWorkspaceSessionState({
      openTabs: [],
      selectedKey: "",
      query: "sample",
      expandedDirectoryIds: ["parts", "parts/imports", "parts"],
      sidebarOpen: false,
      fileSheetOpen: false,
      lookSheetOpen: true,
      sidebarWidth: 312,
      tabToolsWidth: 344,
      urdfEntryAnimationEnabled: false
    });

    const restoredSession = readCadWorkspaceSessionState();

    assert.deepEqual(
      restoredSession.expandedDirectoryIds,
      ["parts", "parts/imports"]
    );
    assert.equal(restoredSession.query, "sample");
    assert.equal(restoredSession.sidebarOpen, false);
    assert.equal(restoredSession.fileSheetOpen, false);
    assert.equal(restoredSession.lookSheetOpen, true);
    assert.equal(restoredSession.sidebarWidth, 312);
    assert.equal(restoredSession.tabToolsWidth, 344);
    assert.equal(restoredSession.urdfEntryAnimationEnabled, false);
    assert.equal(globalThis.window.localStorage.getItem("cad-explorer:workbench-global:v1"), null);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("workspace global state migrates legacy default panel widths", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  try {
    writeCadWorkspaceSessionState({
      openTabs: [],
      selectedKey: "",
      sidebarWidth: 300,
      tabToolsWidth: 300
    });

    const restoredSession = readCadWorkspaceSessionState();

    assert.equal(restoredSession.sidebarWidth, 260);
    assert.equal(restoredSession.tabToolsWidth, 260);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("workspace desktop restore preserves collapsed sidebar width preferences", () => {
  assert.equal(
    restoredSidebarWidthForViewport(
      { sidebarOpen: true, sidebarWidth: 150 },
      { defaultSidebarWidth: 260, sidebarMinWidth: 150 }
    ),
    260
  );
  assert.equal(
    restoredSidebarWidthForViewport(
      { sidebarOpen: false, sidebarWidth: 420 },
      { defaultSidebarWidth: 260, sidebarMinWidth: 150 }
    ),
    420
  );
  assert.equal(
    restoredSidebarWidthForViewport(
      { sidebarOpen: true, sidebarWidth: 420 },
      { defaultSidebarWidth: 260, sidebarMinWidth: 150 }
    ),
    420
  );
  assert.equal(
    restoredSidebarWidthForViewport(
      { sidebarOpen: false, sidebarWidth: 150 },
      { defaultSidebarWidth: 260, sidebarMinWidth: 150 }
    ),
    150
  );
});

test("workspace resize sync preserves wider preferred sidebar widths", () => {
  assert.equal(preferredPanelWidthAfterViewportSync(420, 150), 420);
  assert.equal(preferredPanelWidthAfterViewportSync(120, 150), 150);
});

test("workspace session state defaults sidebar closed and side sheets closed", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  try {
    writeCadWorkspaceSessionState({
      openTabs: [],
      selectedKey: "",
      query: ""
    });

    const restoredSession = readCadWorkspaceSessionState();
    assert.equal(restoredSession.sidebarOpen, false);
    assert.equal(restoredSession.fileSheetOpen, false);
    assert.equal(restoredSession.lookSheetOpen, false);
    assert.equal(restoredSession.urdfEntryAnimationEnabled, false);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("workspace session state migrates legacy desktop/mobile sidebar fields", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  try {
    globalThis.window.sessionStorage.setItem("cad-explorer:workbench-session:v2", JSON.stringify({
      version: 2,
      global: {
        desktopSidebarOpen: false,
        desktopFileSheetOpen: true,
        desktopLookSheetOpen: true
      },
      tabs: {
        selectedKey: "",
        openOrder: [],
        byKey: {}
      }
    }));

    const restoredSession = readCadWorkspaceSessionState();
    assert.equal(restoredSession.sidebarOpen, false);
    assert.equal(restoredSession.fileSheetOpen, true);
    assert.equal(restoredSession.lookSheetOpen, true);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("workspace glass tone defaults to cinematic dark tone", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  try {
    assert.equal(readCadWorkspaceGlassTone(), "dark");
    globalThis.window.localStorage.setItem("cad-explorer:workbench-glass-tone:v1", "light");
    assert.equal(readCadWorkspaceGlassTone(), "light");
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("resetCadWorkspacePersistence removes current CAD Explorer keys", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage()
  };

  try {
    globalThis.window.localStorage.setItem("cad-explorer:workbench-global:v1", "{}");
    globalThis.window.localStorage.setItem("cad-explorer:look-settings", "{}");
    globalThis.window.localStorage.setItem("cad-explorer-theme", "dark");
    globalThis.window.localStorage.setItem("cad-explorer:workbench-glass-tone:v1", "dark");
    globalThis.window.sessionStorage.setItem("cad-explorer:workbench-session:v2", "{}");
    globalThis.window.sessionStorage.setItem("cad-explorer:dxf-bend-overrides:v1", "{}");

    assert.equal(resetCadWorkspacePersistence(), true);

    assert.equal(globalThis.window.localStorage.getItem("cad-explorer:workbench-global:v1"), null);
    assert.equal(globalThis.window.localStorage.getItem("cad-explorer:look-settings"), null);
    assert.equal(globalThis.window.localStorage.getItem("cad-explorer-theme"), null);
    assert.equal(globalThis.window.localStorage.getItem("cad-explorer:workbench-glass-tone:v1"), null);
    assert.equal(globalThis.window.sessionStorage.getItem("cad-explorer:workbench-session:v2"), null);
    assert.equal(globalThis.window.sessionStorage.getItem("cad-explorer:dxf-bend-overrides:v1"), null);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("normalizeCadRefQueryParams accepts relative refs", () => {
  assert.deepEqual(
    normalizeCadRefQueryParams(["parts/sample_plate#f2", "@cad[parts/sample_base#e1]"]),
    ["@cad[parts/sample_plate#f2]", "@cad[parts/sample_base#e1]"]
  );
});

test("selectedEntryKeyFromUrl restores the selected file query param", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: "?file=parts%2Fsample_plate.step"
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "parts/sample_base.step",
          cadPath: "parts/sample_base",
          kind: "part"
        },
        {
          file: "parts/sample_plate.step",
          cadPath: "parts/sample_plate",
          kind: "part"
        }
      ]),
      "parts/sample_plate.step"
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("selectedEntryKeyFromUrl uses EXPLORER_DEFAULT_FILE when no file query param exists", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: ""
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "parts/sample_base.step",
          cadPath: "parts/sample_base",
          kind: "part"
        },
        {
          file: "parts/sample_plate.step",
          cadPath: "parts/sample_plate",
          kind: "part"
        }
      ], { defaultFile: "parts/sample_plate.step" }),
      "parts/sample_plate.step"
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("selectedEntryKeyFromUrl does not fall back to EXPLORER_DEFAULT_FILE for missing explicit file params", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: "?file=parts%2Fmissing.step"
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "parts/sample_base.step",
          cadPath: "parts/sample_base",
          kind: "part"
        },
        {
          file: "parts/sample_plate.step",
          cadPath: "parts/sample_plate",
          kind: "part"
        }
      ], { defaultFile: "parts/sample_plate.step" }),
      ""
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("selectedEntryKeyFromUrl does not use refs to mask a missing explicit file param", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: "?file=parts%2Fmissing.step&refs=parts%2Fsample_plate%23f2"
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "parts/sample_plate.step",
          cadPath: "parts/sample_plate",
          kind: "part"
        }
      ], { defaultFile: "parts/sample_plate.step" }),
      ""
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("selectedEntryKeyFromUrl prefers explicit refs over EXPLORER_DEFAULT_FILE when no file param exists", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: "?refs=parts%2Fsample_plate%23f2"
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "parts/sample_base.step",
          cadPath: "parts/sample_base",
          kind: "part"
        },
        {
          file: "parts/sample_plate.step",
          cadPath: "parts/sample_plate",
          kind: "part"
        }
      ], { defaultFile: "parts/sample_base.step" }),
      "parts/sample_plate.step"
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("selectedEntryKeyFromUrl restores workspace-relative file params", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: "?file=workspace%2Fparts%2Fsample_plate.step"
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "workspace/parts/sample_base.step",
          cadPath: "workspace/parts/sample_base",
          kind: "part"
        },
        {
          file: "workspace/parts/sample_plate.step",
          cadPath: "workspace/parts/sample_plate",
          kind: "part"
        }
      ]),
      "workspace/parts/sample_plate.step"
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("normalizeCadFileQueryParam keeps scan-relative file params unchanged", () => {
  assert.equal(normalizeCadFileQueryParam("parts/sample_plate.step"), "parts/sample_plate.step");
  assert.equal(normalizeCadFileQueryParam("workspace/parts/sample_plate.step"), "workspace/parts/sample_plate.step");
  assert.equal(normalizeCadFileQueryParam("/workspace/imports/widget.step/"), "workspace/imports/widget.step");
});

test("selectedEntryKeyFromUrl restores the selected canonical ref query param", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      search: "?refs=parts%2Fsample_plate%23f2"
    }
  };

  try {
    assert.equal(
      selectedEntryKeyFromUrl([
        {
          file: "parts/sample_base.step",
          cadPath: "parts/sample_base",
          kind: "part"
        },
        {
          file: "parts/sample_plate.step",
          cadPath: "parts/sample_plate",
          kind: "part"
        }
      ]),
      "parts/sample_plate.step"
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
