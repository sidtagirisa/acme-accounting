import { Injectable, OnModuleInit } from '@nestjs/common';
import fsPromises from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import { Report, ReportStatus, ReportType } from '../../db/models/Report';

@Injectable()
export class ReportsService implements OnModuleInit {
  private isProcessing = false;
  // choosing a reasonable interval to avoid overloading the system, ideally this should be a seperate job processing reports
  // in a queue system, but for simplicity, I choose a polling mechanism
  private pollingInterval = 60000; // 60 seconds

  onModuleInit() {
    // Prevent polling during tests to avoid interference
    if (process.env.NODE_ENV !== 'test') {
      this.startPolling();
    }
  }

  private startPolling() {
    setInterval(() => {
      // Wrap the async call in a non-async function
      this.processPendingReports().catch((error) => {
        console.error('Error in polling process:', error);
      });
    }, this.pollingInterval);

    console.log(
      'Report processing service started. Polling for pending reports...',
    );
  }

  private async processPendingReports() {
    if (this.isProcessing) {
      return; // wait for the current processing to finish
    }

    try {
      this.isProcessing = true;

      const pendingReports = await Report.findAll({
        attributes: ['requestId', 'type'],
        where: { status: ReportStatus.pending },
        order: [['createdAt', 'ASC']],
        limit: 10, // Process only 10 reports in each polling cycle to avoid overloading the system
      });

      if (pendingReports && pendingReports.length > 0) {
        for (const report of pendingReports) {
          const { requestId, type } = report;
          console.log(
            `Processing report type: ${type} for requestId: ${requestId}`,
          );
          await this.processReport(requestId, type);
        }
      }
    } catch (error) {
      console.error('Error processing pending reports:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processReport(requestId: string, type: ReportType) {
    try {
      switch (type) {
        case ReportType.accounts:
          await this.accounts(requestId);
          break;
        case ReportType.yearly:
          await this.yearly(requestId);
          break;
        case ReportType.fs:
          await this.fs(requestId);
          break;
        default:
          console.error(`Unknown report type: ${String(type)}`);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error processing report type ${String(type)} for requestId ${requestId}:`,
        error,
      );
      await Report.update(
        {
          status: ReportStatus.error,
          errorMessage,
        },
        {
          where: { requestId, type },
        },
      );
    }
  }

  async state(scope: string, requestId?: string) {
    const report = await Report.findOne({
      where: {
        requestId,
        type: scope,
      },
    });

    if (report) {
      return report.status === ReportStatus.completed
        ? `finished in ${((report.processingTimeMs || 0) / 1000).toFixed(2)}`
        : report.status;
    }

    return 'not found';
  }

  async generateIdAndStoreReportEntries(): Promise<string> {
    const requestId = uuidv4();

    // Create report entries in database for each report type
    await Promise.all([
      Report.create({
        requestId,
        type: ReportType.accounts,
        status: ReportStatus.pending,
      }),
      Report.create({
        requestId,
        type: ReportType.yearly,
        status: ReportStatus.pending,
      }),
      Report.create({
        requestId,
        type: ReportType.fs,
        status: ReportStatus.pending,
      }),
    ]);

    return requestId;
  }

  async accounts(requestId: string) {
    await Report.update(
      { status: ReportStatus.processing },
      {
        where: { requestId, type: ReportType.accounts },
      },
    );

    const start = performance.now();

    const tmpDir = 'tmp';
    const outputDir = `out/${requestId}`;
    const outputFile = `${outputDir}/accounts.csv`;
    const accountBalances: Record<string, number> = {};

    try {
      await fsPromises.access(outputDir);
    } catch {
      await fsPromises.mkdir(outputDir, { recursive: true });
    }

    const files = await fsPromises.readdir(tmpDir);
    for (const file of files) {
      if (file.endsWith('.csv')) {
        const fileContent = await fsPromises.readFile(
          path.join(tmpDir, file),
          'utf-8',
        );
        const lines = fileContent.trim().split('\n');
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          if (!accountBalances[account]) {
            accountBalances[account] = 0;
          }
          accountBalances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      }
    }
    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }
    await fsPromises.writeFile(outputFile, output.join('\n'));

    const processingTime = Math.round(performance.now() - start);
    await Report.update(
      {
        status: ReportStatus.completed,
        processingTimeMs: processingTime,
        outputPath: outputFile,
      },
      {
        where: { requestId, type: ReportType.accounts },
      },
    );
  }

  async yearly(requestId: string) {
    await Report.update(
      { status: ReportStatus.processing },
      {
        where: { requestId, type: ReportType.yearly },
      },
    );

    const start = performance.now();

    const tmpDir = 'tmp';
    const outputDir = `out/${requestId}`;
    const outputFile = `${outputDir}/yearly.csv`;
    const cashByYear: Record<string, number> = {};

    try {
      await fsPromises.access(outputDir);
    } catch {
      await fsPromises.mkdir(outputDir, { recursive: true });
    }

    const files = await fsPromises.readdir(tmpDir);
    for (const file of files) {
      if (file.endsWith('.csv') && file !== 'yearly.csv') {
        const fileContent = await fsPromises.readFile(
          path.join(tmpDir, file),
          'utf-8',
        );
        const lines = fileContent.trim().split('\n');
        for (const line of lines) {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    }
    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });
    await fsPromises.writeFile(outputFile, output.join('\n'));

    const processingTime = Math.round(performance.now() - start);
    await Report.update(
      {
        status: ReportStatus.completed,
        processingTimeMs: processingTime,
        outputPath: outputFile,
      },
      {
        where: { requestId, type: ReportType.yearly },
      },
    );
  }

  async fs(requestId: string) {
    await Report.update(
      { status: ReportStatus.processing },
      {
        where: { requestId, type: ReportType.fs },
      },
    );

    const start = performance.now();

    const tmpDir = 'tmp';
    const outputDir = `out/${requestId}`;
    const outputFile = `${outputDir}/fs.csv`;
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    try {
      await fsPromises.access(outputDir);
    } catch {
      await fsPromises.mkdir(outputDir, { recursive: true });
    }

    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }
    const files = await fsPromises.readdir(tmpDir);
    for (const file of files) {
      if (file.endsWith('.csv') && file !== 'fs.csv') {
        const fileContent = await fsPromises.readFile(
          path.join(tmpDir, file),
          'utf-8',
        );
        const lines = fileContent.trim().split('\n');

        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');

          if (account in balances) {
            balances[account] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    }

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    await fsPromises.writeFile(outputFile, output.join('\n'));

    const processingTime = Math.round(performance.now() - start);
    await Report.update(
      {
        status: ReportStatus.completed,
        processingTimeMs: processingTime,
        outputPath: outputFile,
      },
      {
        where: { requestId, type: ReportType.fs },
      },
    );
  }
}
