import { Injectable, ConflictException } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface TicketTypeMapping {
  category: TicketCategory;
  userRole: UserRole;
}

@Injectable()
export class TicketsService {
  
  private ticketTypeMapping: Record<TicketType, TicketTypeMapping> = {
    [TicketType.managementReport]: {
      category: TicketCategory.accounting,
      userRole: UserRole.accountant,
    },
    [TicketType.registrationAddressChange]: {
      category: TicketCategory.corporate,
      userRole: UserRole.corporateSecretary,
    }
  };

  getTicketTypeMapping(type: TicketType): TicketTypeMapping {
    const rule = this.ticketTypeMapping[type];
    if (!rule) {
        throw new ConflictException(`No rule found for ticket type: ${type}`);
    }
    return rule;
  }

  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }
}