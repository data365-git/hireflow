export type UUID = string;
export type ISODate = string;
export type Language = "uz" | "en" | "ru";
export type VacancyStatus = "active" | "paused" | "closed";

export type Vacancy = {
  id: UUID;
  title: string;
  department: string;
  workType: "office" | "remote" | "hybrid";
  employmentType: "full-time" | "part-time" | "trial" | "internship";
  location: string;
  salaryMin: number;
  salaryMax: number;
  description: string;
  status: VacancyStatus;
  language: Language;
  responsibleHrId: UUID;
  stageIds: UUID[];
  createdAt: ISODate;
  introMessage?: string;
  successMessage?: string;
};

export type VacancyStage = {
  id: UUID;
  vacancyId: UUID;
  name: string;
  color: string; // key into STAGE_COLORS map: "new" | "screening" | "qualified" | "test" | "interview" | "hired" | "rejected"
  isFinal: boolean;
  isRejected: boolean;
  isReserve?: boolean;
  orderIndex: number;
};

export type Candidate = {
  id: UUID;
  fullName: string;
  phone: string;
  telegramUsername: string;
  telegramFirstName: string;
  language: Language;
  city: string;
  createdAt: ISODate;
  dateOfBirth?: ISODate | null;
  address?: string | null;
  maritalStatus?: string | null;
  isStudent?: boolean | null;
  educationField?: string | null;
  englishLevel?: string | null;
  russianLevel?: string | null;
  workExperience?: Array<{ company?: string; position?: string; period?: string; leaveReason?: string }> | null;
  departmentId?: string | null;
  profileCompleted?: boolean;
  isBlacklisted?: boolean;
  languagePref?: Language | null;
};

export type Application = {
  id: UUID;
  candidateId: UUID;
  vacancyId: UUID;
  currentStageId: UUID;
  appliedAt: ISODate;
  lastActivityAt: ISODate;
  status: "browsing" | "in_progress" | "submitted" | "abandoned";
};

export type ScreeningQuestion = {
  id: UUID;
  vacancyId: UUID;
  text: string;
  type: "short-text" | "long-text" | "phone" | "single-choice" | "yes-no" | "rating";
  options?: string[];
  orderIndex: number;
};

export type ScreeningAnswer = {
  id: UUID;
  applicationId: UUID;
  questionId: UUID;
  answerText: string;
  answeredAt: ISODate;
};

export type TimelineEventType =
  | "application_started"
  | "application_completed"
  | "stage_changed"
  | "answer_submitted";

export type TimelineEvent = {
  id: UUID;
  applicationId: UUID;
  type: TimelineEventType;
  description: string;
  fromStageId?: UUID;
  toStageId?: UUID;
  comment?: string | null;
  createdAt: ISODate;
};

export type User = {
  id: UUID;
  name: string;
  avatarInitials: string;
  role: "admin" | "hr" | "interviewer";
};

export type TelegramMessage = {
  id: UUID;
  candidateId: UUID;
  applicationId?: UUID | null;
  direction: "inbound" | "outbound";
  senderType: "candidate" | "hr" | "system";
  senderName?: string;
  text: string;
  sentAt: ISODate;
  readByUserIds: UUID[];
  attachmentFileId?: string | null;
  attachmentType?: "photo" | "document" | null;
  attachmentFilename?: string | null;
};

export type InternalNote = {
  id: UUID;
  applicationId: UUID;
  userId: UUID;
  text: string;
  createdAt: ISODate;
  isPinned: boolean;
};

export type Source = {
  id: UUID;
  vacancyId: UUID;
  name: string;
  botLink: string;
};

export type QuestionTemplate = {
  id: string;
  name: string;
  description: string;
  questions: Array<{ text: string; type: ScreeningQuestion["type"]; options?: string[] }>;
};

export type CreateVacancyInput = {
  title: string;
  department: string;
  workType: Vacancy["workType"];
  employmentType: Vacancy["employmentType"];
  location: string;
  salaryMin: number;
  salaryMax: number;
  description: string;
  language: Language;
  responsibleHrId: UUID;
  introMessage: string;
  successMessage: string;
  stages: Array<{ name: string; color: string; isFinal: boolean; isRejected: boolean; isReserve?: boolean }>;
  questions: Array<{ text: string; type: ScreeningQuestion["type"]; options?: string[] }>;
  sources: Array<{ name: string }>;
};

export type AutomationTriggerType = "stage_entered" | "application_submitted";
export type AutomationActionType = "send_message" | "move_to_stage";

export type AutomationRule = {
  id: UUID;
  vacancyId: UUID;
  name: string;
  isEnabled: boolean;
  triggerType: AutomationTriggerType;
  triggerStageId?: UUID;
  actionType: AutomationActionType;
  actionStageId?: UUID;
  actionMessageText?: string;
  createdAt: ISODate;
};

export type TestTask = {
  id: UUID;
  vacancyId: UUID;
  title: string;
  description: string;
  dueInDays: number;
};

export type TestTaskAssignment = {
  id: UUID;
  taskId: UUID;
  applicationId: UUID;
  assignedAt: ISODate;
  dueAt: ISODate;
  status: "pending" | "submitted" | "passed" | "failed";
  submissionNote?: string;
};
