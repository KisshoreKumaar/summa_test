export const BRANCHES = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Biotechnology',
  'Mathematics & Computing',
  'Business Administration',
  'Design',
  'Other',
] as const;

export const YEARS = [1, 2, 3, 4, 5] as const;

export const SKILL_SUGGESTIONS = [
  'React', 'Next.js', 'TypeScript', 'Python', 'Java', 'C++', 'Node.js', 'SQL',
  'Machine Learning', 'Data Analysis', 'UI/UX Design', 'Figma', 'Android',
  'iOS', 'Flutter', 'DevOps', 'Docker', 'AWS', 'Cybersecurity', 'Embedded C',
  'MATLAB', 'AutoCAD', 'Public Speaking', 'Technical Writing', 'Photography',
];

export const INTEREST_SUGGESTIONS = [
  'Open Source', 'Competitive Programming', 'Hackathons', 'Robotics',
  'Startups', 'Product Management', 'Finance', 'Research', 'Debate', 'Music',
  'Sports', 'Photography', 'Gaming', 'Film', 'Volunteering', 'Astronomy',
  'Sustainability', 'Blockchain', 'AI Safety', 'Design',
];

export const VISIBILITY_OPTIONS = [
  {
    value: 'public' as const,
    label: 'Public',
    description: 'Any signed-in student can see your full profile.',
  },
  {
    value: 'department' as const,
    label: 'Department only',
    description: 'Only students in your branch can see your profile.',
  },
  {
    value: 'connections' as const,
    label: 'Connections only',
    description: 'Only people you have connected with can see your profile.',
  },
];

export const MAX_SKILLS = 15;
export const MAX_INTERESTS = 15;
export const MAX_BIO_LENGTH = 500;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
export const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
