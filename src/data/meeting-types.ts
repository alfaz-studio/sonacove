import { subDays, format } from "date-fns";
import { USERS } from "./dashboard-types";

export type MeetingStatus = "completed" | "scheduled" | "in_progress" | "cancelled";

export interface Recording {
  id: string;
  type: "video" | "audio" | "screen";
  url: string;
  duration: number; // in seconds
  size: number; // in bytes
}

export interface Transcript {
  id: string;
  language: string;
  url: string;
  wordCount: number;
  generatedAt: number;
}

export interface WhiteboardFile {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  createdAt: number;
}

export interface SharedFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  sharedBy: string;
  sharedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
}

export interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  totalVotes: number;
  createdAt: number;
}

export interface AttendanceRecord {
  participantEmail: string;
  participantName: string;
  joinedAt: number;
  leftAt: number;
  duration: number; // minutes
  role: "host" | "moderator" | "participant";
}

export interface MeetingMetaData {
  id: string;
  title: string;
  timestamp: number;
  endTimestamp: number;
  email: string; // host email (kept for backward compatibility, use hosts array instead)
  hostName: string; // primary host name (kept for backward compatibility, use hostNames array instead)
  hosts: string[]; // array of host emails (may include nulls for guest hosts)
  hostNames: string[]; // array of host names
  duration: number; // minutes
  participants: string[]; // array of participant emails/identifiers (may include non-email strings for guests)
  participantNames: string[]; // array of participant display names, parallel to participants where possible
  participantCount: number;
  status: MeetingStatus;
  
  // Artifacts
  recordings: Recording[];
  transcript: Transcript | null;
  whiteboard: WhiteboardFile | null;
  sharedFiles: SharedFile[];
  chatLog: ChatMessage[];
  polls: Poll[];
  attendance: AttendanceRecord[];
  aiSummary: string | null;
  
  // Metadata
  roomName: string;
  isRecorded: boolean;
  hasTranscript: boolean;
}

// Get users by role
const teachers = USERS.filter(u => u.role === "teacher");
const students = USERS.filter(u => u.role === "student");

const classTypes = ["Hifdh", "Tajweed", "Tafsir", "Arabic", "Fiqh", "Seerah", "Aqeedah", "Hadith"];

const meetingTitles = [
  "Hifdh Class - Juz Amma Review",
  "Tajweed Fundamentals - Rules of Noon",
  "Tafsir Surah Al-Fatiha",
  "Arabic Grammar - Verb Conjugation",
  "Fiqh of Prayer - Wudu and Salah",
  "Seerah of the Prophet - Early Life",
  "Hifdh Memorization - Surah Al-Baqarah",
  "Tajweed Practice - Qalqalah Rules",
  "Tafsir Surah Al-Baqarah - Verses 1-50",
  "Arabic Vocabulary - Daily Words",
  "Fiqh of Fasting - Ramadan Rules",
  "Seerah - The Hijrah",
  "Hifdh Review Session - Last 10 Surahs",
  "Tajweed Advanced - Rules of Meem",
  "Tafsir Surah Al-Imran",
  "Arabic Conversation Practice",
  "Fiqh of Zakat - Calculation",
  "Seerah - Battle of Badr",
  "Hifdh New Memorization - Juz 30",
  "Tajweed Correction Session",
];

const aiSummaries = [
  "Reviewed Juz Amma memorization. Students practiced recitation with proper tajweed. Focused on Surah Al-Nas through Al-Falaq. Assigned homework: memorize Surah Al-Ikhlas with correct pronunciation.",
  "Covered rules of Noon Sakinah and Tanween. Practiced Ikhfa, Idgham, Iqlab, and Izhar. Students demonstrated good understanding. Next session will focus on Meem Sakinah rules.",
  "Explored the meanings and context of Surah Al-Fatiha. Discussed the significance of each verse and its role in daily prayers. Students asked thoughtful questions about tafsir methodology.",
  "Introduced verb conjugation in present tense. Covered root letters and patterns. Students practiced forming sentences. Homework: conjugate 10 verbs from the vocabulary list.",
  "Reviewed the steps of Wudu and conditions for its validity. Discussed the pillars and sunnah acts of Salah. Students practiced the prayer positions and recitations.",
  "Covered the early life of Prophet Muhammad (SAW) from birth to the first revelation. Discussed his character and the social context of pre-Islamic Arabia. Students engaged well with the material.",
  "Continued memorization of Surah Al-Baqarah. Focused on verses 1-20. Students recited individually with correction. Progress tracking updated for each student.",
  "Practiced Qalqalah rules with examples from the Quran. Students identified Qalqalah letters in various surahs. Corrected common mistakes in pronunciation.",
  "Explored verses 1-50 of Surah Al-Baqarah. Discussed themes of guidance, creation, and the story of Adam. Students took notes on key concepts and vocabulary.",
  "Introduced 20 new Arabic words related to daily activities. Practiced pronunciation and usage in sentences. Students created their own sentences using the new vocabulary.",
];

function generateChatLog(participants: string[], duration: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const messageCount = Math.min(Math.floor(duration / 5), 20); // ~1 message per 5 mins, max 20
  
  const sampleMessages = [
    "Assalamu alaikum",
    "Can you repeat that verse?",
    "JazakAllah khair",
    "I have a question about the tajweed rule",
    "Could you share the screen?",
    "I didn't catch that, can you say it again?",
    "MashaAllah",
    "BarakAllahu feek",
    "I understand now, shukran",
    "Can we go over that part again?",
    "The homework is in the shared folder",
    "Thanks for the explanation",
    "See you next class, inshaAllah",
    "I'll practice this before next session",
    "Sorry, I was on mute",
  ];

  const baseTime = Date.now() - duration * 60 * 1000;
  
  for (let i = 0; i < messageCount; i++) {
    const senderEmail = participants[Math.floor(Math.random() * participants.length)];
    const sender = USERS.find(u => u.email === senderEmail)?.name || senderEmail.split("@")[0];
    messages.push({
      id: `msg-${i}`,
      sender,
      message: sampleMessages[Math.floor(Math.random() * sampleMessages.length)],
      timestamp: baseTime + Math.floor((i / messageCount) * duration * 60 * 1000),
    });
  }
  
  return messages;
}

function generatePolls(hasPoll: boolean): Poll[] {
  if (!hasPoll) return [];
  
  const polls: Poll[] = [
    {
      id: "poll-1",
      question: "What time works best for our next meeting?",
      options: [
        { text: "9:00 AM", votes: 5 },
        { text: "2:00 PM", votes: 8 },
        { text: "4:00 PM", votes: 3 },
      ],
      totalVotes: 16,
      createdAt: Date.now() - 3600000,
    },
  ];
  
  return polls;
}

function generateAttendance(
  hostEmail: string,
  participants: string[],
  duration: number,
  timestamp: number,
  hasModerators: boolean
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  
  // Add host
  const host = USERS.find(u => u.email === hostEmail);
  if (host) {
    records.push({
      participantEmail: host.email,
      participantName: host.name,
      joinedAt: timestamp,
      leftAt: timestamp + duration * 60 * 1000,
      duration,
      role: "host",
    });
  }
  
  // Determine moderators (1-2 students in larger meetings)
  const moderatorIndices: number[] = [];
  if (hasModerators && participants.length >= 5) {
    const moderatorCount = Math.random() > 0.5 ? 2 : 1;
    const availableIndices = Array.from({ length: participants.length }, (_, i) => i);
    for (let i = 0; i < moderatorCount && availableIndices.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length);
      moderatorIndices.push(availableIndices.splice(randomIndex, 1)[0]);
    }
  }
  
  // Add participants
  participants.forEach((email, index) => {
    const user = USERS.find(u => u.email === email);
    if (!user) return;
    
    const joinOffset = Math.floor(Math.random() * 5); // 0-5 min late
    const leftEarly = Math.random() > 0.8; // 20% leave early
    const actualDuration = leftEarly ? Math.floor(duration * 0.7) : duration - joinOffset;
    
    records.push({
      participantEmail: email,
      participantName: user.name,
      joinedAt: timestamp + joinOffset * 60 * 1000,
      leftAt: timestamp + (joinOffset + actualDuration) * 60 * 1000,
      duration: actualDuration,
      role: moderatorIndices.includes(index) ? "moderator" : "participant",
    });
  });
  
  return records;
}

function generateMeeting(index: number, daysAgo: number): MeetingMetaData {
  const baseDate = subDays(new Date(), daysAgo);
  const hour = 8 + Math.floor(Math.random() * 10); // 8 AM to 6 PM
  const timestamp = new Date(baseDate.setHours(hour, Math.random() < 0.5 ? 0 : 30, 0, 0)).getTime();
  
  // 60% chance of 2 participants (teacher + student), 40% chance of larger class
  const isSmallClass = Math.random() < 0.6;
  const participantCount = isSmallClass ? 2 : 3 + Math.floor(Math.random() * 8); // 3-10 for larger classes
  const duration = isSmallClass ? 30 + Math.floor(Math.random() * 30) : 45 + Math.floor(Math.random() * 30);
  const endTimestamp = timestamp + duration * 60 * 1000;
  
  // Select a random teacher as host
  const host = teachers[Math.floor(Math.random() * teachers.length)];
  
  // Select students as participants
  const selectedStudents = students
    .sort(() => Math.random() - 0.5)
    .slice(0, participantCount - 1); // -1 because teacher is the host
  
  const selectedParticipants = [host.email, ...selectedStudents.map(s => s.email)];
  
  // Determine if this meeting should have moderators (larger meetings with 5+ participants)
  const hasModerators = !isSmallClass && participantCount >= 5 && Math.random() > 0.5;
  
  const hasRecording = Math.random() > 0.3;
  const hasTranscript = hasRecording && Math.random() > 0.4;
  const hasWhiteboard = Math.random() > 0.6;
  const hasSharedFiles = Math.random() > 0.5;
  const hasPoll = Math.random() > 0.8;
  
  // Generate Quran-related room names
  const classType = classTypes[Math.floor(Math.random() * classTypes.length)];
  const roomTypes = [
    `maktab-${classType.toLowerCase()}-${Math.floor(Math.random() * 5) + 1}`,
    `maktab-hifdh-${Math.floor(Math.random() * 3) + 1}`,
    `maktab-tajweed-${Math.floor(Math.random() * 3) + 1}`,
    `maktab-tafsir`,
    `maktab-arabic-${Math.floor(Math.random() * 2) + 1}`,
  ];
  const roomName = roomTypes[Math.floor(Math.random() * roomTypes.length)];
  
  const recordings: Recording[] = hasRecording
    ? [
        {
          id: `rec-${index}-1`,
          type: "video",
          url: "#",
          duration: duration * 60,
          size: duration * 5 * 1024 * 1024, // ~5MB per minute
        },
      ]
    : [];

  const transcript: Transcript | null = hasTranscript
    ? {
        id: `trans-${index}`,
        language: "Arabic",
        url: "#",
        wordCount: duration * 100, // ~100 words per minute for Arabic/religious content
        generatedAt: endTimestamp + 300000, // 5 min after meeting
      }
    : null;

  const whiteboard: WhiteboardFile | null = hasWhiteboard
    ? {
        id: `wb-${index}`,
        name: `Whiteboard-${format(new Date(timestamp), "yyyy-MM-dd")}.png`,
        url: "#",
        thumbnailUrl: "#",
        createdAt: endTimestamp,
      }
    : null;

  const sharedFiles: SharedFile[] = hasSharedFiles
    ? [
        {
          id: `file-${index}-1`,
          name: `${classType}-notes.pdf`,
          url: "#",
          type: "application/pdf",
          size: 2.5 * 1024 * 1024,
          sharedBy: host.email,
          sharedAt: timestamp + 600000,
        },
        {
          id: `file-${index}-2`,
          name: "homework-assignment.docx",
          url: "#",
          type: "application/docx",
          size: 156 * 1024,
          sharedBy: host.email,
          sharedAt: timestamp + 1800000,
        },
      ]
    : [];

  return {
    id: `meeting-${index}`,
    title: meetingTitles[index % meetingTitles.length],
    timestamp,
    endTimestamp,
    email: host.email,
    hostName: host.name,
    hosts: [host.email],
    hostNames: [host.name],
    duration,
    participants: selectedParticipants,
    participantNames: selectedParticipants.map(email => {
      const user = USERS.find(u => u.email === email);
      return user ? user.name : email.split("@")[0];
    }),
    participantCount,
    status: daysAgo < 3 && Math.random() > 0.3 ? "in_progress" : "completed",
    recordings,
    transcript,
    whiteboard,
    sharedFiles,
    chatLog: generateChatLog(selectedParticipants, duration),
    polls: generatePolls(hasPoll),
    attendance: generateAttendance(host.email, selectedStudents.map(s => s.email), duration, timestamp, hasModerators),
    aiSummary: hasTranscript ? aiSummaries[index % aiSummaries.length] : null,
    roomName,
    isRecorded: hasRecording,
    hasTranscript,
  };
}

function generateMeetings(): MeetingMetaData[] {
  const meetings: MeetingMetaData[] = [];
  
  // Generate 120 meetings over the past 60 days
  for (let i = 0; i < 120; i++) {
    const daysAgo = Math.floor(i / 2); // Spread meetings across ~60 days
    meetings.push(generateMeeting(i, daysAgo));
  }
  
  // Sort by timestamp descending (most recent first)
  return meetings.sort((a, b) => b.timestamp - a.timestamp);
}

export const sampleMeetings: MeetingMetaData[] = generateMeetings();
