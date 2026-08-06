import type { CoverageCategory } from "../types/coverage";

export function categoryName(
  categories: readonly CoverageCategory[],
  categoryId: string,
): string {
  return categories.find((category) => category.id === categoryId)?.name
    ?? "사용할 수 없는 카테고리";
}

export function categoryIdentityHint(
  categories: readonly CoverageCategory[],
  categoryId: string,
): string | undefined {
  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) return undefined;
  const duplicate = categories.some(
    (candidate) => candidate.id !== category.id && candidate.name === category.name,
  );
  return duplicate ? `카테고리 ID ${category.id}` : undefined;
}

export function categoryDisplayLabel(
  categories: readonly CoverageCategory[],
  categoryId: string,
): string {
  const name = categoryName(categories, categoryId);
  const identity = categoryIdentityHint(categories, categoryId);
  return identity ? `${name} · ${identity}` : name;
}
