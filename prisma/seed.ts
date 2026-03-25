import {
  PrismaClient,
  UserType,
  FunctionalRoleCode,
  BillingModel,
  ProjectStatus,
  EstimateStatus,
  TimeEntryStatus,
  BillingTransactionType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const managerHash = await bcrypt.hash("Manager@123", 10);
  const leadHash = await bcrypt.hash("Lead@123", 10);
  const employeeHash = await bcrypt.hash("Employee@123", 10);
  const viewerHash = await bcrypt.hash("Viewer@123", 10);

  // Users
  const admin = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      passwordHash: adminHash,
      fullName: "Admin User",
      userType: UserType.ADMIN,
      functionalRole: FunctionalRoleCode.PROJECT_MANAGER,
      phoneNumber: "9999999991",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@company.com" },
    update: {},
    create: {
      email: "manager@company.com",
      passwordHash: managerHash,
      fullName: "Delivery Manager",
      userType: UserType.MANAGER,
      functionalRole: FunctionalRoleCode.PROJECT_MANAGER,
      phoneNumber: "9999999992",
    },
  });

  const teamLead = await prisma.user.upsert({
    where: { email: "lead@company.com" },
    update: {},
    create: {
      email: "lead@company.com",
      passwordHash: leadHash,
      fullName: "Team Lead One",
      userType: UserType.TEAM_LEAD,
      functionalRole: FunctionalRoleCode.DEVELOPER,
      phoneNumber: "9999999993",
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { email: "dev1@company.com" },
    update: {},
    create: {
      email: "dev1@company.com",
      passwordHash: employeeHash,
      fullName: "Developer One",
      userType: UserType.EMPLOYEE,
      functionalRole: FunctionalRoleCode.DEVELOPER,
      phoneNumber: "9999999994",
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: "qa1@company.com" },
    update: {},
    create: {
      email: "qa1@company.com",
      passwordHash: employeeHash,
      fullName: "QA One",
      userType: UserType.EMPLOYEE,
      functionalRole: FunctionalRoleCode.QA,
      phoneNumber: "9999999995",
    },
  });

  const reportViewer = await prisma.user.upsert({
    where: { email: "viewer@company.com" },
    update: {},
    create: {
      email: "viewer@company.com",
      passwordHash: viewerHash,
      fullName: "Report Viewer",
      userType: UserType.REPORT_VIEWER,
      functionalRole: FunctionalRoleCode.OTHER,
      phoneNumber: "9999999996",
    },
  });

  // Client
  const client = await prisma.client.upsert({
    where: { code: "WB" },
    update: {},
    create: {
      name: "Warner Bros",
      code: "WB",
      isActive: true,
    },
  });

  // Movie (optional project linkage use-case)
  const movie = await prisma.movie.create({
    data: {
      clientId: client.id,
      title: "Sample Movie",
      code: "SM001",
      isActive: true,
    },
  }).catch(async () => {
    return prisma.movie.findFirstOrThrow({
      where: { code: "SM001" },
    });
  });

  // Countries
  const india = await prisma.country.upsert({
    where: { isoCode: "IN" },
    update: {},
    create: {
      name: "India",
      isoCode: "IN",
      isActive: true,
    },
  });

  const usa = await prisma.country.upsert({
    where: { isoCode: "US" },
    update: {},
    create: {
      name: "United States",
      isoCode: "US",
      isActive: true,
    },
  });

  // Employee Group
  const deliveryGroup = await prisma.employeeGroup.upsert({
    where: { code: "CORE-DEL" },
    update: {},
    create: {
      name: "Core Delivery",
      code: "CORE-DEL",
      description: "Primary implementation and delivery team",
      isActive: true,
    },
  });

  // User ↔ Group mappings
  for (const user of [teamLead, employee1, employee2]) {
    await prisma.userEmployeeGroup.upsert({
      where: {
        userId_employeeGroupId: {
          userId: user.id,
          employeeGroupId: deliveryGroup.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        employeeGroupId: deliveryGroup.id,
      },
    });
  }

  // Employee ↔ Team Lead mappings
  for (const employee of [employee1, employee2]) {
    await prisma.employeeTeamLead.upsert({
      where: {
        employeeId_teamLeadId: {
          employeeId: employee.id,
          teamLeadId: teamLead.id,
        },
      },
      update: {},
      create: {
        employeeId: employee.id,
        teamLeadId: teamLead.id,
        assignedById: manager.id,
      },
    });
  }

  // Project
  const project = await prisma.project.upsert({
    where: { code: "PMS-WB-001" },
    update: {},
    create: {
      clientId: client.id,
      movieId: movie.id,
      code: "PMS-WB-001",
      name: "WB Global Marketing Platform",
      description: "Seeded fixed monthly project",
      billingModel: BillingModel.FIXED_MONTHLY,
      status: ProjectStatus.ACTIVE,
      fixedMonthlyHours: 100,
      startDate: new Date(),
      createdById: admin.id,
      updatedById: admin.id,
      isActive: true,
    },
  });

  // Project ↔ Countries
  for (const country of [india, usa]) {
    await prisma.projectCountry.upsert({
      where: {
        projectId_countryId: {
          projectId: project.id,
          countryId: country.id,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        countryId: country.id,
      },
    });
  }

  // Project ↔ Employee Group
  await prisma.projectEmployeeGroup.upsert({
    where: {
      projectId_employeeGroupId: {
        projectId: project.id,
        employeeGroupId: deliveryGroup.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      employeeGroupId: deliveryGroup.id,
    },
  });

  // Estimate
  const estimate = await prisma.estimate.create({
    data: {
      projectId: project.id,
      employeeId: employee1.id,
      countryId: india.id,
      workDate: new Date(),
      estimatedMinutes: 480,
      notes: "Homepage redesign estimate",
      status: EstimateStatus.SUBMITTED,
    },
  });

  // Estimate Review
  await prisma.estimateReview.create({
    data: {
      estimateId: estimate.id,
      reviewerId: teamLead.id,
      decisionStatus: EstimateStatus.APPROVED,
      remarks: "Looks reasonable",
    },
  });

  // Time Entry
  const timeEntry = await prisma.timeEntry.create({
    data: {
      projectId: project.id,
      employeeId: employee1.id,
      countryId: india.id,
      workDate: new Date(),
      minutesSpent: 240,
      isBillable: true,
      notes: "Implemented dashboard metrics cards",
      status: TimeEntryStatus.SUBMITTED,
    },
  });

  // Time Entry Review
  await prisma.timeEntryReview.create({
    data: {
      timeEntryId: timeEntry.id,
      reviewerId: teamLead.id,
      decisionStatus: TimeEntryStatus.APPROVED,
      remarks: "Approved by Team Lead",
    },
  });

  // Billing Transactions
  await prisma.billingTransaction.create({
    data: {
      projectId: project.id,
      transactionType: BillingTransactionType.PARTIAL_BILLING,
      amountMoney: 12000,
      amountHours: null,
      description: "Initial milestone billing",
      effectiveDate: new Date(),
    },
  });

  await prisma.billingTransaction.create({
    data: {
      projectId: project.id,
      transactionType: BillingTransactionType.UPGRADE_PRE_COMPLETION,
      amountMoney: 5000,
      amountHours: 10,
      description: "Scope upgrade before completion",
      effectiveDate: new Date(),
    },
  });

  console.log("Seed complete");
  console.log({
    admin: "admin@company.com / Admin@123",
    manager: "manager@company.com / Manager@123",
    teamLead: "lead@company.com / Lead@123",
    employee: "dev1@company.com / Employee@123",
    qa: "qa1@company.com / Employee@123",
    reportViewer: "viewer@company.com / Viewer@123",
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });