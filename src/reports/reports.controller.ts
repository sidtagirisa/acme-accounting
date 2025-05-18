import { Controller, Get, Post, HttpCode, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get(':requestId')
  async reportStatus(@Param('requestId') requestId: string) {
    return {
      requestId,
      'accounts.csv': await this.reportsService.state('accounts', requestId),
      'yearly.csv': await this.reportsService.state('yearly', requestId),
      'fs.csv': await this.reportsService.state('fs', requestId),
    };
  }

  @Post()
  @HttpCode(202)
  async generate() {
    // Service will pick up and process these entries via polling
    const requestId =
      await this.reportsService.generateIdAndStoreReportEntries();

    return {
      message:
        'Report generation queued - check status with the provided requestId',
      requestId,
    };
  }
}
