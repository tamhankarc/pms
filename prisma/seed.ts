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

  const admin = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      username: "admin",
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
      username: "manager",
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
      username: "lead.dev",
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
      username: "dev.one",
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
      username: "qa.one",
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
      username: "viewer",
      email: "viewer@company.com",
      passwordHash: viewerHash,
      fullName: "Report Viewer",
      userType: UserType.REPORT_VIEWER,
      functionalRole: FunctionalRoleCode.OTHER,
      phoneNumber: "9999999996",
    },
  });

  const client = await prisma.client.upsert({
    where: { code: "WB" },
    update: {},
    create: {
      name: "Warner Bros",
      code: "WB",
      isActive: true,
      showCountriesInTimeEntries: true,
      showMoviesInEntries: true,
      showLanguagesInEntries: true,
      enableProjectTypes: true,
    },
  });

  const movie = await prisma.movie
    .create({
      data: {
        clientId: client.id,
        title: "Sample Movie",
        code: "SM001",
        isActive: true,
      },
    })
    .catch(async () => {
      return prisma.movie.findFirstOrThrow({
        where: { code: "SM001" },
      });
    });

  const language = await prisma.language.upsert({
    where: { code: "EN" },
    update: {},
    create: {
      name: "English",
      code: "EN",
      isActive: true,
    },
  });

  const projectType = await prisma.projectType.upsert({
    where: {
      clientId_name: {
        clientId: client.id,
        name: "Marketing",
      },
    },
    update: {},
    create: {
      clientId: client.id,
      name: "Marketing",
      code: "MKT",
      isActive: true,
    },
  });

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

  const project = await prisma.project.upsert({
    where: { code: "PMS-WB-001" },
    update: {},
    create: {
      clientId: client.id,
      projectTypeId: projectType.id,
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

  const subProject = await prisma.subProject.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: "Core Delivery",
      },
    },
    update: {
      description: "Primary implementation and delivery team",
      isActive: true,
    },
    create: {
      projectId: project.id,
      name: "Core Delivery",
      description: "Primary implementation and delivery team",
      isActive: true,
    },
  });

  for (const user of [teamLead, employee1, employee2, manager]) {
    await prisma.subProjectAssignment.upsert({
      where: {
        subProjectId_userId: {
          subProjectId: subProject.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        subProjectId: subProject.id,
        userId: user.id,
      },
    });
  }

  const estimate = await prisma.estimate.create({
    data: {
      projectId: project.id,
      subProjectId: subProject.id,
      employeeId: employee1.id,
      countryId: india.id,
      movieId: movie.id,
      languageId: language.id,
      workDate: new Date(),
      estimatedMinutes: 480,
      notes: "Homepage redesign estimate",
      status: EstimateStatus.SUBMITTED,
    },
  });

  await prisma.estimateReview.create({
    data: {
      estimateId: estimate.id,
      reviewerId: teamLead.id,
      decisionStatus: EstimateStatus.APPROVED,
      remarks: "Looks reasonable",
    },
  });

  const timeEntry = await prisma.timeEntry.create({
    data: {
      projectId: project.id,
      subProjectId: subProject.id,
      employeeId: employee1.id,
      countryId: india.id,
      movieId: movie.id,
      languageId: language.id,
      workDate: new Date(),
      taskName: "Dashboard metrics implementation",
      minutesSpent: 240,
      isBillable: true,
      notes: "Implemented dashboard metrics cards",
      status: TimeEntryStatus.SUBMITTED,
    },
  });

  await prisma.timeEntryReview.create({
    data: {
      timeEntryId: timeEntry.id,
      reviewerId: teamLead.id,
      decisionStatus: TimeEntryStatus.APPROVED,
      remarks: "Approved by Team Lead",
    },
  });

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
    admin: "admin or admin@company.com / Admin@123",
    manager: "manager or manager@company.com / Manager@123",
    teamLead: "lead.dev or lead@company.com / Lead@123",
    employee: "dev.one or dev1@company.com / Employee@123",
    qa: "qa.one or qa1@company.com / Employee@123",
    reportViewer: "viewer or viewer@company.com / Viewer@123",
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