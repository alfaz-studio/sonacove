import { subDays, format } from "date-fns";

export type Role = "owner" | "admin" | "teacher" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  joinedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  date: string;
  startTime: string;
  duration: number; // minutes
  participantCount: number;
  participants: { name: string; email: string; role: string }[];
  status: "completed" | "scheduled";
  recordings?: { type: "video" | "audio"; url: string }[];
  transcripts?: boolean;
  aiSummary?: string;
  whiteboard?: boolean;
  chatLog?: boolean;
  files?: { name: string; url: string }[];
}

// Generate users for Quran teaching organization
const generateUsers = (): User[] => {
  const users: User[] = [];
  
  // 1 Owner
  users.push({
    id: "u-owner-1",
    name: "Ibrahim Al-Rashid",
    email: "ibrahim@maktab.org",
    role: "owner",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ibrahim",
    joinedAt: "2023-06-01",
  });

  // 3 Admins
  const adminNames = [
    { name: "Fatima Al-Zahra", email: "fatima@maktab.org" },
    { name: "Omar Hassan", email: "omar@maktab.org" },
    { name: "Aisha Malik", email: "aisha@maktab.org" },
  ];
  adminNames.forEach((admin, idx) => {
    users.push({
      id: `u-admin-${idx + 1}`,
      name: admin.name,
      email: admin.email,
      role: "admin",
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${admin.name}`,
      joinedAt: `2023-${String(7 + idx).padStart(2, '0')}-15`,
    });
  });

  // 6 Teachers
  const teacherNames = [
    { name: "Ustadh Muhammad Ali", email: "muhammad.ali@maktab.org" },
    { name: "Ustadha Khadija Ahmed", email: "khadija@maktab.org" },
    { name: "Ustadh Yusuf Ibrahim", email: "yusuf@maktab.org" },
    { name: "Ustadha Zainab Hassan", email: "zainab@maktab.org" },
    { name: "Ustadh Hamza Abdullah", email: "hamza@maktab.org" },
    { name: "Ustadha Maryam Saleh", email: "maryam@maktab.org" },
  ];
  teacherNames.forEach((teacher, idx) => {
    users.push({
      id: `u-teacher-${idx + 1}`,
      name: teacher.name,
      email: teacher.email,
      role: "teacher",
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${teacher.name}`,
      joinedAt: `2023-${String(8 + (idx % 3)).padStart(2, '0')}-${String(1 + (idx * 5) % 28).padStart(2, '0')}`,
    });
  });

  // 20 Students
  const studentNames = [
    { name: "Ahmad Al-Mansoori", email: "ahmad.mansoori@maktab.org" },
    { name: "Sara Al-Hashimi", email: "sara.hashimi@maktab.org" },
    { name: "Hassan Al-Qadri", email: "hassan.qadri@maktab.org" },
    { name: "Layla Al-Mahmoud", email: "layla.mahmoud@maktab.org" },
    { name: "Yusuf Al-Bakri", email: "yusuf.bakri@maktab.org" },
    { name: "Amina Al-Siddiq", email: "amina.siddiq@maktab.org" },
    { name: "Khalid Al-Faruq", email: "khalid.faruq@maktab.org" },
    { name: "Noor Al-Hakim", email: "noor.hakim@maktab.org" },
    { name: "Bilal Al-Amin", email: "bilal.amin@maktab.org" },
    { name: "Zara Al-Mustafa", email: "zara.mustafa@maktab.org" },
    { name: "Tariq Al-Rahman", email: "tariq.rahman@maktab.org" },
    { name: "Huda Al-Karim", email: "huda.karim@maktab.org" },
    { name: "Idris Al-Wadud", email: "idris.wadud@maktab.org" },
    { name: "Rania Al-Aziz", email: "rania.aziz@maktab.org" },
    { name: "Musa Al-Ghaffar", email: "musa.ghaffar@maktab.org" },
    { name: "Lina Al-Halim", email: "lina.halim@maktab.org" },
    { name: "Nuh Al-Qahhar", email: "nuh.qahhar@maktab.org" },
    { name: "Salma Al-Wahhab", email: "salma.wahhab@maktab.org" },
    { name: "Ilyas Al-Razzaq", email: "ilyas.razzaq@maktab.org" },
    { name: "Dina Al-Fattah", email: "dina.fattah@maktab.org" },
  ];
  studentNames.forEach((student, idx) => {
    users.push({
      id: `u-student-${idx + 1}`,
      name: student.name,
      email: student.email,
      role: "student",
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`,
      joinedAt: `2023-${String(9 + Math.floor(idx / 7)).padStart(2, '0')}-${String(1 + (idx * 3) % 28).padStart(2, '0')}`,
    });
  });

  return users;
};

export const USERS: User[] = generateUsers();

const generateMeetings = (): Meeting[] => {
  const meetings: Meeting[] = [];
  const baseDate = new Date();
  
  const teachers = USERS.filter(u => u.role === "teacher");
  const students = USERS.filter(u => u.role === "student");
  const admins = USERS.filter(u => u.role === "admin");
  const owner = USERS.find(u => u.role === "owner")!;

  // Generate meetings hosted by teachers
  // More meetings should be 2 participants (teacher + student)
  const classTypes = ["Hifdh", "Tajweed", "Tafsir", "Arabic", "Fiqh", "Seerah"];
  
  for (let i = 0; i < 80; i++) {
    const date = subDays(baseDate, Math.floor(i / 3));
    const teacher = teachers[Math.floor(Math.random() * teachers.length)];
    
    // 60% chance of 2 participants (teacher + 1 student), 40% chance of larger class
    const isSmallClass = Math.random() < 0.6;
    const participantCount = isSmallClass ? 2 : 3 + Math.floor(Math.random() * 8); // 3-10 for larger classes
    
    const selectedStudents = students
      .sort(() => Math.random() - 0.5)
      .slice(0, participantCount - 1); // -1 because teacher is the host
    
    const classType = classTypes[Math.floor(Math.random() * classTypes.length)];
    const level = isSmallClass ? "Individual" : `Level ${Math.floor(Math.random() * 5) + 1}`;
    
    meetings.push({
      id: `m-teacher-${i}`,
      title: `${classType} ${level} - ${teacher.name.split(' ')[1]}`,
      hostId: teacher.id,
      date: format(date, "yyyy-MM-dd"),
      startTime: `${8 + Math.floor(Math.random() * 10)}:${Math.random() < 0.5 ? '00' : '30'} ${Math.random() < 0.5 ? 'AM' : 'PM'}`,
      duration: isSmallClass ? 30 + Math.floor(Math.random() * 30) : 45 + Math.floor(Math.random() * 30),
      participantCount,
      participants: [
        { name: teacher.name, email: teacher.email, role: "Host" },
        ...selectedStudents.map(s => ({ name: s.name, email: s.email, role: "Student" }))
      ],
      status: Math.random() > 0.1 ? "completed" : "scheduled",
      recordings: Math.random() > 0.3 ? [{ type: "video", url: "#" }] : undefined,
      transcripts: Math.random() > 0.4,
      aiSummary: `Reviewed ${classType.toLowerCase()} concepts and practiced recitation.`,
      whiteboard: Math.random() > 0.6,
      chatLog: Math.random() > 0.3,
    });
  }

  // Admin/owner meetings (staff meetings)
  for (let i = 0; i < 10; i++) {
    const date = subDays(baseDate, i * 7);
    const host = i % 3 === 0 ? owner : admins[Math.floor(Math.random() * admins.length)];
    const allStaff = [owner, ...admins, ...teachers];
    const participants = allStaff
      .filter(s => s.id !== host.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3 + Math.floor(Math.random() * 5));
    
    meetings.push({
      id: `m-staff-${i}`,
      title: `Staff Meeting - ${format(date, "MMM d")}`,
      hostId: host.id,
      date: format(date, "yyyy-MM-dd"),
      startTime: "2:00 PM",
      duration: 45 + Math.floor(Math.random() * 30),
      participantCount: participants.length + 1,
      participants: [
        { name: host.name, email: host.email, role: "Host" },
        ...participants.map(p => ({ name: p.name, email: p.email, role: p.role === "owner" ? "Owner" : p.role === "admin" ? "Admin" : "Teacher" }))
      ],
      status: "completed",
      recordings: [{ type: "video", url: "#" }],
      transcripts: true,
      aiSummary: "Discussed curriculum updates, student progress, and administrative matters.",
      files: [{ name: "agenda.pdf", url: "#" }],
    });
  }

  return meetings;
};

export const MEETINGS = generateMeetings();

export const getMeetingsForUser = (userId: string, role: Role) => {
  if (role === "owner" || role === "admin") {
    return MEETINGS;
  }
  if (role === "teacher") {
    // Hosted meetings
    return MEETINGS.filter((m) => m.hostId === userId);
  }
  // Student - meetings they participated in
  const user = USERS.find(u => u.id === userId);
  if (!user) return [];
  return MEETINGS.filter((m) => 
    m.participants.some(p => p.email === user.email)
  );
};

export const getAnalytics = (meetings: Meeting[]) => {
  const totalMinutes = meetings.reduce((acc, m) => acc + m.duration, 0);
  const totalMeetings = meetings.length;
  const avgParticipants = Math.floor(
    meetings.reduce((acc, m) => acc + m.participantCount, 0) / (totalMeetings || 1)
  );
  
  // Group by month for chart
  const monthlyData = meetings.reduce((acc, m) => {
    const month = format(new Date(m.date), "MMM");
    if (!acc[month]) acc[month] = 0;
    acc[month] += m.participantCount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(monthlyData).map(([name, attendees]) => ({
    name,
    attendees,
  })).reverse(); // Simple reverse to show chronological-ish

  return { totalMinutes, totalMeetings, avgParticipants, chartData };
};
