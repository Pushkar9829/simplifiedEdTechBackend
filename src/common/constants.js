const ROLES = {
  STUDENT: 'student',
  TUTOR: 'tutor',
  PARENT: 'parent',
  ADMIN: 'admin',
};

const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

const VERIFICATION_STATUS = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const VERIFICATION_DOC_FIELDS = ['identity', 'degree', 'certificate', 'resume'];
const VERIFICATION_REQUIRED_FIELDS = ['identity', 'degree'];
const VERIFICATION_MIN_REFERENCES = 2;
const VERIFICATION_MAX_FILES_PER_FIELD = 5;

const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
};

const MEETING_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
};

const GRADING_SCHEMES = ['ib_1_7', 'percentage', 'marks', 'letter', 'pass_fail'];

const PAYMENT_STATUS = {
  PENDING: 'pending',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const ASSIGNMENT_STATUS = {
  ASSIGNED: 'assigned',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
  OVERDUE: 'overdue',
};

const LEVELS = ['HL', 'SL', 'N/A'];

const TEACHING_MODES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BOTH: 'both',
};

const DELIVERY_MODES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
};

const BOOKING_MIN_LEAD_HOURS = 12;
const PLATFORM_COMMISSION_RATE = 0.25;
const TUTOR_PAYOUT_RATE = 0.75;

const WALLET_OWNER = {
  USER: 'user',
  PLATFORM: 'platform',
};

const WALLET_TX_TYPE = {
  CREDIT: 'credit',
  DEBIT: 'debit',
};

const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const COURSE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

const PROJECT_STATUS = {
  PROPOSED: 'proposed',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const RESOURCE_ACCESS = {
  FREE: 'free',
  PAID: 'paid',
};

const RESOURCE_TYPES = [
  'notes',
  'question_bank',
  'past_paper',
  'markscheme',
  'formula_sheet',
  'flashcards',
  'mind_map',
  'practice_test',
];

const IBDP_SUBJECTS = [
  'Language A Literature',
  'Language A Language & Literature',
  'English B',
  'Spanish',
  'French',
  'German',
  'Mandarin',
  'Business Management',
  'Economics',
  'Psychology',
  'History',
  'Geography',
  'Global Politics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Environmental Systems',
  'Mathematics AA HL',
  'Mathematics AA SL',
  'Mathematics AI HL',
  'Mathematics AI SL',
  'Visual Arts',
  'Music',
  'Theatre',
  'Theory of Knowledge (TOK)',
  'Extended Essay (EE)',
  'Creativity, Activity, Service (CAS)',
];

module.exports = {
  ROLES,
  USER_STATUS,
  VERIFICATION_STATUS,
  VERIFICATION_DOC_FIELDS,
  VERIFICATION_REQUIRED_FIELDS,
  VERIFICATION_MIN_REFERENCES,
  VERIFICATION_MAX_FILES_PER_FIELD,
  BOOKING_STATUS,
  MEETING_STATUS,
  GRADING_SCHEMES,
  PAYMENT_STATUS,
  ASSIGNMENT_STATUS,
  LEVELS,
  TEACHING_MODES,
  DELIVERY_MODES,
  BOOKING_MIN_LEAD_HOURS,
  PLATFORM_COMMISSION_RATE,
  TUTOR_PAYOUT_RATE,
  WALLET_OWNER,
  WALLET_TX_TYPE,
  WITHDRAWAL_STATUS,
  COURSE_STATUS,
  PROJECT_STATUS,
  RESOURCE_ACCESS,
  RESOURCE_TYPES,
  IBDP_SUBJECTS,
};
