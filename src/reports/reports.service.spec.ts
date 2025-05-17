import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import fs from 'fs/promises';
import path from 'path';
import { Report, ReportStatus, ReportType } from '../../db/models/Report';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('report generation', () => {
    it('should generate report files in the output directory with the correct requestId', async () => {
      // Generate a new report
      const requestId = await service.generateIdAndStoreReportEntries();

      // Process all reports manually
      await service.accounts(requestId);
      await service.yearly(requestId);
      await service.fs(requestId);

      // Check if all reports were marked as completed in the database
      const accountsReport = await Report.findOne({
        where: { requestId, type: ReportType.accounts }
      });
      const yearlyReport = await Report.findOne({
        where: { requestId, type: ReportType.yearly }
      });
      const fsReport = await Report.findOne({
        where: { requestId, type: ReportType.fs }
      });

      // Verify all reports exist
      expect(accountsReport).not.toBeNull();
      expect(yearlyReport).not.toBeNull();
      expect(fsReport).not.toBeNull();

      // Verify all reports are completed
      expect(accountsReport!.status).toBe(ReportStatus.completed);
      expect(yearlyReport!.status).toBe(ReportStatus.completed);
      expect(fsReport!.status).toBe(ReportStatus.completed);

      // Verify output paths
      const expectedOutputDir = path.join('out', requestId);
      expect(accountsReport!.outputPath).toBe(`${expectedOutputDir}/accounts.csv`);
      expect(yearlyReport!.outputPath).toBe(`${expectedOutputDir}/yearly.csv`);
      expect(fsReport!.outputPath).toBe(`${expectedOutputDir}/fs.csv`);

      // Check if the files exist on the file system
      const accountsFileExists = await fileExists(`${expectedOutputDir}/accounts.csv`);
      const yearlyFileExists = await fileExists(`${expectedOutputDir}/yearly.csv`);
      const fsFileExists = await fileExists(`${expectedOutputDir}/fs.csv`);

      expect(accountsFileExists).toBe(true);
      expect(yearlyFileExists).toBe(true);
      expect(fsFileExists).toBe(true);

      // Optional: Clean up files after test
      // await fs.rmdir(path.join('out', requestId), { recursive: true });
    }, 60000); // Increase timeout to handle processing time
  });
});

// Helper function to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
