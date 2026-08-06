import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseFamily,
  parseFamilyDeleteResult,
  parseFamilyId,
  parseFamilyInput,
  parseFamilyList,
  parseFamilyMembership,
  parseFamilyMembershipInput,
  parseFamilyMembershipList,
  parseFamilyMembershipUpdateInput,
  parseFamilySearch,
} from "../schemas/family-schema";
import type {
  Family,
  FamilyInput,
  FamilyMembership,
  FamilyMembershipInput,
  FamilyMembershipUpdateInput,
} from "../types/family";
import { FamilyRepositoryError } from "../types/family-error";
import type { FamilyRepository } from "./family-repository";

export type FamilyInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: FamilyInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z.object({ code: z.string() }).passthrough();

function decodeCommandError(error: unknown): z.infer<typeof commandErrorSchema> | null {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }
  return commandErrorSchema.safeParse(error).data ?? null;
}

function repositoryErrorFrom(error: unknown): FamilyRepositoryError {
  if (error instanceof FamilyRepositoryError) return error;
  const code = decodeCommandError(error)?.code.toLocaleLowerCase("en-US") ?? "";
  if (code.includes("membership") && code.includes("conflict")) {
    return new FamilyRepositoryError("이미 이 가족에 등록된 고객입니다.", "conflict");
  }
  if (code.includes("membership") && code.includes("not_found")) {
    return new FamilyRepositoryError(
      "가족 구성원 관계를 찾을 수 없습니다.",
      "membership_not_found",
    );
  }
  if (code.includes("customer_not_found")) {
    return new FamilyRepositoryError("활성 고객을 찾을 수 없습니다.", "customer_not_found");
  }
  if (code.includes("family_not_found")) {
    return new FamilyRepositoryError("가족을 찾을 수 없습니다.", "not_found");
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new FamilyRepositoryError("입력 내용을 확인해 주세요.");
  }
  return new FamilyRepositoryError("가족 데이터를 처리하지 못했습니다.");
}

export class TauriFamilyRepository implements FamilyRepository {
  constructor(private readonly invokeCommand: FamilyInvoke = defaultInvoke) {}

  async list(search: string): Promise<Family[]> {
    const parsedSearch = parseFamilySearch(search);
    return this.execute(async () =>
      parseFamilyList(
        await this.invokeCommand<unknown>("list_families", {
          search: parsedSearch.length === 0 ? null : parsedSearch,
        }),
      ),
    );
  }

  async create(input: FamilyInput): Promise<Family> {
    const parsedInput = parseFamilyInput(input);
    return this.execute(async () =>
      parseFamily(
        await this.invokeCommand<unknown>("create_family", { input: parsedInput }),
      ),
    );
  }

  async update(id: string, input: FamilyInput): Promise<Family> {
    const parsedId = parseFamilyId(id);
    const parsedInput = parseFamilyInput(input);
    return this.execute(async () =>
      parseFamily(
        await this.invokeCommand<unknown>("update_family", {
          id: parsedId,
          input: parsedInput,
        }),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseFamilyId(id);
    await this.execute(async () => {
      const result = parseFamilyDeleteResult(
        await this.invokeCommand<unknown>("delete_family", { id: parsedId }),
      );
      if (result.id !== parsedId) {
        throw new FamilyRepositoryError("가족 삭제 응답을 확인할 수 없습니다.");
      }
    });
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    return this.execute(async () =>
      parseFamilyMembershipList(
        await this.invokeCommand<unknown>("list_family_memberships", {
          familyId: parsedFamilyId,
        }),
      ),
    );
  }

  async addMembership(
    familyId: string,
    input: FamilyMembershipInput,
  ): Promise<FamilyMembership> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const parsedInput = parseFamilyMembershipInput(input);
    return this.execute(async () =>
      parseFamilyMembership(
        await this.invokeCommand<unknown>("add_family_membership", {
          familyId: parsedFamilyId,
          input: parsedInput,
        }),
      ),
    );
  }

  async updateMembership(
    familyId: string,
    id: string,
    input: FamilyMembershipUpdateInput,
  ): Promise<FamilyMembership> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const parsedId = parseFamilyId(id);
    const parsedInput = parseFamilyMembershipUpdateInput(input);
    return this.execute(async () =>
      parseFamilyMembership(
        await this.invokeCommand<unknown>("update_family_membership", {
          familyId: parsedFamilyId,
          id: parsedId,
          input: parsedInput,
        }),
      ),
    );
  }

  async removeMembership(familyId: string, id: string): Promise<void> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const parsedId = parseFamilyId(id);
    await this.execute(async () => {
      const result = parseFamilyDeleteResult(
        await this.invokeCommand<unknown>("delete_family_membership", {
          familyId: parsedFamilyId,
          id: parsedId,
        }),
      );
      if (result.id !== parsedId) {
        throw new FamilyRepositoryError("가족 구성원 삭제 응답을 확인할 수 없습니다.");
      }
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw repositoryErrorFrom(error);
    }
  }
}
