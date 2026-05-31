/** SEU CSE curriculum — code, title, credits, course_type, prerequisite (no ISCED / alternate). */

function prereq(value) {
  const v = String(value || '').trim();
  if (!v || v === '----' || v === '—') return '';
  return v;
}

export const CSE_CURRICULUM = [
  { code: 'GED1111', title: 'Principles of Accounting', credits: 3, course_type: 'GED Core Courses', prerequisite: prereq() },
  { code: 'GED1211', title: 'Bangladesh Studies: History and Culture', credits: 3, course_type: 'GED Core Courses', prerequisite: prereq() },
  { code: 'GED2211', title: 'Information System Management', credits: 3, course_type: 'GED Core Courses', prerequisite: prereq() },
  { code: 'GED2311', title: 'Social, Environment & Engineering Ethics', credits: 3, course_type: 'GED Core Courses', prerequisite: prereq() },
  { code: 'GED3111', title: 'Engineering Economics', credits: 3, course_type: 'GED Core Courses', prerequisite: prereq() },
  { code: 'GED3311', title: 'Entrepreneurship: Innovation and Commercialization', credits: 3, course_type: 'GED Core Courses', prerequisite: prereq() },
  { code: 'ENG1303', title: 'Advanced English Skills', credits: 3, course_type: 'Language, History and Culture', prerequisite: prereq() },
  { code: 'ENG1203', title: 'Academic English and Technical Writing', credits: 1, course_type: 'Language, History and Culture', prerequisite: prereq() },
  { code: 'ENG2105', title: 'Public Speaking', credits: 3, course_type: 'Language, History and Culture', prerequisite: prereq('ENG1303') },
  { code: 'PHY1103', title: 'Physics I', credits: 3, course_type: 'Basic Science', prerequisite: prereq() },
  { code: 'PHY1211', title: 'Physics II', credits: 3, course_type: 'Basic Science', prerequisite: prereq('PHY1103') },
  { code: 'PHY1212', title: 'Physics II Lab', credits: 1, course_type: 'Basic Science', prerequisite: prereq('PHY1103') },
  { code: 'EEE1101', title: 'Electrical Circuits I', credits: 3, course_type: 'Other Engineering', prerequisite: prereq() },
  { code: 'EEE1102', title: 'Electrical Circuits I Lab', credits: 1, course_type: 'Other Engineering', prerequisite: prereq() },
  { code: 'EEE2301', title: 'Electronic Devices & Circuits', credits: 3, course_type: 'Other Engineering', prerequisite: prereq('EEE1101') },
  { code: 'EEE2302', title: 'Electronic Devices & Circuits Lab', credits: 1, course_type: 'Other Engineering', prerequisite: prereq('EEE2301') },
  { code: 'MAT1103', title: 'Differential & Integral Calculus', credits: 3, course_type: 'Mathematics', prerequisite: prereq() },
  { code: 'MAT1203', title: 'Linear Algebra and Coordinate Geometry', credits: 3, course_type: 'Mathematics', prerequisite: prereq('MAT1103') },
  { code: 'MAT1303', title: 'Differential Equation, Laplace Transform and Fourier Analysis', credits: 3, course_type: 'Mathematics', prerequisite: prereq('MAT1203') },
  { code: 'STA3103', title: 'Probability and Statistics', credits: 3, course_type: 'Mathematics', prerequisite: prereq('MAT1303') },
  { code: 'CSE1102', title: 'Computer Fundamentals Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE1201', title: 'Structured Programming', credits: 3, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE1202', title: 'Structured Programming Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE1102') },
  { code: 'CSE1307', title: 'Discrete Mathematics', credits: 3, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE1301', title: 'Object Oriented Programming I', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE1201') },
  { code: 'CSE1302', title: 'Object Oriented Programming I Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE1202') },
  { code: 'CSE2101', title: 'Data Structures', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE1201') },
  { code: 'CSE2102', title: 'Data Structures Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE1202') },
  { code: 'CSE2103', title: 'Digital Logic Design', credits: 3, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE2104', title: 'Digital Logic Design Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE2107', title: 'Numerical Methods', credits: 3, course_type: 'Core Courses', prerequisite: prereq('MAT1303') },
  { code: 'CSE2201', title: 'Algorithm', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE2101') },
  { code: 'CSE2202', title: 'Algorithm Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE2102') },
  { code: 'CSE2301', title: 'Object Oriented Programming II', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE1301') },
  { code: 'CSE2302', title: 'Object Oriented Programming II Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE1302') },
  { code: 'CSE2303', title: 'Database Management System', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE1301') },
  { code: 'CSE2304', title: 'Database Management System Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE1301') },
  { code: 'CSE2305', title: 'Computer Architecture', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE2103') },
  { code: 'CSE3101', title: 'Microprocessors and Microcontrollers', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE2103') },
  { code: 'CSE3102', title: 'Microprocessors and Microcontrollers Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE2104') },
  { code: 'CSE3103', title: 'Information System Design and Security', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE2301') },
  { code: 'CSE3104', title: 'Information System Design and Security Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE2302') },
  { code: 'CSE3201', title: 'Operating Systems', credits: 3, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE3202', title: 'Operating Systems Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE3203', title: 'Software Engineering', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE3103') },
  { code: 'CSE3204', title: 'Software Project Development Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE3104') },
  { code: 'CSE3205', title: 'Data Communication and Communication Theory', credits: 3, course_type: 'Core Courses', prerequisite: prereq() },
  { code: 'CSE3207', title: 'Theory of Computing', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE2201') },
  { code: 'CSE3301', title: 'Artificial Intelligence', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE2301') },
  { code: 'CSE3302', title: 'Artificial Intelligence Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE2302') },
  { code: 'CSE3305', title: 'Computer Networking', credits: 3, course_type: 'Core Courses', prerequisite: prereq('CSE3205') },
  { code: 'CSE3306', title: 'Computer Networking Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE3205') },
  { code: 'CSE3310', title: 'Web Development Project Lab', credits: 1, course_type: 'Core Courses', prerequisite: prereq('CSE3208') },
  { code: 'CSE4098', title: 'Final Year Design Project I', credits: 2, course_type: 'FYDP', prerequisite: prereq('CSE3203, CSE3204') },
  { code: 'CSE4198', title: 'Final Year Design Project II', credits: 2, course_type: 'FYDP', prerequisite: prereq('CSE4098') },
  { code: 'CSE4298', title: 'Final Year Design Project III', credits: 2, course_type: 'FYDP', prerequisite: prereq('CSE4198') },
];

/** Default catalog row for section 1 — admin can add more sections later. */
export function curriculumToCatalogRow(course, overrides = {}) {
  return {
    title: course.title,
    code: course.code,
    section: overrides.section || '1',
    seat_capacity: overrides.seat_capacity ?? 40,
    credits: course.credits,
    instructor: overrides.instructor || 'TBA',
    course_type: course.course_type || '',
    prerequisite: course.prerequisite || '',
    is_active: overrides.is_active ?? false,
  };
}

export function curriculumCourseTypes() {
  return [...new Set(CSE_CURRICULUM.map((c) => c.course_type).filter(Boolean))].sort();
}
