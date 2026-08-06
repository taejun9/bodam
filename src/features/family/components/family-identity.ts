import type {
  FamilyCustomerOption,
  FamilyDetail,
  FamilySummary,
} from "@/features/family/types/family";

export interface NamedIdentity {
  readonly id: string;
  readonly name: string;
}

export function familyIdentities(
  families: readonly FamilySummary[],
): NamedIdentity[] {
  return families.map(({ family }) => ({ id: family.id, name: family.name }));
}

export function customerIdentities(
  detail: FamilyDetail | null | undefined,
  available: readonly FamilyCustomerOption[],
): NamedIdentity[] {
  const identities = new Map<string, NamedIdentity>();
  for (const member of detail?.members ?? []) {
    identities.set(member.customerId, {
      id: member.customerId,
      name: member.customerName,
    });
  }
  for (const customer of available) identities.set(customer.id, customer);
  return [...identities.values()];
}

export function identityHint(
  identities: readonly NamedIdentity[],
  id: string,
  kind: "가족" | "고객",
): string | undefined {
  const target = identities.find((identity) => identity.id === id);
  if (!target) return `${kind} ID ${id}`;
  const duplicate = identities.some(
    (identity) => identity.id !== target.id && identity.name === target.name,
  );
  return duplicate ? `${kind} ID ${target.id}` : undefined;
}

export function identityLabel(
  identities: readonly NamedIdentity[],
  id: string,
  kind: "가족" | "고객",
): string {
  const target = identities.find((identity) => identity.id === id);
  const hint = identityHint(identities, id, kind);
  if (!target) return hint ?? `${kind} ID ${id}`;
  return hint ? `${target.name} · ${hint}` : target.name;
}
