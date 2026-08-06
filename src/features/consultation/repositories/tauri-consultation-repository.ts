import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseConsultation,
  parseConsultationDeleteResult,
  parseConsultationId,
  parseConsultationInput,
  parseConsultationList,
} from "../schemas/consultation-schema";
import { sortConsultationsLatestFirst } from "../services/consultation-order";
import type { Consultation, ConsultationInput } from "../types/consultation";
import { ConsultationRepositoryError } from "../types/consultation-error";
import type { ConsultationRepository } from "./consultation-repository";

export type ConsultationInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: ConsultationInvoke = <T>(
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

function repositoryErrorFrom(error: unknown): ConsultationRepositoryError {
  if (error instanceof ConsultationRepositoryError) return error;
  const code = decodeCommandError(error)?.code.toLocaleLowerCase("en-US") ?? "";
  if (code.includes("customer_not_found")) {
    return new ConsultationRepositoryError(
      "활성 고객을 찾을 수 없습니다.",
      "customer_not_found",
    );
  }
  if (code.includes("consultation_not_found")) {
    return new ConsultationRepositoryError("상담을 찾을 수 없습니다.", "not_found");
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new ConsultationRepositoryError("입력 내용을 확인해 주세요.");
  }
  return new ConsultationRepositoryError("상담 데이터를 처리하지 못했습니다.");
}

export class TauriConsultationRepository implements ConsultationRepository {
  constructor(private readonly invokeCommand: ConsultationInvoke = defaultInvoke) {}

  async list(customerId: string): Promise<Consultation[]> {
    const parsedCustomerId = parseConsultationId(customerId, "customerId");
    return this.execute(async () =>
      sortConsultationsLatestFirst(parseConsultationList(
        await this.invokeCommand<unknown>("list_consultations", {
          customerId: parsedCustomerId,
        }),
      ))
    );
  }

  async create(
    customerId: string,
    input: ConsultationInput,
  ): Promise<Consultation> {
    const parsedCustomerId = parseConsultationId(customerId, "customerId");
    const parsedInput = parseConsultationInput(input);
    return this.execute(async () =>
      parseConsultation(
        await this.invokeCommand<unknown>("create_consultation", {
          customerId: parsedCustomerId,
          input: parsedInput,
        }),
      )
    );
  }

  async update(id: string, input: ConsultationInput): Promise<Consultation> {
    const parsedId = parseConsultationId(id);
    const parsedInput = parseConsultationInput(input);
    return this.execute(async () =>
      parseConsultation(
        await this.invokeCommand<unknown>("update_consultation", {
          id: parsedId,
          input: parsedInput,
        }),
      )
    );
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseConsultationId(id);
    await this.execute(async () => {
      const result = parseConsultationDeleteResult(
        await this.invokeCommand<unknown>("delete_consultation", { id: parsedId }),
      );
      if (result.id !== parsedId) {
        throw new ConsultationRepositoryError("상담 삭제 응답을 확인할 수 없습니다.");
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
