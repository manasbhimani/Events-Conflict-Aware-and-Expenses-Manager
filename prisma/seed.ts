import { PrismaClient, UserRole, EventType, EventStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const DEMO_PASSWORD = 'DemoPassword123!'
const demoPasswordHash = bcrypt.hashSync(DEMO_PASSWORD, 10)

// IST to UTC converter for seed data
// IST = UTC + 5:30, so subtract 5h30m from IST to get UTC
function istToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  const totalMinutesIST = hours * 60 + minutes
  const totalMinutesUTC = totalMinutesIST - (5 * 60 + 30)
  let utcHours = Math.floor(totalMinutesUTC / 60)
  let utcMinutes = totalMinutesUTC % 60
  let utcDay = day
  let utcMonth = month
  let utcYear = year
  if (utcHours < 0) {
    utcHours += 24
    utcDay -= 1
    if (utcDay < 1) {
      utcMonth -= 1
      if (utcMonth < 1) {
        utcMonth = 12
        utcYear -= 1
      }
      const daysInMonth = new Date(utcYear, utcMonth, 0).getDate()
      utcDay = daysInMonth
    }
  }
  if (utcMinutes < 0) {
    utcMinutes += 60
    utcHours -= 1
  }
  return new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHours, utcMinutes, 0, 0))
}

async function main() {
  console.log('🌱 Starting comprehensive seed...')

  // ============================================================
  // CLUBS
  // ============================================================
  console.log('Creating clubs...')

  const acmClub = await prisma.club.upsert({
    where: { code: 'ACM' },
    update: {},
    create: {
      name: 'ACM Student Chapter',
      code: 'ACM',
      description: 'Association for Computing Machinery student chapter. The internal organizing body.',
      contactEmail: 'acm@college.edu',
      isInternalAcm: true,
      isActive: true,
    },
  })

  const codingClub = await prisma.club.upsert({
    where: { code: 'CC' },
    update: {},
    create: {
      name: 'Coding Club',
      code: 'CC',
      description: 'Competitive programming and coding enthusiasts club.',
      contactEmail: 'codingclub@college.edu',
      isInternalAcm: false,
      isActive: true,
    },
  })

  const roboticsClub = await prisma.club.upsert({
    where: { code: 'RC' },
    update: {},
    create: {
      name: 'Robotics Club',
      code: 'RC',
      description: 'Robotics design, electronics, and automation club.',
      contactEmail: 'robotics@college.edu',
      isInternalAcm: false,
      isActive: true,
    },
  })

  const gdscClub = await prisma.club.upsert({
    where: { code: 'GDSC' },
    update: {},
    create: {
      name: 'Google Developer Student Club',
      code: 'GDSC',
      description: 'Google Developer Student Club — mobile, web, and cloud development.',
      contactEmail: 'gdsc@college.edu',
      isInternalAcm: false,
      isActive: true,
    },
  })

  const ecellClub = await prisma.club.upsert({
    where: { code: 'ECELL' },
    update: {},
    create: {
      name: 'Entrepreneurship Cell',
      code: 'ECELL',
      description: 'Entrepreneurship, startups, business, and innovation club.',
      contactEmail: 'ecell@college.edu',
      isInternalAcm: false,
      isActive: true,
    },
  })

  // ============================================================
  // USERS
  // ============================================================
  console.log('Creating users...')

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'superadmin@acm-demo.college.edu',
      name: 'Super Admin (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.SUPER_ADMIN,
      clubId: acmClub.id,
      isActive: true,
    },
  })

  const acmCore = await prisma.user.upsert({
    where: { email: 'core@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'core@acm-demo.college.edu',
      name: 'ACM Core Member (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.ACM_CORE,
      clubId: acmClub.id,
      isActive: true,
    },
  })

  const acmExec = await prisma.user.upsert({
    where: { email: 'exec@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'exec@acm-demo.college.edu',
      name: 'ACM Executive (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.ACM_EXEC,
      clubId: acmClub.id,
      isActive: true,
    },
  })

  const codingClubRep = await prisma.user.upsert({
    where: { email: 'rep.coding@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'rep.coding@acm-demo.college.edu',
      name: 'Coding Club Rep (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.CLUB_REP,
      clubId: codingClub.id,
      isActive: true,
    },
  })

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'viewer@acm-demo.college.edu',
      name: 'Read-Only Viewer (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.VIEWER,
      clubId: null,
      isActive: true,
    },
  })

  const roboticsRep = await prisma.user.upsert({
    where: { email: 'rep.robotics@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'rep.robotics@acm-demo.college.edu',
      name: 'Robotics Club Rep (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.CLUB_REP,
      clubId: roboticsClub.id,
      isActive: true,
    },
  })

  const gdscRep = await prisma.user.upsert({
    where: { email: 'rep.gdsc@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'rep.gdsc@acm-demo.college.edu',
      name: 'GDSC Rep (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.CLUB_REP,
      clubId: gdscClub.id,
      isActive: true,
    },
  })

  const ecellRep = await prisma.user.upsert({
    where: { email: 'rep.ecell@acm-demo.college.edu' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'rep.ecell@acm-demo.college.edu',
      name: 'E-Cell Rep (Demo)',
      passwordHash: demoPasswordHash,
      role: UserRole.CLUB_REP,
      clubId: ecellClub.id,
      isActive: true,
    },
  })

  // ============================================================
  // VENUES
  // ============================================================
  console.log('Creating venues...')

  const lt1 = await prisma.venue.upsert({
    where: { name: 'Lecture Theatre 1 (LT-1)' },
    update: {},
    create: {
      name: 'Lecture Theatre 1 (LT-1)',
      locationCode: 'BLOCK-A-LT1',
      capacity: 120,
      turnaroundMinutesBuffer: 30,
      description: 'Main lecture theatre in Block A. AV system, projector, podium.',
      isActive: true,
    },
  })

  const lt2 = await prisma.venue.upsert({
    where: { name: 'Lecture Theatre 2 (LT-2)' },
    update: {},
    create: {
      name: 'Lecture Theatre 2 (LT-2)',
      locationCode: 'BLOCK-A-LT2',
      capacity: 100,
      turnaroundMinutesBuffer: 30,
      description: 'Secondary lecture theatre in Block A.',
      isActive: true,
    },
  })

  const seminarHall = await prisma.venue.upsert({
    where: { name: 'Seminar Hall' },
    update: {},
    create: {
      name: 'Seminar Hall',
      locationCode: 'BLOCK-B-SEMINAR',
      capacity: 200,
      turnaroundMinutesBuffer: 45,
      description: 'Large seminar hall suitable for conferences and workshops.',
      isActive: true,
    },
  })

  const auditorium = await prisma.venue.upsert({
    where: { name: 'Main Auditorium' },
    update: {},
    create: {
      name: 'Main Auditorium',
      locationCode: 'MAIN-AUD',
      capacity: 500,
      turnaroundMinutesBuffer: 60,
      description: 'Main campus auditorium for large events and cultural programs.',
      isActive: true,
    },
  })

  const lab1 = await prisma.venue.upsert({
    where: { name: 'Computer Lab 1 (CS-LAB-1)' },
    update: {},
    create: {
      name: 'Computer Lab 1 (CS-LAB-1)',
      locationCode: 'BLOCK-C-LAB1',
      capacity: 40,
      turnaroundMinutesBuffer: 15,
      description: 'Computer lab with 40 workstations.',
      isActive: true,
    },
  })

  const lab2 = await prisma.venue.upsert({
    where: { name: 'Computer Lab 2 (CS-LAB-2)' },
    update: {},
    create: {
      name: 'Computer Lab 2 (CS-LAB-2)',
      locationCode: 'BLOCK-C-LAB2',
      capacity: 40,
      turnaroundMinutesBuffer: 15,
      description: 'Computer lab with 40 workstations for competitive programming.',
      isActive: true,
    },
  })

  const openAirAmphitheater = await prisma.venue.upsert({
    where: { name: 'Open Air Amphitheater' },
    update: {},
    create: {
      name: 'Open Air Amphitheater',
      locationCode: 'CAMPUS-OAT',
      capacity: 300,
      turnaroundMinutesBuffer: 60,
      description: 'Open-air amphitheater for cultural fests and outdoor programs.',
      isActive: true,
    },
  })

  // ============================================================
  // EXPENSE CATEGORIES
  // ============================================================
  console.log('Creating expense categories...')

  const catLogistics = await prisma.expenseCategory.upsert({
    where: { name: 'Logistics' },
    update: {},
    create: { name: 'Logistics', description: 'Transportation, courier, and miscellaneous operational costs.' },
  })

  const catRefreshments = await prisma.expenseCategory.upsert({
    where: { name: 'Refreshments' },
    update: {},
    create: { name: 'Refreshments', description: 'Food, beverages, snacks, tea/coffee for participants and speakers.' },
  })

  const catMarketing = await prisma.expenseCategory.upsert({
    where: { name: 'Marketing & Printing' },
    update: {},
    create: { name: 'Marketing & Printing', description: 'Banners, posters, brochures, standees.' },
  })

  const catEquipment = await prisma.expenseCategory.upsert({
    where: { name: 'Equipment & Supplies' },
    update: {},
    create: { name: 'Equipment & Supplies', description: 'Hardware, electronics, tools, stationery.' },
  })

  const catTravel = await prisma.expenseCategory.upsert({
    where: { name: 'Travel & Accommodation' },
    update: {},
    create: { name: 'Travel & Accommodation', description: 'Speaker travel reimbursement, hotel bookings.' },
  })

  const catHonorarium = await prisma.expenseCategory.upsert({
    where: { name: 'Honorarium & Prizes' },
    update: {},
    create: { name: 'Honorarium & Prizes', description: 'Speaker honorarium, prize money pool, gift vouchers.' },
  })

  const catVenue = await prisma.expenseCategory.upsert({
    where: { name: 'Venue & Infrastructure' },
    update: {},
    create: { name: 'Venue & Infrastructure', description: 'Venue booking fees, AV rentals, stage setup.' },
  })

  const catMisc = await prisma.expenseCategory.upsert({
    where: { name: 'Miscellaneous' },
    update: {},
    create: { name: 'Miscellaneous', description: 'Contingency and uncategorized expenses.' },
  })

  // ============================================================
  // SEMESTERS
  // ============================================================
  console.log('Creating semesters...')

  const prevSemester = await prisma.semester.upsert({
    where: { name: 'Even Semester 2025-26' },
    update: {},
    create: {
      name: 'Even Semester 2025-26',
      startDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-05-31T00:00:00.000Z'),
      totalBudget: '45000.00',
      isLocked: true,
      lockedAt: new Date('2026-06-05T05:30:00.000Z'),
      lockedByUserId: superAdmin.id,
    },
  })

  const currentSemester = await prisma.semester.upsert({
    where: { name: 'Odd Semester 2026-27' },
    update: {},
    create: {
      name: 'Odd Semester 2026-27',
      startDate: new Date('2026-07-15T00:00:00.000Z'),
      endDate: new Date('2026-12-15T00:00:00.000Z'),
      totalBudget: '50000.00',
      isLocked: false,
    },
  })

  // ============================================================
  // BUDGET ALLOCATIONS (Odd Semester 2026-27, total ₹50,000)
  // ============================================================
  console.log('Creating budget allocations...')

  const budgetData = [
    { category: catLogistics, amount: '5000.00', notes: 'Logistics budget for semester.' },
    { category: catRefreshments, amount: '8000.00', notes: 'Refreshments across all events.' },
    { category: catMarketing, amount: '6000.00', notes: 'Banners, posters, digital marketing.' },
    { category: catEquipment, amount: '7000.00', notes: 'Equipment and supplies for technical events.' },
    { category: catTravel, amount: '5000.00', notes: 'Speaker travel and accommodation.' },
    { category: catHonorarium, amount: '10000.00', notes: 'Prize money and honorarium pool.' },
    { category: catVenue, amount: '4000.00', notes: 'External venue or AV rental.' },
    { category: catMisc, amount: '5000.00', notes: 'Contingency miscellaneous budget.' },
  ]

  for (const b of budgetData) {
    await prisma.budgetAllocation.upsert({
      where: {
        semesterId_categoryId_clubId: {
          semesterId: currentSemester.id,
          categoryId: b.category.id,
          clubId: acmClub.id,
        },
      },
      update: {},
      create: {
        semesterId: currentSemester.id,
        categoryId: b.category.id,
        clubId: acmClub.id,
        allocatedAmount: b.amount,
        notes: b.notes,
        createdByUserId: acmCore.id,
      },
    })
  }

  // ============================================================
  // DEMO CONFLICT SCENARIO — REQUIRED
  //
  // Coding Club: Technical Hackathon (4PM - 8PM IST) -> LT-1, 2nd Year CSE/IT (VERIFIED)
  // ACM: Technical Workshop on DSA (5PM - 7PM IST) -> LT-1, 2nd Year CSE/IT (SUBMITTED)
  // ============================================================
  console.log('Creating demo conflict scenario events...')

  const demoDate = '2026-09-20'

  let hackathonEvent = await prisma.event.findFirst({
    where: { title: '[DEMO] Technical Hackathon — Coding Club' },
  })

  if (!hackathonEvent) {
    hackathonEvent = await prisma.event.create({
      data: {
        title: '[DEMO] Technical Hackathon — Coding Club',
        description: 'A full-afternoon hackathon for 2nd year students to build projects and compete for prizes.',
        eventType: EventType.HACKATHON,
        clubId: codingClub.id,
        venueId: lt1.id,
        semesterId: currentSemester.id,
        submittedByUserId: codingClubRep.id,
        startAt: istToUtc(demoDate, '16:00'), // 10:30 UTC
        endAt: istToUtc(demoDate, '20:00'),   // 14:30 UTC
        targetYears: [2],
        targetBranches: ['CSE', 'IT'],
        expectedAttendees: 80,
        status: EventStatus.VERIFIED,
        tags: ['hackathon', 'competitive', 'coding'],
      },
    })
  }

  let acmWorkshopEvent = await prisma.event.findFirst({
    where: { title: '[DEMO] Technical Workshop on DSA — ACM' },
  })

  if (!acmWorkshopEvent) {
    acmWorkshopEvent = await prisma.event.create({
      data: {
        title: '[DEMO] Technical Workshop on DSA — ACM',
        description: 'Hands-on workshop on Data Structures and Algorithms with a focus on competitive programming.',
        eventType: EventType.WORKSHOP,
        clubId: acmClub.id,
        venueId: lt1.id,               // SAME VENUE
        semesterId: currentSemester.id,
        submittedByUserId: acmExec.id,
        startAt: istToUtc(demoDate, '17:00'), // 11:30 UTC
        endAt: istToUtc(demoDate, '19:00'),   // 13:30 UTC
        targetYears: [2],
        targetBranches: ['CSE', 'IT'],         // SAME AUDIENCE
        expectedAttendees: 60,
        status: EventStatus.SUBMITTED,         // Awaiting review
        tags: ['workshop', 'DSA', 'algorithms'],
      },
    })
  }

  // ============================================================
  // HISTORICAL EVENTS (16 events across previous & current semester)
  // ============================================================
  console.log('Creating historical events...')

  const historicalEventsData = [
    {
      title: 'Web Development Bootcamp',
      description: 'A 3-day intensive bootcamp covering HTML, CSS, JavaScript, and React fundamentals.',
      eventType: EventType.WORKSHOP,
      clubId: gdscClub.id,
      venueId: lab1.id,
      semesterId: prevSemester.id,
      submittedByUserId: gdscRep.id,
      startAt: new Date('2026-02-10T04:30:00.000Z'),
      endAt: new Date('2026-02-10T11:30:00.000Z'),
      targetYears: [1, 2],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 35,
      status: EventStatus.COMPLETED,
      tags: ['web', 'react', 'javascript'],
    },
    {
      title: 'Robotics Workshop: Line Follower',
      description: 'Hands-on workshop building line-following robots using Arduino.',
      eventType: EventType.WORKSHOP,
      clubId: roboticsClub.id,
      venueId: seminarHall.id,
      semesterId: prevSemester.id,
      submittedByUserId: roboticsRep.id,
      startAt: new Date('2026-02-15T05:30:00.000Z'),
      endAt: new Date('2026-02-15T12:30:00.000Z'),
      targetYears: [1, 2, 3],
      targetBranches: [],
      expectedAttendees: 50,
      status: EventStatus.COMPLETED,
      tags: ['robotics', 'arduino', 'hardware'],
    },
    {
      title: 'Guest Lecture: AI in Healthcare',
      description: 'Industry expert lecture on applications of AI/ML in the healthcare sector.',
      eventType: EventType.GUEST_LECTURE,
      clubId: acmClub.id,
      venueId: auditorium.id,
      semesterId: prevSemester.id,
      submittedByUserId: acmExec.id,
      startAt: new Date('2026-03-05T05:00:00.000Z'),
      endAt: new Date('2026-03-05T08:00:00.000Z'),
      targetYears: [],
      targetBranches: [],
      expectedAttendees: 200,
      status: EventStatus.COMPLETED,
      tags: ['AI', 'healthcare', 'guest-lecture'],
    },
    {
      title: 'Startup Pitch Competition',
      description: 'E-Cell startup pitch event for student entrepreneurs.',
      eventType: EventType.COMPETITION,
      clubId: ecellClub.id,
      venueId: seminarHall.id,
      semesterId: prevSemester.id,
      submittedByUserId: ecellRep.id,
      startAt: new Date('2026-03-20T05:30:00.000Z'),
      endAt: new Date('2026-03-20T12:30:00.000Z'),
      targetYears: [3, 4],
      targetBranches: [],
      expectedAttendees: 80,
      status: EventStatus.COMPLETED,
      tags: ['startup', 'pitch', 'entrepreneurship'],
    },
    {
      title: 'Code Sprint — CP Contest',
      description: 'Competitive programming contest on Codeforces-style platform.',
      eventType: EventType.COMPETITION,
      clubId: codingClub.id,
      venueId: lab2.id,
      semesterId: prevSemester.id,
      submittedByUserId: codingClubRep.id,
      startAt: new Date('2026-04-05T05:30:00.000Z'),
      endAt: new Date('2026-04-05T09:30:00.000Z'),
      targetYears: [1, 2, 3],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 38,
      status: EventStatus.COMPLETED,
      tags: ['CP', 'contest', 'competitive'],
    },
    {
      title: 'Annual Tech Fest — Incursion 2026',
      description: 'ACM Annual Technical Festival with multiple events, workshops, and guest lectures.',
      eventType: EventType.COMPETITION,
      clubId: acmClub.id,
      venueId: auditorium.id,
      semesterId: prevSemester.id,
      submittedByUserId: acmExec.id,
      startAt: new Date('2026-04-15T03:30:00.000Z'),
      endAt: new Date('2026-04-17T14:30:00.000Z'),
      targetYears: [],
      targetBranches: [],
      expectedAttendees: 400,
      status: EventStatus.COMPLETED,
      tags: ['techfest', 'annual', 'incursion'],
    },
    {
      title: 'DSA Masterclass — Session 1',
      description: 'First session of the ACM DSA masterclass series.',
      eventType: EventType.WORKSHOP,
      clubId: acmClub.id,
      venueId: lt1.id,
      semesterId: prevSemester.id,
      submittedByUserId: acmExec.id,
      startAt: new Date('2026-01-25T10:30:00.000Z'),
      endAt: new Date('2026-01-25T13:30:00.000Z'),
      targetYears: [1, 2],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 70,
      status: EventStatus.COMPLETED,
      tags: ['DSA', 'masterclass', 'arrays'],
    },
    {
      title: 'Cloud Computing Workshop',
      description: 'Hands-on Google Cloud Platform workshop: GCP basics, cloud functions, deployment.',
      eventType: EventType.WORKSHOP,
      clubId: gdscClub.id,
      venueId: lab1.id,
      semesterId: prevSemester.id,
      submittedByUserId: gdscRep.id,
      startAt: new Date('2026-03-12T05:30:00.000Z'),
      endAt: new Date('2026-03-12T11:30:00.000Z'),
      targetYears: [2, 3],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 30,
      status: EventStatus.COMPLETED,
      tags: ['cloud', 'GCP', 'deployment'],
    },
    {
      title: 'Orientation for New Members',
      description: 'ACM freshers orientation session. Overview of ACM, upcoming events, membership benefits.',
      eventType: EventType.ORIENTATION,
      clubId: acmClub.id,
      venueId: seminarHall.id,
      semesterId: currentSemester.id,
      submittedByUserId: acmExec.id,
      startAt: new Date('2026-08-02T05:30:00.000Z'),
      endAt: new Date('2026-08-02T08:30:00.000Z'),
      targetYears: [1],
      targetBranches: [],
      expectedAttendees: 150,
      status: EventStatus.COMPLETED,
      tags: ['orientation', 'freshers', 'induction'],
    },
    {
      title: 'Android Development Workshop',
      description: 'Intro to Android app development using Kotlin and Jetpack Compose.',
      eventType: EventType.WORKSHOP,
      clubId: gdscClub.id,
      venueId: lab2.id,
      semesterId: currentSemester.id,
      submittedByUserId: gdscRep.id,
      startAt: new Date('2026-08-22T05:30:00.000Z'),
      endAt: new Date('2026-08-22T11:30:00.000Z'),
      targetYears: [2, 3],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 35,
      status: EventStatus.VERIFIED,
      tags: ['android', 'kotlin', 'mobile'],
    },
    {
      title: 'Robotics Challenge 2026',
      description: 'Inter-college robotics competition. Line follower and maze solver categories.',
      eventType: EventType.COMPETITION,
      clubId: roboticsClub.id,
      venueId: openAirAmphitheater.id,
      semesterId: currentSemester.id,
      submittedByUserId: roboticsRep.id,
      startAt: new Date('2026-09-05T04:30:00.000Z'),
      endAt: new Date('2026-09-05T13:00:00.000Z'),
      targetYears: [1, 2, 3, 4],
      targetBranches: [],
      expectedAttendees: 120,
      status: EventStatus.VERIFIED,
      tags: ['robotics', 'competition', 'inter-college'],
    },
    {
      title: 'Entrepreneurship Bootcamp',
      description: '2-day bootcamp on idea validation, lean startup methodology, and investor pitch.',
      eventType: EventType.WORKSHOP,
      clubId: ecellClub.id,
      venueId: seminarHall.id,
      semesterId: currentSemester.id,
      submittedByUserId: ecellRep.id,
      startAt: new Date('2026-09-12T04:00:00.000Z'),
      endAt: new Date('2026-09-12T12:30:00.000Z'),
      targetYears: [3, 4],
      targetBranches: [],
      expectedAttendees: 60,
      status: EventStatus.VERIFIED,
      tags: ['entrepreneurship', 'startup', 'bootcamp'],
    },
    {
      title: 'Competitive Programming Bootcamp',
      description: 'Intensive weekend bootcamp covering graphs, DP, segment trees, and number theory.',
      eventType: EventType.WORKSHOP,
      clubId: codingClub.id,
      venueId: lab1.id,
      semesterId: currentSemester.id,
      submittedByUserId: codingClubRep.id,
      startAt: new Date('2026-09-27T04:30:00.000Z'),
      endAt: new Date('2026-09-27T13:00:00.000Z'),
      targetYears: [2, 3],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 35,
      status: EventStatus.SUBMITTED,
      tags: ['CP', 'DP', 'graphs'],
    },
    {
      title: 'ML Study Circle — Session 1',
      description: 'First session of ACM ML study group. Linear regression, gradient descent, scikit-learn.',
      eventType: EventType.SEMINAR,
      clubId: acmClub.id,
      venueId: lt2.id,
      semesterId: currentSemester.id,
      submittedByUserId: acmExec.id,
      startAt: new Date('2026-10-10T10:30:00.000Z'),
      endAt: new Date('2026-10-10T13:30:00.000Z'),
      targetYears: [2, 3],
      targetBranches: ['CSE'],
      expectedAttendees: 45,
      status: EventStatus.VERIFIED,
      tags: ['ML', 'study-circle', 'sklearn'],
    },
    {
      title: 'Freshers Cultural Night',
      description: 'Cultural welcome event for first-year students — performances, games, food.',
      eventType: EventType.CULTURAL,
      clubId: acmClub.id,
      venueId: openAirAmphitheater.id,
      semesterId: currentSemester.id,
      submittedByUserId: acmExec.id,
      startAt: new Date('2026-08-15T13:00:00.000Z'),
      endAt: new Date('2026-08-15T16:30:00.000Z'),
      targetYears: [],
      targetBranches: [],
      expectedAttendees: 300,
      status: EventStatus.COMPLETED,
      tags: ['cultural', 'freshers', 'night-event'],
    },
  ]

  for (const eventData of historicalEventsData) {
    const existing = await prisma.event.findFirst({ where: { title: eventData.title } })
    if (!existing) {
      await prisma.event.create({ data: eventData })
    }
  }

  // ============================================================
  // HISTORICAL EXPENSES (26+ realistic expenses across both semesters)
  // ============================================================
  console.log('Creating historical expenses...')

  const findEvent = async (titleFragment: string) =>
    await prisma.event.findFirst({ where: { title: { contains: titleFragment } } })

  const webBootcamp = await findEvent('Web Development Bootcamp')
  const roboticsWorkshop = await findEvent('Robotics Workshop')
  const guestLecture = await findEvent('Guest Lecture: AI')
  const startupPitch = await findEvent('Startup Pitch')
  const codeprint = await findEvent('Code Sprint')
  const techFest = await findEvent('Annual Tech Fest')
  const orientation = await findEvent('Orientation for New Members')
  const hackathon = await findEvent('[DEMO] Technical Hackathon')

  const expensesData = [
    // Previous semester expenses
    {
      eventId: webBootcamp?.id,
      semesterId: prevSemester.id,
      categoryId: catRefreshments.id,
      clubId: gdscClub.id,
      createdByUserId: gdscRep.id,
      title: 'Refreshments — Web Dev Bootcamp',
      description: 'Tea, coffee, snacks for 35 participants over 3 days',
      amount: '2100.00',
      date: new Date('2026-02-10T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-02-11T06:00:00.000Z'),
    },
    {
      eventId: webBootcamp?.id,
      semesterId: prevSemester.id,
      categoryId: catMarketing.id,
      clubId: gdscClub.id,
      createdByUserId: gdscRep.id,
      title: 'Posters & Banners — Web Dev Bootcamp',
      description: '10 A3 posters + 2 flex banners printed',
      amount: '850.00',
      date: new Date('2026-02-05T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-02-06T05:30:00.000Z'),
    },
    {
      eventId: roboticsWorkshop?.id,
      semesterId: prevSemester.id,
      categoryId: catEquipment.id,
      clubId: roboticsClub.id,
      createdByUserId: roboticsRep.id,
      title: 'Arduino Kits — Robotics Workshop',
      description: '10 Arduino Uno kits with components',
      amount: '4500.00',
      date: new Date('2026-02-12T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-02-13T05:30:00.000Z'),
    },
    {
      eventId: roboticsWorkshop?.id,
      semesterId: prevSemester.id,
      categoryId: catRefreshments.id,
      clubId: roboticsClub.id,
      createdByUserId: roboticsRep.id,
      title: 'Refreshments — Robotics Workshop',
      description: 'Lunch and snacks for 50 participants',
      amount: '1800.00',
      date: new Date('2026-02-15T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-02-16T05:30:00.000Z'),
    },
    {
      eventId: guestLecture?.id,
      semesterId: prevSemester.id,
      categoryId: catHonorarium.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Speaker Honorarium — AI in Healthcare',
      description: 'Honorarium for Dr. Priya Sharma, AI researcher',
      amount: '5000.00',
      date: new Date('2026-03-05T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-03-06T05:30:00.000Z'),
    },
    {
      eventId: guestLecture?.id,
      semesterId: prevSemester.id,
      categoryId: catTravel.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Speaker Travel Reimbursement — AI Lecture',
      description: 'Flight + cab reimbursement for guest speaker',
      amount: '3200.00',
      date: new Date('2026-03-06T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-03-07T05:30:00.000Z'),
    },
    {
      eventId: guestLecture?.id,
      semesterId: prevSemester.id,
      categoryId: catRefreshments.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'High Tea — AI Guest Lecture',
      description: 'High tea for 200 attendees + speaker',
      amount: '4000.00',
      date: new Date('2026-03-05T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-03-07T05:30:00.000Z'),
    },
    {
      eventId: startupPitch?.id,
      semesterId: prevSemester.id,
      categoryId: catHonorarium.id,
      clubId: ecellClub.id,
      createdByUserId: ecellRep.id,
      title: 'Prize Money — Startup Pitch Competition',
      description: '1st: ₹3000, 2nd: ₹2000, 3rd: ₹1000',
      amount: '6000.00',
      date: new Date('2026-03-20T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-03-22T05:30:00.000Z'),
    },
    {
      eventId: startupPitch?.id,
      semesterId: prevSemester.id,
      categoryId: catMarketing.id,
      clubId: ecellClub.id,
      createdByUserId: ecellRep.id,
      title: 'Event Branding — Startup Pitch',
      description: 'Flex banners, standees, brochures',
      amount: '1200.00',
      date: new Date('2026-03-15T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-03-16T05:30:00.000Z'),
    },
    {
      eventId: codeprint?.id,
      semesterId: prevSemester.id,
      categoryId: catHonorarium.id,
      clubId: codingClub.id,
      createdByUserId: codingClubRep.id,
      title: 'Prize Vouchers — Code Sprint',
      description: 'Amazon vouchers for top 5 participants',
      amount: '2500.00',
      date: new Date('2026-04-05T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-04-06T05:30:00.000Z'),
    },
    {
      eventId: techFest?.id,
      semesterId: prevSemester.id,
      categoryId: catVenue.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Sound & Lighting Setup — Tech Fest',
      description: 'Professional PA system + stage lighting rental for 2 days',
      amount: '12000.00',
      date: new Date('2026-04-14T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-04-15T05:30:00.000Z'),
    },
    {
      eventId: techFest?.id,
      semesterId: prevSemester.id,
      categoryId: catRefreshments.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Catering — Tech Fest Day 1',
      description: 'Lunch + evening snacks for ~400 attendees',
      amount: '8000.00',
      date: new Date('2026-04-15T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-04-17T05:30:00.000Z'),
    },
    {
      eventId: techFest?.id,
      semesterId: prevSemester.id,
      categoryId: catHonorarium.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Prize Pool — Tech Fest Competitions',
      description: 'Aggregate prize money for all Tech Fest competitions',
      amount: '15000.00',
      date: new Date('2026-04-17T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-04-18T05:30:00.000Z'),
    },
    {
      eventId: techFest?.id,
      semesterId: prevSemester.id,
      categoryId: catMarketing.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Sponsorship Brochure Printing — Tech Fest',
      description: 'Glossy A4 brochures, standees, event backdrop',
      amount: '3500.00',
      date: new Date('2026-04-08T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-04-09T05:30:00.000Z'),
    },
    // Current semester expenses
    {
      eventId: orientation?.id,
      semesterId: currentSemester.id,
      categoryId: catRefreshments.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Refreshments — Freshers Orientation',
      description: 'Welcome snack packs for 150 freshers',
      amount: '2250.00',
      date: new Date('2026-08-02T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-08-03T05:30:00.000Z'),
    },
    {
      eventId: orientation?.id,
      semesterId: currentSemester.id,
      categoryId: catMarketing.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Welcome Kits — Orientation',
      description: 'Printed booklets, stickers, ACM branded pens for 150 students',
      amount: '1800.00',
      date: new Date('2026-07-28T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-07-29T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catEquipment.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'HDMI Cables & Adapters (Semester Equipment)',
      description: '5 HDMI cables and USB-C adapters for event equipment pool',
      amount: '1250.00',
      date: new Date('2026-07-20T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-07-21T05:30:00.000Z'),
    },
    {
      eventId: hackathon?.id,
      semesterId: currentSemester.id,
      categoryId: catHonorarium.id,
      clubId: codingClub.id,
      createdByUserId: codingClubRep.id,
      title: 'Prize Money — Technical Hackathon',
      description: '1st: ₹5000, 2nd: ₹3000, 3rd: ₹2000 + spot prizes',
      amount: '11000.00',
      date: new Date('2026-09-20T00:00:00.000Z'),
      status: 'PENDING' as const,
    },
    {
      eventId: hackathon?.id,
      semesterId: currentSemester.id,
      categoryId: catRefreshments.id,
      clubId: codingClub.id,
      createdByUserId: codingClubRep.id,
      title: 'Snacks & Dinner — Hackathon Participants',
      description: 'Evening snacks + dinner for ~80 participants',
      amount: '3200.00',
      date: new Date('2026-09-20T00:00:00.000Z'),
      status: 'PENDING' as const,
    },
    {
      eventId: hackathon?.id,
      semesterId: currentSemester.id,
      categoryId: catMarketing.id,
      clubId: codingClub.id,
      createdByUserId: codingClubRep.id,
      title: 'Event Posters — Technical Hackathon',
      description: 'A2 posters (x15) and digital creatives',
      amount: '700.00',
      date: new Date('2026-09-14T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-09-15T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catLogistics.id,
      clubId: roboticsClub.id,
      createdByUserId: roboticsRep.id,
      title: 'Component Shipping — Robotics Challenge',
      description: 'Courier charges for hardware components',
      amount: '450.00',
      date: new Date('2026-08-28T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-08-29T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catMarketing.id,
      clubId: gdscClub.id,
      createdByUserId: gdscRep.id,
      title: 'Social Media Creatives — Android Workshop',
      description: 'Canva Pro subscription for 1 month for event creatives',
      amount: '320.00',
      date: new Date('2026-08-15T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-08-16T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catMisc.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Office Stationery — ACM Office',
      description: 'A4 reams (5), markers, sticky notes for office',
      amount: '650.00',
      date: new Date('2026-07-25T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-07-26T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catRefreshments.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'Freshers Cultural Night — Catering',
      description: 'Full dinner catering for 300 attendees',
      amount: '9000.00',
      date: new Date('2026-08-15T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-08-16T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catVenue.id,
      clubId: acmClub.id,
      createdByUserId: acmExec.id,
      title: 'PA System Rental — Freshers Night',
      description: 'Outdoor PA system with speakers for OAT',
      amount: '2500.00',
      date: new Date('2026-08-14T00:00:00.000Z'),
      status: 'APPROVED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-08-15T05:30:00.000Z'),
    },
    {
      eventId: null,
      semesterId: currentSemester.id,
      categoryId: catTravel.id,
      clubId: codingClub.id,
      createdByUserId: codingClubRep.id,
      title: 'Travel to Regional CP Contest (REJECTED)',
      description: 'Train tickets for 5 students to attend regional contest',
      amount: '3500.00',
      date: new Date('2026-08-10T00:00:00.000Z'),
      status: 'REJECTED' as const,
      reviewedByUserId: acmCore.id,
      reviewedAt: new Date('2026-08-12T05:30:00.000Z'),
      rejectionReason: 'Budget for external travel not allocated for this semester. Resubmit with prior approval.',
    },
  ]

  for (const expenseData of expensesData) {
    const existing = await prisma.expense.findFirst({
      where: { title: expenseData.title },
    })
    if (!existing) {
      await prisma.expense.create({ data: expenseData })
    }
  }

  // ============================================================
  // AUDIT LOG SAMPLES
  // ============================================================
  console.log('Creating sample audit logs...')

  const existingLogs = await prisma.auditLog.count()
  if (existingLogs === 0) {
    await prisma.auditLog.create({
      data: {
        actorUserId: superAdmin.id,
        action: 'SEMESTER_LOCK',
        targetType: 'Semester',
        targetId: prevSemester.id,
        beforeState: { isLocked: false },
        afterState: { isLocked: true, lockedAt: '2026-06-05T05:30:00.000Z' },
        metadata: { reason: 'End of semester - locking for archival.' },
      },
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: codingClubRep.id,
        action: 'EVENT_SUBMIT',
        targetType: 'Event',
        targetId: hackathonEvent!.id,
        beforeState: { status: 'DRAFT' },
        afterState: { status: 'SUBMITTED' },
        metadata: { note: 'Submitted for ACM Core review.' },
      },
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: acmCore.id,
        action: 'EVENT_VERIFY',
        targetType: 'Event',
        targetId: hackathonEvent!.id,
        beforeState: { status: 'SUBMITTED' },
        afterState: { status: 'VERIFIED' },
        metadata: { note: 'Event verified. No conflicts at time of review.' },
      },
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: acmExec.id,
        action: 'EVENT_SUBMIT',
        targetType: 'Event',
        targetId: acmWorkshopEvent!.id,
        beforeState: { status: 'DRAFT' },
        afterState: { status: 'SUBMITTED' },
        metadata: { note: 'Submitted for ACM Core review. Conflict with Coding Club Hackathon pending review.' },
      },
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: acmCore.id,
        action: 'BUDGET_ALLOCATE',
        targetType: 'BudgetAllocation',
        targetId: currentSemester.id,
        beforeState: undefined,
        afterState: { totalBudget: '50000.00', semester: 'Odd Semester 2026-27' },
        metadata: { note: 'Initial budget allocations set for Odd Semester 2026-27.' },
      },
    })
  }

  console.log('')
  console.log('✅ Seed completed successfully!')
  console.log('📊 Summary:')
  console.log('  Clubs: 5')
  console.log('  Users: 8')
  console.log('  Venues: 7')
  console.log('  Semesters: 2')
  console.log('  Expense Categories: 8')
  console.log('  Budget Allocations: 8 (Odd Semester 2026-27, ₹50,000 total)')
  console.log('  Events: 17 (including demo conflict pair coexisting)')
  console.log('  Expenses: 26')
  console.log('  Audit Logs: 5')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
