/**
 * Seeds realistic dummy students for local testing.
 *
 *   npm run seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. Creates confirmed auth users (so the
 * signup trigger builds their profile rows) and then fills in the profiles.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config({ path: '.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// `||` not `??`: an empty domain (restriction disabled) must still fall back,
// otherwise every seeded address would be built as "name@".
const domain = (process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || 'college-domain.edu').replace(
  /^@/,
  '',
);

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = 'Password123';

const STUDENTS = [
  {
    handle: 'aditi.sharma',
    full_name: 'Aditi Sharma',
    year: 3,
    branch: 'Computer Science',
    bio: 'Full-stack developer who spends far too much time on side projects. Currently building a campus carpool app.',
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    interests: ['Hackathons', 'Open Source', 'Startups'],
    github_url: 'https://github.com/aditisharma',
    linkedin_url: 'https://linkedin.com/in/aditisharma',
    role: 'super_admin' as const,
  },
  {
    handle: 'rohan.mehta',
    full_name: 'Rohan Mehta',
    year: 4,
    branch: 'Computer Science',
    bio: 'Final year. Interested in distributed systems and anything that involves reading a paper twice.',
    skills: ['Java', 'Docker', 'AWS', 'SQL'],
    interests: ['Research', 'Competitive Programming'],
    github_url: 'https://github.com/rohanmehta',
    role: 'club_admin' as const,
  },
  {
    handle: 'priya.nair',
    full_name: 'Priya Nair',
    year: 2,
    branch: 'Electronics & Communication',
    bio: 'Robotics team member. I like embedded systems and things that beep.',
    skills: ['Embedded C', 'MATLAB', 'Python'],
    interests: ['Robotics', 'Astronomy', 'Photography'],
    role: 'student' as const,
  },
  {
    handle: 'kabir.singh',
    full_name: 'Kabir Singh',
    year: 3,
    branch: 'Design',
    bio: 'Product designer. Happy to review anyone’s portfolio over coffee.',
    skills: ['Figma', 'UI/UX Design', 'Photography'],
    interests: ['Design', 'Film', 'Startups'],
    portfolio_url: 'https://kabirsingh.design',
    role: 'student' as const,
  },
  {
    handle: 'meera.iyer',
    full_name: 'Meera Iyer',
    year: 1,
    branch: 'Information Technology',
    bio: 'First year, still figuring things out. Looking for a mentor in web development.',
    skills: ['Python', 'SQL'],
    interests: ['Open Source', 'Volunteering', 'Music'],
    role: 'student' as const,
  },
  {
    handle: 'arjun.rao',
    full_name: 'Arjun Rao',
    year: 4,
    branch: 'Mechanical Engineering',
    bio: 'Formula student team lead. CAD by day, sim racing by night.',
    skills: ['AutoCAD', 'MATLAB', 'Public Speaking'],
    interests: ['Sports', 'Gaming', 'Sustainability'],
    linkedin_url: 'https://linkedin.com/in/arjunrao',
    role: 'student' as const,
  },
  {
    handle: 'sanya.gupta',
    full_name: 'Sanya Gupta',
    year: 3,
    branch: 'Mathematics & Computing',
    bio: 'ML research assistant. Interested in interpretability and safe deployment.',
    skills: ['Python', 'Machine Learning', 'Data Analysis'],
    interests: ['AI Safety', 'Research', 'Debate'],
    github_url: 'https://github.com/sanyagupta',
    role: 'student' as const,
  },
  {
    handle: 'vikram.desai',
    full_name: 'Vikram Desai',
    year: 2,
    branch: 'Business Administration',
    bio: 'Runs the entrepreneurship cell. Always looking for technical co-founders.',
    skills: ['Public Speaking', 'Technical Writing'],
    interests: ['Startups', 'Finance', 'Product Management'],
    role: 'club_admin' as const,
  },
];

async function main() {
  console.log(`Seeding ${STUDENTS.length} students on @${domain}\n`);

  for (const student of STUDENTS) {
    const email = `${student.handle}@${domain}`;

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: student.full_name },
    });

    let userId = created?.user?.id;

    if (createError) {
      if (!/already/i.test(createError.message)) {
        console.error(`  ✗ ${email}: ${createError.message}`);
        continue;
      }
      // Already seeded — look the user up so the profile still gets refreshed.
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users.find((u) => u.email === email)?.id;
    }

    if (!userId) {
      console.error(`  ✗ ${email}: could not resolve user id`);
      continue;
    }

    const { handle: _handle, ...profileFields } = student;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        ...profileFields,
        github_url: student.github_url ?? null,
        linkedin_url: student.linkedin_url ?? null,
        portfolio_url: student.portfolio_url ?? null,
        avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
          student.full_name,
        )}`,
        visibility: 'public',
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error(`  ✗ ${email}: ${profileError.message}`);
    } else {
      console.log(`  ✓ ${student.full_name} <${email}>`);
    }
  }

  console.log(`\nDone. Every seeded account uses the password: ${SEED_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
