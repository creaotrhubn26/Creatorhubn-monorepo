import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  mirrorManuscriptToProductionTables,
  mirrorSceneToProductionTables,
} from "./casting-production-data-mirror.js";

describe("casting production data mirror", () => {
  it("mirrors a compat manuscript into the normalized production table", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await mirrorManuscriptToProductionTables({ query } as unknown as Pool, {
      id: "manuscript-1",
      projectId: "project-1",
      title: "One room",
      content: "INT. STUDIO - NIGHT",
      format: "fountain",
      version: "3",
      status: "production",
      author: "The Role Room",
      language: "nb",
    });

    expect(query).toHaveBeenCalledOnce();
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO casting_manuscripts");
    expect(values.slice(0, 7)).toEqual([
      "manuscript-1",
      "project-1",
      "One room",
      "fountain",
      "INT. STUDIO - NIGHT",
      3,
      "production",
    ]);
  });

  it("maps scene dependencies into normalized production data", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await mirrorSceneToProductionTables(
      { query } as unknown as Pool,
      {
        id: "scene-1",
        manuscriptId: "manuscript-1",
        sceneNumber: "4",
        sceneHeading: "INT. STORYBOARD ROOM - DAY",
        description: "The storyboard becomes the production workspace.",
        locationName: "Storyboard Room",
        timeOfDay: "DAY",
        intExt: "INT",
        characters: ["MARI", "SANA"],
        propsNeeded: ["iPad Pro", "Apple Pencil"],
      },
      "project-1",
    );

    expect(query).toHaveBeenCalledOnce();
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO casting_scenes");
    expect(values[0]).toBe("scene-1");
    expect(values[1]).toBe("project-1");
    expect(values[4]).toBe(4);
    expect(JSON.parse(values[10])).toEqual(["MARI", "SANA"]);
    expect(JSON.parse(values[11])).toMatchObject({
      locations: [{ name: "Storyboard Room" }],
      props: [{ name: "iPad Pro" }, { name: "Apple Pencil" }],
    });
  });
});
