"use strict";

const {
  createReconciliationPlan,
  decodeManagedComment,
} = require("./sync-core");

function guidString(value) {
  if (!value) return "";
  return typeof value.toString === "function" ? value.toString() : String(value);
}

function nativeJoin(folder, fileName) {
  const separator = String(folder).includes("\\") ? "\\" : "/";
  return `${String(folder).replace(/[\\/]$/, "")}${separator}${fileName}`;
}

function createPremiereHost(ppro) {
  const colors = ppro.Constants.MarkerColor;
  const colorEntries = [
    ["Green", colors.GREEN],
    ["Red", colors.RED],
    ["Magenta", colors.MAGENTA !== undefined ? colors.MAGENTA : colors.MAGNETA],
    ["Orange", colors.ORANGE],
    ["Yellow", colors.YELLOW],
    ["Blue", colors.BLUE],
    ["Cyan", colors.CYAN],
  ].filter((entry) => entry[1] !== undefined);

  function readMarker(marker) {
    const start = marker.getStart();
    const index = marker.getColorIndex();
    const foundColor = colorEntries.find((entry) => entry[1] === index);
    return {
      native: marker,
      name: marker.getName() || "",
      comments: marker.getComments() || "",
      startSeconds: Number(start.seconds) || 0,
      startTicks: start.ticks || String(start.ticksNumber || ""),
      colorIndex: index,
      colorName: foundColor ? foundColor[0] : "Blue",
    };
  }

  function colorIndex(name) {
    const found = colorEntries.find((entry) => entry[0] === name);
    return found ? found[1] : colors.BLUE;
  }

  async function getContext() {
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Åpne et Premiere-prosjekt før du synkroniserer.");
    const sequence = await project.getActiveSequence();
    if (!sequence) throw new Error("Åpne en aktiv Premiere-sekvens før du synkroniserer.");
    const markerOwner = await ppro.Markers.getMarkers(sequence);
    if (!markerOwner) throw new Error("Premiere returnerte ingen markørbeholder for sekvensen.");
    return {
      project,
      sequence,
      markerOwner,
      projectGuid: guidString(project.guid),
      projectName: project.name || "Premiere-prosjekt",
      sequenceGuid: guidString(sequence.guid),
      sequenceName: sequence.name || "Sekvens",
      markers: markerOwner.getMarkers().map(readMarker),
    };
  }

  function runTransaction(project, undoLabel, callback) {
    let success = false;
    project.lockedAccess(() => {
      success = project.executeTransaction((compoundAction) => {
        callback(compoundAction);
      }, undoLabel);
    });
    if (!success) throw new Error(`Premiere avviste handlingen «${undoLabel}».`);
  }

  async function applyCloudMarkers(context, cloudMarkers) {
    const plan = createReconciliationPlan(context.markers, cloudMarkers);
    const updates = plan.updates.filter((item) => {
      const current = item.current;
      const desired = item.desired;
      return Math.abs(current.startSeconds - desired.timecodeSec) >= 0.001 ||
        current.name !== desired.name ||
        current.comments !== desired.comments ||
        current.colorIndex !== colorIndex(desired.colorName);
    });
    const hasFirstPass = plan.removals.length || updates.length || plan.additions.length;
    if (hasFirstPass) {
      runTransaction(context.project, "CreatorHub Video Room-markører", (compoundAction) => {
        for (const marker of plan.removals) {
          compoundAction.addAction(context.markerOwner.createRemoveMarkerAction(marker.native));
        }
        for (const item of updates) {
          const current = item.current;
          const desired = item.desired;
          if (Math.abs(current.startSeconds - desired.timecodeSec) >= 0.001) {
            compoundAction.addAction(context.markerOwner.createMoveMarkerAction(
              current.native,
              ppro.TickTime.createWithSeconds(desired.timecodeSec),
            ));
          }
          if (current.name !== desired.name) {
            compoundAction.addAction(current.native.createSetNameAction(desired.name));
          }
          if (current.comments !== desired.comments) {
            compoundAction.addAction(current.native.createSetCommentsAction(desired.comments));
          }
          const desiredColorIndex = colorIndex(desired.colorName);
          if (current.colorIndex !== desiredColorIndex) {
            compoundAction.addAction(current.native.createSetColorByIndexAction(desiredColorIndex));
          }
        }
        for (const desired of plan.additions) {
          compoundAction.addAction(context.markerOwner.createAddMarkerAction(
            desired.name,
            ppro.Marker.MARKER_TYPE_COMMENT,
            ppro.TickTime.createWithSeconds(desired.timecodeSec),
            ppro.TickTime.TIME_ZERO,
            desired.comments,
          ));
        }
      });
    }

    // createAddMarkerAction does not expose the new Marker handle. Refresh the
    // owner after the add transaction and color newly-created markers in a
    // second undoable transaction.
    if (plan.additions.length) {
      const refreshedOwner = await ppro.Markers.getMarkers(context.sequence);
      const additionsById = new Map(plan.additions.map((marker) => [marker.id, marker]));
      const colorUpdates = refreshedOwner.getMarkers().map(readMarker).filter((marker) => {
        const id = decodeManagedComment(marker.comments).id;
        const desired = id ? additionsById.get(id) : null;
        return desired && marker.colorIndex !== colorIndex(desired.colorName);
      });
      if (colorUpdates.length) {
        runTransaction(context.project, "CreatorHub-markørfarger", (compoundAction) => {
          for (const marker of colorUpdates) {
            const id = decodeManagedComment(marker.comments).id;
            const desired = additionsById.get(id);
            compoundAction.addAction(marker.native.createSetColorByIndexAction(colorIndex(desired.colorName)));
          }
        });
      }
    }

    return {
      added: plan.additions.length,
      updated: updates.length,
      removed: plan.removals.length,
      conflicts: plan.conflicts.length,
    };
  }

  async function getPlayheadSeconds() {
    const context = await getContext();
    const position = await context.sequence.getPlayerPosition();
    return Number(position && position.seconds) || 0;
  }

  async function setPlayheadSeconds(seconds) {
    const context = await getContext();
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const moved = await context.sequence.setPlayerPosition(
      ppro.TickTime.createWithSeconds(safeSeconds),
    );
    if (!moved) throw new Error("Premiere avviste flytting av playhead.");
    return safeSeconds;
  }

  async function exportActiveSequence(options) {
    const presetFile = options && options.presetFile;
    const outputFolder = options && options.outputFolder;
    const fileNameForExtension = options && options.fileNameForExtension;
    const sleep = options && options.sleep ? options.sleep : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const timeoutMs = Number(options && options.timeoutMs) || 6 * 60 * 60 * 1000;
    if (!presetFile?.isFile || !presetFile.nativePath || !String(presetFile.name || "").toLowerCase().endsWith(".epr")) {
      throw new Error("Velg et gyldig Adobe Media Encoder-preset (.epr).");
    }
    if (!outputFolder?.isFolder || !outputFolder.nativePath) throw new Error("Velg en gyldig eksportmappe.");
    const context = await getContext();
    const extension = String(await ppro.EncoderManager.getExportFileExtension(context.sequence, presetFile.nativePath) || "")
      .trim().replace(/^\.+/, "");
    const fileName = fileNameForExtension(extension, context);
    const outputPath = nativeJoin(outputFolder.nativePath, fileName);
    const manager = ppro.EncoderManager.getManager();
    if (!manager || typeof manager.exportSequence !== "function") throw new Error("Premiere EncoderManager er ikke tilgjengelig.");
    const accepted = await manager.exportSequence(
      context.sequence,
      ppro.Constants.ExportType.IMMEDIATELY,
      outputPath,
      presetFile.nativePath,
      true,
    );
    if (!accepted) throw new Error("Premiere avviste eksportjobben.");

    const startedAt = Date.now();
    let stableSamples = 0;
    let previousSize = -1;
    let file = null;
    while (Date.now() - startedAt < timeoutMs) {
      await sleep(1000);
      try {
        file = await outputFolder.getEntry(fileName);
        const metadata = await file.getMetadata();
        const size = Number(metadata && metadata.size);
        if (Number.isSafeInteger(size) && size > 0 && size === previousSize) stableSamples += 1;
        else stableSamples = 0;
        previousSize = size;
        if (stableSamples >= 2) {
          return { context, extension, fileName, outputPath, file, sizeBytes: size };
        }
      } catch (_) {
        stableSamples = 0;
      }
    }
    throw new Error("Eksporten brukte for lang tid. Filen er ikke lastet opp.");
  }

  return { applyCloudMarkers, exportActiveSequence, getContext, getPlayheadSeconds, setPlayheadSeconds };
}

module.exports = { createPremiereHost, guidString, nativeJoin };
