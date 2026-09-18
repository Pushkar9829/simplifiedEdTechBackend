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

const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
};

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
  BOOKING_STATUS,
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
  RESOURCE_TYPES,
  IBDP_SUBJECTS,
};
