import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "../types/coverage-benchmark";

export interface CoverageBenchmarkRepository {
  list(): Promise<CoverageBenchmark[]>;
  create(input: CoverageBenchmarkInput): Promise<CoverageBenchmark>;
  update(id: string, input: CoverageBenchmarkInput): Promise<CoverageBenchmark>;
  remove(id: string): Promise<void>;
}
