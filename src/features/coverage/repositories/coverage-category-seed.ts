export interface CoverageCategorySeed {
  readonly id: string;
  readonly name: string;
}

const categoryNames = [
  "암",
  "유사암",
  "뇌혈관",
  "심혈관",
  "질병수술",
  "상해수술",
  "후유장해",
  "입원",
  "간병",
  "운전자",
] as const;

export const INITIAL_COVERAGE_CATEGORY_SEEDS: readonly CoverageCategorySeed[] =
  categoryNames.map((name, index) => ({
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name,
  }));
