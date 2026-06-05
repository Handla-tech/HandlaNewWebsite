import { AppDataSource } from '../../config/data-source';
import { User } from '../../modules/auth/entities/user.entity';
import { Testimonial } from '../../modules/testimonials/entities/testimonial.entity';
import { Client } from '../../modules/clients/entities/client.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { Task } from '../../modules/tasks/entities/task.entity';
import { Contract } from '../../modules/contracts/entities/contract.entity';
import { Invoice } from '../../modules/invoices/entities/invoice.entity';
import { InvoiceLineItem } from '../../modules/invoices/entities/invoice-line-item.entity';
import { Expense } from '../../modules/expenses/entities/expense.entity';
import {
  UserRole,
  ClientStatus,
  ProjectStatus,
  TaskStatus,
  ContractStatus,
  InvoicePaymentStatus,
  ExpenseType,
} from '../../common/enums';
import * as bcrypt from 'bcrypt';

async function runSeeders(): Promise<void> {
  console.log('🌱 Connecting to database...');
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  // MySQL: role enum values (ADMIN, EMPLOYEE, CLIENT, LEAD) are baked into
  // the column definition — no ALTER TYPE needed.

  const userRepo        = AppDataSource.getRepository(User);
  const testimonialRepo = AppDataSource.getRepository(Testimonial);
  const clientRepo      = AppDataSource.getRepository(Client);
  const projectRepo     = AppDataSource.getRepository(Project);
  const taskRepo        = AppDataSource.getRepository(Task);
  const contractRepo    = AppDataSource.getRepository(Contract);
  const invoiceRepo     = AppDataSource.getRepository(Invoice);
  const lineItemRepo    = AppDataSource.getRepository(InvoiceLineItem);
  const expenseRepo     = AppDataSource.getRepository(Expense);

  // ─── Seed Admin User ────────────────────────────────────────────────────────
  const existingAdmin = await userRepo.findOne({
    where: { email: 'admin@handla.com' },
  });

  let admin: User;

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@123456', 10);
    admin = userRepo.create({
      email: 'admin@handla.com',
      passwordHash,
      name: 'Handla Admin',
      role: UserRole.ADMIN,
    });
    await userRepo.save(admin);
    console.log('✅ Admin user created — admin@handla.com / Admin@123456');
  } else {
    admin = existingAdmin;
    console.log('ℹ️  Admin user already exists, skipping.');
  }

  // ─── Seed Sample Client ────────────────────────────────────────────────────
  const existingClientUser = await userRepo.findOne({
    where: { email: 'client@example.com' },
  });

  let clientUser: User;

  if (!existingClientUser) {
    const passwordHash = await bcrypt.hash('Client@123456', 10);
    clientUser = userRepo.create({
      email: 'client@example.com',
      passwordHash,
      name: 'Sample Client',
      role: UserRole.CLIENT,
    });
    await userRepo.save(clientUser);
    console.log('✅ Sample client created — client@example.com / Client@123456');
  } else {
    clientUser = existingClientUser;
    console.log('ℹ️  Sample client already exists, skipping.');
  }

  // ─── Seed Sample Employee ──────────────────────────────────────────────────
  const existingEmployee = await userRepo.findOne({
    where: { email: 'employee@handla.com' },
  });

  let employee: User;

  if (!existingEmployee) {
    const passwordHash = await bcrypt.hash('Employee@123456', 10);
    employee = userRepo.create({
      email: 'employee@handla.com',
      passwordHash,
      name: 'Sample Employee',
      role: UserRole.EMPLOYEE,
    });
    await userRepo.save(employee);
    console.log('✅ Sample employee created — employee@handla.com / Employee@123456');
  } else {
    employee = existingEmployee;
    console.log('ℹ️  Sample employee already exists, skipping.');
  }

  // ─── Seed Sample Lead ──────────────────────────────────────────────────────
  const existingLead = await userRepo.findOne({
    where: { email: 'lead@example.com' },
  });

  if (!existingLead) {
    const passwordHash = await bcrypt.hash('Lead@123456', 10);
    const lead = userRepo.create({
      email: 'lead@example.com',
      passwordHash,
      name: 'Sample Lead',
      role: UserRole.LEAD,
    });
    await userRepo.save(lead);
    console.log('✅ Sample lead created — lead@example.com / Lead@123456');
  } else {
    console.log('ℹ️  Sample lead already exists, skipping.');
  }

  // ─── ERP-13.2: Seed Client Record ─────────────────────────────────────────
  const existingClientRecord = await clientRepo.findOne({
    where: { userId: clientUser.id },
  });

  let clientRecord: Client;

  if (!existingClientRecord) {
    clientRecord = clientRepo.create({
      userId:  clientUser.id,
      ownerId: employee.id,
      company: 'Acme Corporation',
      status:  ClientStatus.ACTIVE,
      notes:   'Seed client record — linked to seed employee.',
    });
    await clientRepo.save(clientRecord);
    console.log('✅ Seed Client record created for client@example.com (owned by employee)');
  } else {
    clientRecord = existingClientRecord;
    console.log('ℹ️  Seed Client record already exists, skipping.');
  }

  // ─── ERP-13.2: Seed Project ────────────────────────────────────────────────
  const existingProject = await projectRepo.findOne({
    where: { clientId: clientRecord.id, title: 'Seed Project — Website Redesign' },
  });

  let project: Project;

  if (!existingProject) {
    project = projectRepo.create({
      title:       'Seed Project — Website Redesign',
      description: 'Full redesign of the corporate website with modern glassmorphism design.',
      clientId:    clientRecord.id,
      ownerId:     employee.id,
      status:      ProjectStatus.ACTIVE,
      startDate:   '2026-01-01',
      endDate:     '2026-06-30',
    });
    await projectRepo.save(project);
    console.log('✅ Seed Project created');
  } else {
    project = existingProject;
    console.log('ℹ️  Seed Project already exists, skipping.');
  }

  // ─── ERP-13.2: Seed Tasks ──────────────────────────────────────────────────
  const existingTaskCount = await taskRepo.count({ where: { projectId: project.id } });

  if (existingTaskCount === 0) {
    await taskRepo.save([
      taskRepo.create({
        title:      'Design wireframes',
        description:'Create low-fidelity wireframes for all pages.',
        projectId:  project.id,
        ownerId:    employee.id,
        assigneeId: employee.id,
        status:     TaskStatus.COMPLETED,
        dueDate:    '2026-02-15',
      }),
      taskRepo.create({
        title:      'Implement homepage',
        description:'Code the homepage with Tailwind + glassmorphism.',
        projectId:  project.id,
        ownerId:    employee.id,
        assigneeId: employee.id,
        status:     TaskStatus.PENDING,
        dueDate:    '2026-05-31',
      }),
    ]);
    console.log('✅ 2 Seed Tasks created (1 completed, 1 pending)');
  } else {
    console.log(`ℹ️  Seed Tasks already exist (${existingTaskCount}), skipping.`);
  }

  // ─── ERP-13.2: Seed Contract ───────────────────────────────────────────────
  const existingContract = await contractRepo.findOne({
    where: { clientId: clientRecord.id, title: 'Seed Service Agreement' },
  });

  let contract: Contract;

  if (!existingContract) {
    contract = contractRepo.create({
      title:    'Seed Service Agreement',
      body:     'This seed agreement confirms the scope of services for the Website Redesign project. All deliverables are outlined in Appendix A.',
      clientId: clientRecord.id,
      ownerId:  employee.id,
      status:   ContractStatus.SIGNED,
      sentAt:   new Date('2026-01-15'),
      signedAt: new Date('2026-01-20'),
      s3Key:    null,
      pdfUrl:   null,
    });
    await contractRepo.save(contract);
    console.log('✅ Seed Contract created (SIGNED)');
  } else {
    contract = existingContract;
    console.log('ℹ️  Seed Contract already exists, skipping.');
  }

  // ─── ERP-13.2: Seed Invoices ───────────────────────────────────────────────
  const existingInvoiceCount = await invoiceRepo.count({ where: { clientId: clientRecord.id } });

  let paidInvoice: Invoice | null = null;

  if (existingInvoiceCount === 0) {
    // Paid invoice
    paidInvoice = invoiceRepo.create({
      invoiceNumber: 'INV-2026-0001',
      clientId:      clientRecord.id,
      ownerId:       employee.id,
      subtotal:      5000,
      taxRate:       15,
      taxAmount:     750,
      total:         5750,
      currency:      'USD',
      paymentStatus: InvoicePaymentStatus.PAID,
      dueDate:       '2026-03-01',
      paidAt:        new Date('2026-02-25'),
      notes:         'Phase 1 — Design deliverables',
    });
    await invoiceRepo.save(paidInvoice);
    await lineItemRepo.save([
      lineItemRepo.create({
        invoiceId:   paidInvoice.id,
        description: 'Design wireframes (10 pages)',
        quantity:    10,
        unitPrice:   500,
        lineTotal:   5000,
        sortOrder:   0,
      }),
    ]);

    // Unpaid invoice
    const unpaidInvoice = invoiceRepo.create({
      invoiceNumber: 'INV-2026-0002',
      clientId:      clientRecord.id,
      ownerId:       employee.id,
      subtotal:      8000,
      taxRate:       15,
      taxAmount:     1200,
      total:         9200,
      currency:      'USD',
      paymentStatus: InvoicePaymentStatus.UNPAID,
      dueDate:       '2026-07-01',
      notes:         'Phase 2 — Development',
    });
    await invoiceRepo.save(unpaidInvoice);
    await lineItemRepo.save([
      lineItemRepo.create({
        invoiceId:   unpaidInvoice.id,
        description: 'Frontend development (80 hrs)',
        quantity:    80,
        unitPrice:   100,
        lineTotal:   8000,
        sortOrder:   0,
      }),
    ]);

    console.log('✅ 2 Seed Invoices created (1 PAID, 1 UNPAID)');
  } else {
    console.log(`ℹ️  Seed Invoices already exist (${existingInvoiceCount}), skipping.`);
    paidInvoice = await invoiceRepo.findOne({
      where: { invoiceNumber: 'INV-2026-0001' },
    });
  }

  // ─── ERP-13.2: Seed Expenses ───────────────────────────────────────────────
  const existingExpenseCount = await expenseRepo.count({ where: { ownerId: employee.id } });

  if (existingExpenseCount === 0) {
    // Manual income
    await expenseRepo.save(expenseRepo.create({
      type:        ExpenseType.INCOME,
      category:    'Consulting',
      amount:      2000,
      currency:    'USD',
      description: 'Additional consulting fee for UX review',
      expenseDate: '2026-01-10',
      ownerId:     employee.id,
    }));

    // Manual expense
    await expenseRepo.save(expenseRepo.create({
      type:        ExpenseType.EXPENSE,
      category:    'Software',
      amount:      299,
      currency:    'USD',
      description: 'Design tool subscription',
      expenseDate: '2026-01-05',
      ownerId:     employee.id,
    }));

    // Auto-income from paid invoice
    if (paidInvoice) {
      const existingAutoIncome = await expenseRepo.findOne({
        where: { invoiceId: paidInvoice.id },
      });
      if (!existingAutoIncome) {
        await expenseRepo.save(expenseRepo.create({
          type:        ExpenseType.INCOME,
          category:    'Invoice Payment',
          amount:      paidInvoice.total,
          currency:    'USD',
          description: `Auto-income: ${paidInvoice.invoiceNumber}`,
          expenseDate: new Date().toISOString().split('T')[0],
          ownerId:     employee.id,
          invoiceId:   paidInvoice.id,
        }));
        console.log('✅ Auto-income expense entry created for INV-2026-0001');
      }
    }

    console.log('✅ 3 Seed Expense entries created (1 manual income, 1 expense, 1 auto-income)');
  } else {
    console.log(`ℹ️  Seed Expenses already exist (${existingExpenseCount}), skipping.`);
  }

  // ─── Seed Testimonials ─────────────────────────────────────────────────────
  const testimonialCount = await testimonialRepo.count();

  if (testimonialCount === 0) {
    const testimonials = [
      {
        clientName: 'Ahmed Al-Rashid',
        clientCompany: 'TechVentures MENA',
        content:
          'Handla delivered our ERP system on time and within budget. The real-time support during development was exceptional. Highly recommended for any enterprise solution.',
        rating: 5,
        createdByAdminId: admin.id,
      },
      {
        clientName: 'Sara Mitchell',
        clientCompany: 'StartupLaunch Inc.',
        content:
          'We needed a full-stack web app in 6 weeks. Handla made it happen with outstanding quality. The chat support feature helped us communicate requirements seamlessly.',
        rating: 5,
        createdByAdminId: admin.id,
      },
      {
        clientName: 'Omar Khalil',
        clientCompany: 'Gulf Retail Group',
        content:
          'The custom CRM Handla built transformed our sales pipeline. Their bilingual (Arabic/English) support was a huge plus for our regional operations.',
        rating: 5,
        createdByAdminId: admin.id,
      },
      {
        clientName: 'Jennifer Park',
        clientCompany: 'CloudOps Ltd',
        content:
          'Excellent mobile app delivered with clean architecture and smooth UX. The team was responsive and professional throughout the entire project lifecycle.',
        rating: 4,
        createdByAdminId: admin.id,
      },
      {
        clientName: 'Khalid Al-Otaibi',
        clientCompany: 'Government Innovation Office',
        content:
          'Handla handled our government digital transformation project with highest security standards and full Arabic RTL support. A trusted partner for sensitive projects.',
        rating: 5,
        createdByAdminId: admin.id,
      },
      {
        clientName: 'Mia Thompson',
        clientCompany: 'E-Commerce Plus',
        content:
          'Our online store was rebuilt from scratch with blazing speed and beautiful design. File sharing in chat made design reviews effortless.',
        rating: 4,
        createdByAdminId: admin.id,
      },
    ];

    for (const t of testimonials) {
      const entity = testimonialRepo.create(t);
      await testimonialRepo.save(entity);
    }

    console.log(`✅ ${testimonials.length} testimonials seeded`);
  } else {
    console.log(`ℹ️  Testimonials already exist (${testimonialCount}), skipping.`);
  }

  await AppDataSource.destroy();
  console.log('🎉 Seeding complete!');
}

runSeeders().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
