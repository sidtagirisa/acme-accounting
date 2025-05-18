import {
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../../db/models/Ticket';
import { IsEnum, IsInt, IsNotEmpty, IsNumber } from 'class-validator';

export class NewTicketDto {
  @IsEnum(TicketType)
  @IsNotEmpty()
  type: TicketType;

  @IsNumber()
  @IsNotEmpty()
  companyId: number;
}

export class TicketDto {
  @IsInt()
  @IsNotEmpty()
  id: number;

  @IsEnum(TicketType)
  @IsNotEmpty()
  type: TicketType;

  @IsInt()
  @IsNotEmpty()
  companyId: number;

  @IsInt()
  @IsNotEmpty()
  assigneeId: number;

  @IsEnum(TicketStatus)
  @IsNotEmpty()
  status: TicketStatus;

  @IsEnum(TicketCategory)
  @IsNotEmpty()
  category: TicketCategory;
}
