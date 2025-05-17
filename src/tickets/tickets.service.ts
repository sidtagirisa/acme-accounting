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
  backupUserRole?: UserRole;
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
      backupUserRole: UserRole.director,
    },
    [TicketType.strikeOff]: {
      category: TicketCategory.management,
      userRole: UserRole.director
    },
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
  
  private isRestrictedRole(role: UserRole): boolean {
    return role === UserRole.corporateSecretary || role === UserRole.director;
  }

  private async tryFindAssignee(companyId: number, role: UserRole): Promise<User | null> {
    const assignees = await User.findAll({
      where: { companyId, role },
      order: [['createdAt', 'DESC']],
    });
    
    if (assignees.length === 0) {
      return null;
    }
    
    if (this.isRestrictedRole(role) && assignees.length > 1) {
      throw new ConflictException(
        `Multiple users with role ${role}. Cannot create a ticket`
      );
    }
    
    return assignees[0];
  }

  async findAssignee(ticketType: TicketType, companyId: number): Promise<User> {
    const { userRole, backupUserRole } = this.getTicketTypeMapping(ticketType);
    
    const primaryAssignee = await this.tryFindAssignee(companyId, userRole);
    if (primaryAssignee) {
      return primaryAssignee;
    }
    
    if (backupUserRole) {
      const backupAssignee = await this.tryFindAssignee(companyId, backupUserRole);
      if (backupAssignee) {
        return backupAssignee
      }
    }
    
    // No assignee found with either role
    const errorMessage = backupUserRole 
      ? `Cannot find user with role ${userRole} or backup role ${backupUserRole} to create a ticket`
      : `Cannot find user with role ${userRole} to create a ticket`;
    throw new ConflictException(errorMessage);
  }

  private async checkForDuplicateTicket(type: TicketType, companyId: number): Promise<void> {
    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: {
          companyId,
          type,
          status: TicketStatus.open,
        },
      });
      
      if (existingTicket) {
        throw new ConflictException(
          `Company with ID ${companyId} already has an open registrationAddressChange ticket`
        );
      }
    }
  }

  async createTicket(type: TicketType, companyId: number): Promise<Ticket> {
    await this.checkForDuplicateTicket(type, companyId);
    
    const { category } = this.getTicketTypeMapping(type);
    const assignee = await this.findAssignee(type, companyId);
    
    return await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });
  }
}