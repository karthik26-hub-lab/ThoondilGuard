import type { AnalysisInput, AnalysisProviderResult } from '../../../types/analysis.js';

export interface AnalysisProvider {
  readonly name: string;
  analyze(input: AnalysisInput): AnalysisProviderResult | Promise<AnalysisProviderResult>;
}
