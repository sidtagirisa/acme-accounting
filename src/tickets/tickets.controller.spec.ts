import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { DbModule } from '../db.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [TicketsService],
      imports: [DbModule],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    service = module.get<TicketsService>(TicketsService);

    // Clean up database before each test to ensure isolation
    await Ticket.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Company.destroy({ where: {} });
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();

    const res = await controller.findAll();
    console.log(res);
  });

  describe('create', () => {
    describe('managementReport', () => {
      it('creates managementReport ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple accountants, assign the last one', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const user2 = await User.create({
          name: 'Test User 2',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user2.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no accountant, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role accountant to create a ticket`,
          ),
        );
      });
    });

    describe('registrationAddressChange', () => {
      it('creates registrationAddressChange ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple secretaries, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User 2',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role corporateSecretary. Cannot create a ticket`,
          ),
        );
      });

      it('if there is no secretary, but has a director as backup, create registrationAddressChange ticket with director', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Test Director',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no secretary and no director, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role corporateSecretary or backup role director to create a ticket`,
          ),
        );
      });

      it('prevents creating duplicate open registrationAddressChange tickets', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        // Create first ticket
        await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        // Attempt to create a duplicate should fail
        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Company with ID ${company.id} already has an open registrationAddressChange ticket`,
          ),
        );
      });
    });

    describe('strikeOff', () => {
      it('creates strikeOff ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Test Director',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        expect(ticket.category).toBe(TicketCategory.management);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple directors, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test Director 1',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Test Director 2',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          ),
        );
      });

      it('if there is no director, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role director to create a ticket`,
          ),
        );
      });

      it('resolves all other open tickets when creating a strikeOff ticket', async () => {
        const company = await Company.create({ name: 'test' });
        
        // Create necessary users
        const accountant = await User.create({
          name: 'Test Accountant',
          role: UserRole.accountant,
          companyId: company.id,
        });
        
        const secretary = await User.create({
          name: 'Test Secretary',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        
        const director = await User.create({
          name: 'Test Director',
          role: UserRole.director,
          companyId: company.id,
        });

        // Create other tickets first
        await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        // Create strikeOff ticket
        await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        // Verify previous tickets are resolved
        const tickets = await service.findAll();
        const openTickets = tickets.filter(t => t.status === TicketStatus.open);
        const resolvedTickets = tickets.filter(t => t.status === TicketStatus.resolved);

        // Only the strikeOff ticket should be open
        expect(openTickets.length).toBe(1);
        expect(openTickets[0].type).toBe(TicketType.strikeOff);
        
        // The other two tickets should be resolved
        expect(resolvedTickets.length).toBe(2);
        expect(resolvedTickets.some(t => t.type === TicketType.managementReport)).toBe(true);
        expect(resolvedTickets.some(t => t.type === TicketType.registrationAddressChange)).toBe(true);
      });
    });
  });
});
