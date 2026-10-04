import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { Report, type ReportDocument } from '../models/Report.js';
import type { CreateReportInput } from '../types/report.js';
import { AppError } from '../utils/AppError.js';

export interface CreatedReportResponse {
  referenceId: string;
  status: ReportDocument['status'];
  createdAt: Date;
}

export interface CitizenReportResponse {
  referenceId: string;
  status: ReportDocument['status'];
  riskLevel: ReportDocument['riskLevel'];
  category?: ReportDocument['category'];
  reportedAt: Date;
  updatedAt: Date;
}

function makeReferenceId(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomInt(0, 100_000).toString().padStart(5, '0');
  return `TG-${year}-${suffix}`;
}

function isReferenceIdDuplicate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) {
    return false;
  }

  const duplicateError = error as { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  return duplicateError.keyPattern?.referenceId !== undefined
    || duplicateError.keyValue?.referenceId !== undefined;
}

function mapCreateError(error: unknown): never {
  if (error instanceof mongoose.Error.ValidationError) {
    throw new AppError('Invalid report data', 400);
  }
  if (isReferenceIdDuplicate(error)) {
    throw new AppError('Unable to generate a unique report reference. Please retry.', 503);
  }
  throw new AppError('Database unavailable', 503);
}

export async function createReport(input: CreateReportInput): Promise<CreatedReportResponse> {
  const { extractedText, ...reportInput } = input;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const report = new Report({
      ...reportInput,
      ...(extractedText ? { extractedText } : {}),
      referenceId: makeReferenceId(),
      status: 'NEW',
      riskLevel: null,
      reportedAt: new Date(),
    });

    try {
      await report.save();
      return {
        referenceId: report.referenceId,
        status: report.status,
        createdAt: report.createdAt,
      };
    } catch (error) {
      if (isReferenceIdDuplicate(error) && attempt < 4) continue;
      mapCreateError(error);
    }
  }

  throw new AppError('Unable to create report', 503);
}

export async function getCitizenReport(referenceId: string): Promise<CitizenReportResponse | null> {
  try {
    const report = await Report.findOne({ referenceId })
      .select({
        _id: 0,
        referenceId: 1,
        status: 1,
        riskLevel: 1,
        category: 1,
        reportedAt: 1,
        updatedAt: 1,
      })
      .lean()
      .exec();

    if (!report) return null;

    return {
      referenceId: report.referenceId,
      status: report.status,
      riskLevel: report.riskLevel,
      ...(report.category ? { category: report.category } : {}),
      reportedAt: report.reportedAt,
      updatedAt: report.updatedAt,
    };
  } catch {
    throw new AppError('Database unavailable', 503);
  }
}
