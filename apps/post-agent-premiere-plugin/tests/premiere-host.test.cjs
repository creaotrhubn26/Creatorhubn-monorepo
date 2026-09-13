"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createPremiereHost } = require("../premiere-host");
const { decodeManagedComment } = require("../sync-core");

function marker(state) {
  return {
    state,
    getName: () => state.name,
    getComments: () => state.comments,
    getStart: () => ({ seconds: state.seconds, ticks: String(state.seconds * 1000) }),
    getColorIndex: () => state.color,
    createSetNameAction: (value) => () => { state.name = value; },
    createSetCommentsAction: (value) => () => { state.comments = value; },
    createSetColorByIndexAction: (value) => () => { state.color = value; },
  };
}

function fakePremiere(initialMarkers) {
  const markers = initialMarkers;
  let transactionCount = 0;
  const owner = {
    getMarkers: () => markers.slice(),
    createRemoveMarkerAction: (value) => () => markers.splice(markers.indexOf(value), 1),
    createMoveMarkerAction: (value, time) => () => { value.state.seconds = time.seconds; },
    createAddMarkerAction: (name, _type, time, _duration, comments) => () => {
      markers.push(marker({ name, comments, seconds: time.seconds, color: 5 }));
    },
  };
  const project = {
    guid: { toString: () => "project-guid" },
    name: "Prosjekt",
    getActiveSequence: async () => sequence,
    lockedAccess: (callback) => callback(),
    executeTransaction: (callback) => {
      transactionCount += 1;
      callback({ addAction: (action) => action() });
      return true;
    },
    exportCalls: [],
  };
  const sequence = {
    guid: { toString: () => "sequence-guid" },
    name: "Sekvens",
    playerPosition: 3.5,
    getPlayerPosition: async () => ({ seconds: sequence.playerPosition }),
    setPlayerPosition: async (time) => {
      sequence.playerPosition = time.seconds;
      return true;
    },
  };
  return {
    module: {
      Project: { getActiveProject: async () => project },
      Markers: { getMarkers: async () => owner },
      Marker: { MARKER_TYPE_COMMENT: "Comment" },
      TickTime: {
        TIME_ZERO: { seconds: 0, ticks: "0" },
        createWithSeconds: (seconds) => ({ seconds, ticks: String(seconds * 1000) }),
      },
      Constants: {
        MarkerColor: { GREEN: 0, RED: 1, MAGNETA: 2, ORANGE: 3, YELLOW: 4, BLUE: 5, CYAN: 6 },
        ExportType: { IMMEDIATELY: "immediately" },
      },
      EncoderManager: {
        getExportFileExtension: async () => "mp4",
        getManager: () => ({
          exportSequence: async (...args) => {
            project.exportCalls.push(args);
            return true;
          },
        }),
      },
    },
    markers,
    transactionCount: () => transactionCount,
    exportCalls: project.exportCalls,
  };
}

test("host adapter adds, updates, colors and removes managed markers in undo transactions", async () => {
  const stale = marker({
    name: "Stale",
    comments: "[[creatorhub:id=creatorhub:stale]]",
    seconds: 1,
    color: 5,
  });
  const fake = fakePremiere([stale]);
  const host = createPremiereHost(fake.module);
  let context = await host.getContext();
  const first = await host.applyCloudMarkers(context, [{
    id: "creatorhub:new",
    timecodeSec: 5,
    title: "Fiks lyd",
    note: "Klikk ved fem sekunder",
    mustFix: true,
  }]);
  assert.deepEqual(first, { added: 1, updated: 0, removed: 1, conflicts: 0 });
  assert.equal(fake.markers.length, 1);
  assert.equal(fake.markers[0].state.color, 1);
  assert.equal(decodeManagedComment(fake.markers[0].state.comments).id, "creatorhub:new");

  context = await host.getContext();
  await host.applyCloudMarkers(context, [{
    id: "creatorhub:new",
    timecodeSec: 8,
    title: "Fiks lyd",
    note: "Ferdig kontrollert",
    completed: true,
  }]);
  assert.equal(fake.markers[0].state.seconds, 8);
  assert.equal(fake.markers[0].state.name, "[FERDIG] Fiks lyd");
  assert.equal(fake.markers[0].state.color, 0);

  context = await host.getContext();
  const transactionCountBeforeNoop = fake.transactionCount();
  const unchanged = await host.applyCloudMarkers(context, [{
    id: "creatorhub:new",
    timecodeSec: 8,
    title: "Fiks lyd",
    note: "Ferdig kontrollert",
    completed: true,
  }]);
  assert.equal(unchanged.updated, 0);
  assert.equal(fake.transactionCount(), transactionCountBeforeNoop);
});

test("host adapter reads and moves the native Premiere playhead", async () => {
  const fake = fakePremiere([]);
  const host = createPremiereHost(fake.module);

  assert.equal(await host.getPlayheadSeconds(), 3.5);
  assert.equal(await host.setPlayheadSeconds(12.25), 12.25);
  assert.equal(await host.getPlayheadSeconds(), 12.25);
});

test("exports the exact active sequence through EncoderManager and waits for a stable file", async () => {
  const fake = fakePremiere([]);
  const host = createPremiereHost(fake.module);
  const outputFile = {
    isFile: true,
    nativePath: "/exports/Sekvens - V2.mp4",
    getMetadata: async () => ({ size: 2048 }),
  };
  const outputFolder = {
    isFolder: true,
    nativePath: "/exports",
    getEntry: async (name) => {
      assert.equal(name, "Sekvens - V2.mp4");
      return outputFile;
    },
  };

  const result = await host.exportActiveSequence({
    presetFile: { isFile: true, name: "Review.epr", nativePath: "/presets/Review.epr" },
    outputFolder,
    fileNameForExtension: (extension, context) => `${context.sequenceName} - V2.${extension}`,
    sleep: async () => undefined,
  });

  assert.equal(result.file, outputFile);
  assert.equal(result.sizeBytes, 2048);
  assert.deepEqual(fake.exportCalls[0].slice(1), [
    "immediately",
    "/exports/Sekvens - V2.mp4",
    "/presets/Review.epr",
    true,
  ]);
});
