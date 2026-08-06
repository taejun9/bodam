// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import PolicyCoverageForm from "../components/PolicyCoverageForm.vue";
import PolicyCoverageList from "../components/PolicyCoverageList.vue";
import type { Coverage, CoverageCategory } from "../types/coverage";

const timestamp = "2026-08-06T01:02:03.000Z";
const categoryIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
] as const;

const categories: CoverageCategory[] = [
  { id: categoryIds[0], name: "중복", createdAt: timestamp, updatedAt: timestamp },
  { id: categoryIds[1], name: "중복", createdAt: timestamp, updatedAt: timestamp },
  { id: categoryIds[2], name: "고유", createdAt: timestamp, updatedAt: timestamp },
];

const coverages: Coverage[] = categoryIds.slice(0, 2).map((categoryId, index) => ({
  id: `30000000-0000-4000-8000-00000000000${index + 1}`,
  policyId: "20000000-0000-4000-8000-000000000001",
  categoryId,
  amountWon: BigInt(index + 1),
  createdAt: timestamp,
  updatedAt: timestamp,
}));

describe("duplicate coverage category labels", () => {
  it("shows stable IDs in duplicate select options", () => {
    const wrapper = mount(PolicyCoverageForm, { props: { categories } });
    const labels = wrapper.findAll("option").map((option) => option.text());

    expect(labels).toContain(`중복 · 카테고리 ID ${categoryIds[0]}`);
    expect(labels).toContain(`중복 · 카테고리 ID ${categoryIds[1]}`);
    expect(labels).toContain("고유");
    expect(labels).not.toContain(`고유 · 카테고리 ID ${categoryIds[2]}`);
  });

  it("shows stable IDs in duplicate coverage rows and action names", () => {
    const wrapper = mount(PolicyCoverageList, { props: { categories, coverages } });
    const rows = wrapper.findAll("[data-testid='coverage-row']");

    expect(rows).toHaveLength(2);
    for (const [index, row] of rows.entries()) {
      expect(row.text()).toContain(`카테고리 ID ${categoryIds[index]}`);
      expect(row.get("button").attributes("aria-label"))
        .toContain(`카테고리 ID ${categoryIds[index]}`);
    }
  });
});
