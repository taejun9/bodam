export interface Customer {
  readonly id: string;
  readonly name: string;
  readonly birthDate: string | null;
  readonly gender: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly memo: string | null;
  readonly status: string | null;
  readonly isManaged: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerInput {
  readonly name: string;
  readonly birthDate: string | null;
  readonly gender: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly memo: string | null;
  readonly status: string | null;
  readonly isManaged: boolean;
}

export interface CustomerQuery {
  readonly search?: string | null;
}

export interface CustomerDeleteResult {
  readonly id: string;
}
