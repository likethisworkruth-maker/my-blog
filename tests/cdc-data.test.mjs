import assert from "node:assert/strict";
import test from "node:test";
import { agesData } from "../src/data/cdc/cdcData.ts";
import { ageLabel } from "../src/data/cdc/ageLabels.ts";
import { detailedMilestonesData, milestoneCategoryCounts } from "../src/data/cdc/milestonesData.ts";
import { detailedTipsData } from "../src/data/cdc/tipsData.ts";

test("CDC content covers all 12 age groups with complete bilingual milestones and tips", () => {
  assert.equal(agesData.length, 12);
  assert.deepEqual(agesData.map(({ key }) => key), [
    "2 mo", "4 mo", "6 mo", "9 mo", "1 year", "15 mo",
    "18 mo", "2 years", "30 mo", "3 years", "4 years", "5 years",
  ]);

  for (const age of agesData) {
    const milestones = detailedMilestonesData[age.key];
    const tips = detailedTipsData[age.key];
    const categories = milestoneCategoryCounts[age.key];

    assert.ok(milestones?.length, age.key + " has milestone items");
    assert.ok(tips?.length, age.key + " has tips");
    assert.equal(milestones.length, age.total, age.key + " total matches the source catalog");
    assert.equal(categories.length, 4, age.key + " retains all four source categories");
    assert.equal(categories.reduce((sum, count) => sum + count, 0), milestones.length, age.key + " category counts cover every milestone");
    assert.ok(milestones.every(({ en, ja }) => en.trim().length > 0 && ja.trim().length > 0), age.key + " milestones retain both languages");
    assert.ok(tips.every(({ en, ja }) => en.trim().length > 0 && ja.trim().length > 0), age.key + " tips retain both languages");
  }

  assert.equal(ageLabel("2 mo", "ja"), "2か月");
  assert.equal(ageLabel("5 years", "en"), "5 years");
});
