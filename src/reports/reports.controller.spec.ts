import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  // Mock ReportsService
  const mockReportsService = {
    state: jest.fn(),
    generateIdAndStoreReportEntries: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService
        }
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
    
    // Reset mock function calls and return values before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reportStatus', () => {
    it('should return report status for all report types', async () => {
      // Arrange
      const mockRequestId = 'test-uuid-1234';
      mockReportsService.state.mockImplementation((type, requestId) => {
        return Promise.resolve(`finished in 0.${type === 'accounts' ? '69' : type === 'yearly' ? '48' : '71'}`);
      });

      // Act
      const result = await controller.reportStatus(mockRequestId);

      // Assert
      expect(result).toEqual({
        requestId: mockRequestId,
        'accounts.csv': 'finished in 0.69',
        'yearly.csv': 'finished in 0.48',
        'fs.csv': 'finished in 0.71'
      });

      expect(mockReportsService.state).toHaveBeenCalledTimes(3);
      expect(mockReportsService.state).toHaveBeenCalledWith('accounts', mockRequestId);
      expect(mockReportsService.state).toHaveBeenCalledWith('yearly', mockRequestId);
      expect(mockReportsService.state).toHaveBeenCalledWith('fs', mockRequestId);
    });

    it('should handle different status results for different report types', async () => {
      // Arrange
      const mockRequestId = 'test-uuid-5678';
      mockReportsService.state
        .mockImplementationOnce(() => Promise.resolve('finished in 0.69')) // accounts
        .mockImplementationOnce(() => Promise.resolve('processing')) // yearly
        .mockImplementationOnce(() => Promise.resolve('pending')); // fs

      // Act
      const result = await controller.reportStatus(mockRequestId);

      // Assert
      expect(result).toEqual({
        requestId: mockRequestId,
        'accounts.csv': 'finished in 0.69',
        'yearly.csv': 'processing',
        'fs.csv': 'pending'
      });
      
      expect(mockReportsService.state).toHaveBeenCalledTimes(3);
    });

    it('should propagate errors from service', async () => {
      // Arrange
      const mockRequestId = 'invalid-id';
      const errorMessage = 'Report not found';
      mockReportsService.state.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(controller.reportStatus(mockRequestId)).rejects.toThrow(errorMessage);
    });
  });

  describe('generate', () => {
    it('should generate reports and return requestId', async () => {
      // Arrange
      const mockRequestId = 'new-report-uuid-1234';
      mockReportsService.generateIdAndStoreReportEntries.mockResolvedValue(mockRequestId);

      // Act
      const result = await controller.generate();

      // Assert
      expect(result).toEqual({
        message: 'Report generation queued - check status with the provided requestId',
        requestId: mockRequestId
      });
      
      expect(mockReportsService.generateIdAndStoreReportEntries).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from generateIdAndStoreReportEntries', async () => {
      // Arrange
      const errorMessage = 'Failed to generate report';
      mockReportsService.generateIdAndStoreReportEntries.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(controller.generate()).rejects.toThrow(errorMessage);
    });
  });
});
