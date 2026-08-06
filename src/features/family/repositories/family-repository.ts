import type {
  Family,
  FamilyInput,
  FamilyMembership,
  FamilyMembershipInput,
  FamilyMembershipUpdateInput,
} from "../types/family";

export interface FamilyRepository {
  list(search: string): Promise<Family[]>;
  create(input: FamilyInput): Promise<Family>;
  update(id: string, input: FamilyInput): Promise<Family>;
  remove(id: string): Promise<void>;
  listMemberships(familyId: string): Promise<FamilyMembership[]>;
  addMembership(
    familyId: string,
    input: FamilyMembershipInput,
  ): Promise<FamilyMembership>;
  updateMembership(
    familyId: string,
    id: string,
    input: FamilyMembershipUpdateInput,
  ): Promise<FamilyMembership>;
  removeMembership(familyId: string, id: string): Promise<void>;
}
