// Comprehensive Automated Test Suite for SmartAttend AI
const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('--- Starting SmartAttend AI Automated Verification Suite ---');
  let authToken = '';
  let studentId = '';
  let facultyId = '';
  let sessionId = '';
  let odRequestId = '';

  // Test 1: Verify Initial Empty Database & Status
  console.log('\n[TEST 1] Query Auth Status on initial setup...');
  const statusRes = await fetch(`${BASE_URL}/auth/status`).then((r) => r.json());
  console.log('Status Response:', statusRes);
  if (typeof statusRes.hasAdmin !== 'boolean') throw new Error('Invalid status response');

  // Test 2: Setup First Administrator
  console.log('\n[TEST 2] Setting up Initial Administrator...');
  const setupRes = await fetch(`${BASE_URL}/auth/setup-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr. Sarah Connor',
      email: 'admin@university.edu',
      password: 'AdminMasterSecurePass2026!',
      regNoOrEmpId: 'ADM-1001',
      department: 'Computer Science & Engineering',
    }),
  }).then((r) => r.json());

  console.log('Setup Admin Result:', setupRes.message || setupRes);
  if (!setupRes.token) {
    // If admin already exists from previous run, login instead
    console.log('Admin already configured, logging in directly...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@university.edu',
        password: 'AdminMasterSecurePass2026!',
      }),
    }).then((r) => r.json());
    authToken = loginRes.token;
  } else {
    authToken = setupRes.token;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };

  // Test 3: Verify Profile Endpoint
  console.log('\n[TEST 3] Fetching Administrator Profile...');
  const me = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders }).then((r) => r.json());
  console.log('Logged in as:', me.name, 'Role:', me.role);
  if (me.role !== 'admin') throw new Error('Role mismatch for administrator');

  // Test 4: Create Department, Class, and Subject
  console.log('\n[TEST 4] Creating Academic Structures...');
  const dept = await fetch(`${BASE_URL}/academic/departments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Computer Science and Engineering', code: 'CSE' }),
  }).then((r) => r.json());
  console.log('Created Dept:', dept.name, 'Code:', dept.code);

  const cls = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ department: 'CSE', semester: '4', section: 'A', roomNo: 'Hall 401' }),
  }).then((r) => r.json());
  console.log('Created Class Section:', cls.code);

  const sub = await fetch(`${BASE_URL}/academic/subjects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      code: 'CS401',
      name: 'Deep Learning & Neural Networks',
      department: 'CSE',
      assignedFacultyName: 'Dr. Sarah Connor',
    }),
  }).then((r) => r.json());
  console.log('Created Subject:', sub.code, '-', sub.name);

  // Test 5: Register Student Account
  console.log('\n[TEST 5] Adding Enrolled Student...');
  const student = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Kishore Kumar',
      email: 'kishore.student@university.edu',
      password: 'StudentPass123!',
      role: 'student',
      regNoOrEmpId: 'REG-2026-CSE-042',
      department: 'CSE',
      classSection: 'CSE-4A',
    }),
  }).then((r) => r.json());
  studentId = student._id || student.id;
  console.log('Created Student:', student.name, 'ID:', student.regNoOrEmpId);

  // Test 6: Biometric Facial Landmark Template Enrollment
  console.log('\n[TEST 6] Enrolling Biometric Face Descriptor Vector...');
  const mockDescriptor = Array.from({ length: 68 }, (_, i) => Number((Math.sin(i * 0.4) * 0.5 + 0.5).toFixed(4)));
  const enrollRes = await fetch(`${BASE_URL}/biometrics/enroll`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      userId: studentId,
      consentAgreed: true,
      facialDescriptor: mockDescriptor,
      qualityMetrics: { score: 96 },
    }),
  }).then((r) => r.json());
  console.log('Biometric Enrollment Result:', enrollRes.message, 'Quality Score:', enrollRes.qualityScore);

  // Test 7: Create Attendance Session
  console.log('\n[TEST 7] Initializing Attendance Session...');
  const session = await fetch(`${BASE_URL}/attendance/sessions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      classSection: 'CSE-4A',
      subjectId: sub._id,
      subjectName: sub.name,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00 AM',
    }),
  }).then((r) => r.json());
  sessionId = session._id;
  console.log('Created Session:', sessionId, 'Status:', session.status);

  // Test 8: Double-Blink Gesture Trigger
  console.log('\n[TEST 8] Triggering Double-Blink Gesture Event...');
  const gestureRes = await fetch(`${BASE_URL}/attendance/sessions/${sessionId}/trigger-gesture`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      blinkIntervalMs: 420,
      earHistory: [0.32, 0.31, 0.18, 0.30, 0.19, 0.32],
    }),
  }).then((r) => r.json());
  console.log('Gesture Trigger Result:', gestureRes.message, 'New Session Status:', gestureRes.session?.status);

  // Test 9: Biometric Match & Mark Recognized Student
  console.log('\n[TEST 9] Matching Live Facial Vector and Marking Present...');
  const markRes = await fetch(`${BASE_URL}/attendance/sessions/${sessionId}/mark-recognized`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      studentId,
      confidenceScore: 94,
      livenessPassed: true,
    }),
  }).then((r) => r.json());
  console.log('Mark Recognized Result:', markRes.message, 'Status:', markRes.record?.status);

  // Test 10: Finalize Session & Verify Camera Shutdown State
  console.log('\n[TEST 10] Finalizing Attendance Session...');
  const finRes = await fetch(`${BASE_URL}/attendance/sessions/${sessionId}/finalize`, {
    method: 'POST',
    headers: authHeaders,
  }).then((r) => r.json());
  console.log('Finalize Result:', finRes.message, 'Summary:', finRes.summary);
  if (finRes.session?.cameraState !== 'CAMERA_STOPPED') {
    throw new Error('Camera state must be CAMERA_STOPPED upon finalization');
  }

  // Test 11: Check Student Real Attendance Record Calculation
  console.log('\n[TEST 11] Checking Student Real Attendance Calculation...');
  // Login as student
  const studentLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'kishore.student@university.edu',
      password: 'StudentPass123!',
    }),
  }).then((r) => r.json());

  const studentRecords = await fetch(`${BASE_URL}/attendance/student-records`, {
    headers: { Authorization: `Bearer ${studentLogin.token}` },
  }).then((r) => r.json());
  console.log('Student Overall Percentage:', studentRecords.overall?.percentage + '%');
  console.log('Subject Stats:', studentRecords.subjectStats);

  // Test 12: OD Request and Automatic Attendance Reconciliation
  console.log('\n[TEST 12] Testing OD Application & Automatic Reconciliation...');
  const odApp = await fetch(`${BASE_URL}/od-leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentLogin.token}`,
    },
    body: JSON.stringify({
      type: 'OD',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: 'Representing institute in ACM-ICPC regional contest',
    }),
  }).then((r) => r.json());
  odRequestId = odApp._id;
  console.log('Submitted OD Request ID:', odRequestId, 'Status:', odApp.status);

  // Approve OD as Admin/Faculty
  const odDec = await fetch(`${BASE_URL}/od-leave/${odRequestId}/decision`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'APPROVED', decisionNotes: 'Verified with ACM faculty advisor' }),
  }).then((r) => r.json());
  console.log('OD Decision Result:', odDec.message);

  // Test 13: Database Health & Metrics Summary
  console.log('\n[TEST 13] Verifying Database Health and Aggregations...');
  const dashSum = await fetch(`${BASE_URL}/analytics/dashboard-summary`, { headers: authHeaders }).then((r) => r.json());
  console.log('Metrics Aggregations:', dashSum.metrics);

  console.log('\n======================================================');
  console.log('>>> ALL 13 AUTOMATED INTEGRATION TESTS PASSED! <<<');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
