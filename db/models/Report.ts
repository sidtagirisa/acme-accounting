import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum ReportType {
  accounts = 'accounts',
  yearly = 'yearly',
  fs = 'fs',
}

export enum ReportStatus {
  pending = 'pending',
  processing = 'processing',
  completed = 'completed',
  error = 'error',
}

// report can also be linked to a company and files can be fetched based on companyId
// but for now we are not linking it to a company

@Table({ tableName: 'reports' })
export class Report extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column
  declare id: number;

  @Column
  declare requestId: string;

  @Column
  declare type: ReportType;

  @Column
  declare status: ReportStatus;

  @Column(DataType.TEXT)
  declare errorMessage?: string;

  @Column
  declare outputPath?: string;

  @Column
  declare processingTimeMs?: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
