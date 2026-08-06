import { BrowserCustomerRepository } from "@/features/customer/repositories/browser-customer-repository";
import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";

import {
  parseConsultationId,
  parseConsultationInput,
} from "../schemas/consultation-schema";
import { sortConsultationsLatestFirst } from "../services/consultation-order";
import type { Consultation, ConsultationInput } from "../types/consultation";
import { ConsultationRepositoryError } from "../types/consultation-error";
import {
  consultationFromStored,
  parseStoredConsultation,
} from "./browser-consultation-mapping";
import {
  BrowserConsultationStorage,
  type ConsultationStoragePort,
} from "./browser-consultation-storage";
import type { ConsultationRepository } from "./consultation-repository";

export interface BrowserConsultationRepositoryOptions {
  readonly storage?: ConsultationStoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
  readonly customerRepository?: Pick<CustomerRepository, "list">;
}

const defaultStorage = (): ConsultationStoragePort => {
  if (typeof window === "undefined") {
    throw new ConsultationRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const consultationNotFound = (): ConsultationRepositoryError =>
  new ConsultationRepositoryError("상담을 찾을 수 없습니다.", "not_found");

const customerNotFound = (): ConsultationRepositoryError =>
  new ConsultationRepositoryError("활성 고객을 찾을 수 없습니다.", "customer_not_found");

export class BrowserConsultationRepository implements ConsultationRepository {
  private readonly store: BrowserConsultationStorage;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly customerRepository: Pick<CustomerRepository, "list">;

  constructor(options: BrowserConsultationRepositoryOptions = {}) {
    const storage = options.storage ?? defaultStorage();
    this.store = new BrowserConsultationStorage(storage);
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID());
    this.customerRepository = options.customerRepository
      ?? new BrowserCustomerRepository({ storage });
  }

  async list(customerId: string): Promise<Consultation[]> {
    const parsedCustomerId = parseConsultationId(customerId, "customerId");
    await this.ensureActiveCustomer(parsedCustomerId);
    return sortConsultationsLatestFirst(
      this.store.load()
        .filter((consultation) =>
          consultation.customerId === parsedCustomerId &&
          consultation.deletedAt === null
        )
        .map(consultationFromStored),
    );
  }

  async create(
    customerId: string,
    input: ConsultationInput,
  ): Promise<Consultation> {
    const parsedCustomerId = parseConsultationId(customerId, "customerId");
    const parsedInput = parseConsultationInput(input);
    await this.ensureActiveCustomer(parsedCustomerId);
    const consultations = this.store.load();
    const id = this.createId();
    if (consultations.some((consultation) => consultation.id === id)) {
      throw new ConsultationRepositoryError("상담 식별자를 생성하지 못했습니다.");
    }
    const timestamp = this.now();
    const created = parseStoredConsultation({
      id,
      customerId: parsedCustomerId,
      ...parsedInput,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.store.save([...consultations, created]);
    return consultationFromStored(created);
  }

  async update(id: string, input: ConsultationInput): Promise<Consultation> {
    const parsedId = parseConsultationId(id);
    const parsedInput = parseConsultationInput(input);
    const consultations = this.store.load();
    const index = consultations.findIndex((consultation) =>
      consultation.id === parsedId && consultation.deletedAt === null
    );
    const existing = consultations[index];
    if (index < 0 || existing === undefined) throw consultationNotFound();
    await this.ensureVisibleCustomer(existing.customerId);
    const updated = parseStoredConsultation({
      ...existing,
      ...parsedInput,
      updatedAt: this.now(),
    });
    consultations[index] = updated;
    this.store.save(consultations);
    return consultationFromStored(updated);
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseConsultationId(id);
    const consultations = this.store.load();
    const index = consultations.findIndex((consultation) =>
      consultation.id === parsedId && consultation.deletedAt === null
    );
    const existing = consultations[index];
    if (index < 0 || existing === undefined) throw consultationNotFound();
    await this.ensureVisibleCustomer(existing.customerId);
    const timestamp = this.now();
    consultations[index] = parseStoredConsultation({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.store.save(consultations);
  }

  private async ensureActiveCustomer(customerId: string): Promise<void> {
    let customers: Awaited<ReturnType<CustomerRepository["list"]>>;
    try {
      customers = await this.customerRepository.list({});
    } catch {
      throw new ConsultationRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
    if (!customers.some((customer) => customer.id === customerId)) {
      throw customerNotFound();
    }
  }

  private async ensureVisibleCustomer(customerId: string): Promise<void> {
    try {
      await this.ensureActiveCustomer(customerId);
    } catch (error) {
      if (
        error instanceof ConsultationRepositoryError &&
        error.code === "customer_not_found"
      ) {
        throw consultationNotFound();
      }
      throw error;
    }
  }
}
