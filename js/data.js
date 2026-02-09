// ─── DATA ───
const PROMPT_TEXT = `Build a community tool library website where neighbors can browse and search a catalog of shared tools, request to borrow items with pickup scheduling, manage their active loans, and return tools. Include user registration, an admin dashboard for managing the tool inventory, approving loan requests, and tracking overdue items.`;

const FLOWS = [
  {
    id: 'browse-catalog',
    title: 'Browse & Search Tool Catalog',
    desc: 'Users can view the full tool catalog, apply category filters, and search tools by name or description. Results update in real-time with pagination.',
    tags: ['Catalog', 'Search', 'Filters'],
    story: [
      { keyword: 'Given', text: 'the user is on the Catalog page' },
      { keyword: 'When', text: 'they select the "Power Tools" category filter' },
      { keyword: 'And', text: 'type "drill" into the search bar' },
      { keyword: 'Then', text: 'only matching tools are displayed in real-time' },
      { keyword: 'And', text: 'clicking a tool card opens its detail page with availability status' },
    ],
    steps: [
      { action: 'Navigate to Catalog', detail: 'User opens the Catalog page from the navigation menu', url: 'https://tooldonate.com/catalog' },
      { action: 'Apply Category Filter', detail: 'Clicks "Power Tools" category to filter the catalog list', url: 'https://tooldonate.com/catalog?cat=power-tools' },
      { action: 'Search by Name', detail: 'Types "drill" into the search bar — results update in real-time', url: 'https://tooldonate.com/catalog?cat=power-tools&q=drill' },
      { action: 'View Tool Details', detail: 'Clicks on "Cordless Drill" card to see description, photos, and availability', url: 'https://tooldonate.com/catalog/cordless-drill' },
      { action: 'Verify Results', detail: 'Tool detail page loads with correct info, availability status shows "Available"', url: 'https://tooldonate.com/catalog/cordless-drill' },
    ],
    code: `import { test, expect } from '@playwright/test';

test.describe('Browse & Search Tool Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog');
  });

  test('should display catalog with tools', async ({ page }) => {
    const toolCards = page.locator('[data-testid="tool-card"]');
    await expect(toolCards).toHaveCount({ minimum: 1 });
  });

  test('should filter by category', async ({ page }) => {
    await page.click('[data-testid="filter-power-tools"]');

    const toolCards = page.locator('[data-testid="tool-card"]');
    for (const card of await toolCards.all()) {
      await expect(card.locator('.tool-category'))
        .toHaveText('Power Tools');
    }
  });

  test('should search tools by name', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'drill');
    await page.waitForTimeout(300); // debounce

    const results = page.locator('[data-testid="tool-card"]');
    await expect(results.first()).toContainText(/drill/i);
  });

  test('should open tool detail page', async ({ page }) => {
    await page.click('[data-testid="tool-card"]:first-child');

    await expect(page.locator('h1.tool-title')).toBeVisible();
    await expect(page.locator('.availability-badge')).toBeVisible();
    await expect(page.locator('.tool-description')).not.toBeEmpty();
  });
});`
  },
  {
    id: 'loan-request',
    title: 'Submit Tool Loan Request',
    desc: 'Authenticated users can select a tool, choose a pickup date and time, add notes, and submit a loan request. Form validates required fields and date constraints.',
    tags: ['Loan Form', 'Validation', 'Scheduling'],
    story: [
      { keyword: 'Given', text: 'an authenticated user is viewing a tool detail page' },
      { keyword: 'When', text: 'they click "Request to Borrow"' },
      { keyword: 'And', text: 'select a pickup date and fill in notes' },
      { keyword: 'Then', text: 'the loan request is submitted successfully' },
      { keyword: 'And', text: 'a confirmation appears with the request in their dashboard' },
    ],
    steps: [
      { action: 'Open Tool Detail', detail: 'User navigates to a specific tool page from the catalog', url: 'https://tooldonate.com/catalog/cordless-drill' },
      { action: 'Click "Request to Borrow"', detail: 'Clicks the borrow button, loan request form appears', url: 'https://tooldonate.com/catalog/cordless-drill#borrow' },
      { action: 'Select Pickup Date', detail: 'Opens the date picker and selects a date 3 days from now', url: 'https://tooldonate.com/catalog/cordless-drill#borrow' },
      { action: 'Submit Request', detail: 'Fills in additional notes and clicks "Submit Request"', url: 'https://tooldonate.com/catalog/cordless-drill#borrow' },
      { action: 'Verify Confirmation', detail: 'Success toast appears with confirmation number, request shows in user dashboard', url: 'https://tooldonate.com/my-loans' },
    ],
    code: `import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Submit Tool Loan Request', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'testuser@example.com');
    await page.goto('/catalog/cordless-drill');
  });

  test('should show borrow form when clicking request button', async ({ page }) => {
    await page.click('[data-testid="borrow-btn"]');

    await expect(page.locator('[data-testid="loan-form"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="date-picker"]'))
      .toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('[data-testid="borrow-btn"]');
    await page.click('[data-testid="submit-request"]');

    await expect(page.locator('.field-error'))
      .toContainText('Please select a pickup date');
  });

  test('should reject past dates', async ({ page }) => {
    await page.click('[data-testid="borrow-btn"]');
    await page.fill('[data-testid="date-picker"]', '2024-01-01');
    await page.click('[data-testid="submit-request"]');

    await expect(page.locator('.field-error'))
      .toContainText('Pickup date must be in the future');
  });

  test('should submit request successfully', async ({ page }) => {
    await page.click('[data-testid="borrow-btn"]');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const dateStr = futureDate.toISOString().split('T')[0];

    await page.fill('[data-testid="date-picker"]', dateStr);
    await page.fill('[data-testid="notes-input"]', 'Building a bookshelf');
    await page.click('[data-testid="submit-request"]');

    await expect(page.locator('.toast-success'))
      .toContainText('Request submitted');
    await expect(page).toHaveURL(/\\/my-loans/);
  });
});`
  },
  {
    id: 'user-registration',
    title: 'User Registration & Login',
    desc: 'New users can sign up with email and password, verify their email, complete their profile, and log in. Includes form validation and duplicate email detection.',
    tags: ['Auth', 'Registration', 'Profile'],
    story: [
      { keyword: 'Given', text: 'a new visitor is on the Sign Up page' },
      { keyword: 'When', text: 'they fill in name, email, and a strong password' },
      { keyword: 'And', text: 'submit the registration form' },
      { keyword: 'Then', text: 'a verification email is sent' },
      { keyword: 'And', text: 'after verifying, they can log in and see their dashboard' },
    ],
    steps: [
      { action: 'Navigate to Sign Up', detail: 'User clicks "Sign Up" from the homepage navigation', url: 'https://tooldonate.com/signup' },
      { action: 'Fill Registration Form', detail: 'Enters name, email, password, and confirms password', url: 'https://tooldonate.com/signup' },
      { action: 'Submit & Verify Email', detail: 'Submits form, verification email sent, user clicks verification link', url: 'https://tooldonate.com/verify-email' },
      { action: 'Complete Profile', detail: 'Adds neighborhood, phone number, and profile picture', url: 'https://tooldonate.com/complete-profile' },
      { action: 'Verify Dashboard Access', detail: 'User is redirected to their dashboard with a welcome message', url: 'https://tooldonate.com/dashboard' },
    ],
    code: `import { test, expect } from '@playwright/test';
import { generateTestEmail } from '../helpers/utils';

test.describe('User Registration & Login', () => {
  const testEmail = generateTestEmail();

  test('should show registration form', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.locator('form[data-testid="signup-form"]'))
      .toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('.field-error'))
      .toContainText('valid email');
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[data-testid="password-input"]', '123');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('.password-strength'))
      .toHaveClass(/weak/);
  });

  test('should register new user successfully', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', 'SecureP@ss123');
    await page.fill('[data-testid="confirm-password"]', 'SecureP@ss123');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('.verification-sent'))
      .toContainText('Check your email');
  });

  test('should login after registration', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', 'SecureP@ss123');
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL(/\\/dashboard/);
    await expect(page.locator('.welcome-message'))
      .toContainText('Welcome');
  });
});`
  },
  {
    id: 'admin-approve',
    title: 'Admin Approve / Reject Loan',
    desc: 'Admin users can review pending loan requests in the dashboard, inspect request details, and approve or reject them with optional notes sent to the requester.',
    tags: ['Admin', 'Dashboard', 'Loans'],
    story: [
      { keyword: 'Given', text: 'an admin is logged in and viewing the admin dashboard' },
      { keyword: 'When', text: 'they open a pending loan request' },
      { keyword: 'And', text: 'add a note and click "Approve"' },
      { keyword: 'Then', text: 'the request status changes to "Approved"' },
      { keyword: 'And', text: 'the requester receives a notification' },
    ],
    steps: [
      { action: 'Login as Admin', detail: 'Admin user signs in with admin credentials', url: 'https://tooldonate.com/login' },
      { action: 'Open Admin Dashboard', detail: 'Navigates to the admin dashboard with pending requests list', url: 'https://tooldonate.com/admin' },
      { action: 'Review Pending Request', detail: 'Clicks on a pending loan request to see full details', url: 'https://tooldonate.com/admin/requests/REQ-2024-047' },
      { action: 'Approve with Note', detail: 'Adds a note "Pickup after 3 PM" and clicks Approve', url: 'https://tooldonate.com/admin/requests/REQ-2024-047' },
      { action: 'Verify Status Update', detail: 'Request status changes to "Approved", notification sent to user', url: 'https://tooldonate.com/admin' },
    ],
    code: `import { test, expect } from '@playwright/test';
import { loginAsAdmin, createTestLoanRequest } from '../helpers/auth';

test.describe('Admin Approve / Reject Loan', () => {
  let requestId: string;

  test.beforeAll(async () => {
    requestId = await createTestLoanRequest();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('should display pending requests', async ({ page }) => {
    const pendingList = page.locator('[data-testid="pending-requests"]');
    await expect(pendingList).toBeVisible();

    const requests = pendingList.locator('.request-row');
    await expect(requests).toHaveCount({ minimum: 1 });
  });

  test('should show request details', async ({ page }) => {
    await page.click(\`[data-testid="request-\${requestId}"]\`);

    await expect(page.locator('.request-detail')).toBeVisible();
    await expect(page.locator('.requester-name')).not.toBeEmpty();
    await expect(page.locator('.requested-tool')).not.toBeEmpty();
    await expect(page.locator('.pickup-date')).not.toBeEmpty();
  });

  test('should approve request with note', async ({ page }) => {
    await page.click(\`[data-testid="request-\${requestId}"]\`);
    await page.fill('[data-testid="admin-note"]', 'Pickup after 3 PM');
    await page.click('[data-testid="approve-btn"]');

    await expect(page.locator('.toast-success'))
      .toContainText('approved');
    await expect(page.locator('.request-status'))
      .toHaveText('Approved');
  });

  test('should reject request with reason', async ({ page }) => {
    const rejectId = await createTestLoanRequest();
    await page.click(\`[data-testid="request-\${rejectId}"]\`);
    await page.fill('[data-testid="admin-note"]', 'Tool under maintenance');
    await page.click('[data-testid="reject-btn"]');

    await expect(page.locator('.request-status'))
      .toHaveText('Rejected');
  });
});`
  },
  {
    id: 'return-tool',
    title: 'Tool Return Process',
    desc: 'Users can initiate a return for a borrowed tool, confirm the tool condition, schedule a drop-off time, and complete the return. Inventory status updates automatically.',
    tags: ['Returns', 'Inventory', 'Status'],
    story: [
      { keyword: 'Given', text: 'a user has an active loan in their dashboard' },
      { keyword: 'When', text: 'they click "Return" and select the tool condition' },
      { keyword: 'And', text: 'schedule a drop-off time slot' },
      { keyword: 'Then', text: 'the return is confirmed and the loan status updates to "Returned"' },
      { keyword: 'And', text: 'the tool becomes available in the catalog again' },
    ],
    steps: [
      { action: 'Open My Loans', detail: 'User navigates to their active loans dashboard', url: 'https://tooldonate.com/my-loans' },
      { action: 'Initiate Return', detail: 'Clicks "Return" on an active loan — return form opens', url: 'https://tooldonate.com/my-loans/LN-2024-032/return' },
      { action: 'Confirm Condition', detail: 'Selects tool condition: "Good — no damage" from the dropdown', url: 'https://tooldonate.com/my-loans/LN-2024-032/return' },
      { action: 'Schedule Drop-off', detail: 'Picks a drop-off date and time slot', url: 'https://tooldonate.com/my-loans/LN-2024-032/return' },
      { action: 'Verify Completion', detail: 'Return confirmed, loan status updates to "Returned", tool becomes available again', url: 'https://tooldonate.com/my-loans' },
    ],
    code: `import { test, expect } from '@playwright/test';
import { loginAsUser, createActiveLoan } from '../helpers/auth';

test.describe('Tool Return Process', () => {
  let loanId: string;

  test.beforeAll(async () => {
    loanId = await createActiveLoan('testuser@example.com', 'cordless-drill');
  });

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'testuser@example.com');
    await page.goto('/my-loans');
  });

  test('should show active loans', async ({ page }) => {
    const activeLoans = page.locator('[data-testid="active-loan"]');
    await expect(activeLoans).toHaveCount({ minimum: 1 });
  });

  test('should open return form', async ({ page }) => {
    await page.click(\`[data-testid="return-btn-\${loanId}"]\`);

    await expect(page.locator('[data-testid="return-form"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="condition-select"]'))
      .toBeVisible();
  });

  test('should require condition selection', async ({ page }) => {
    await page.click(\`[data-testid="return-btn-\${loanId}"]\`);
    await page.click('[data-testid="confirm-return"]');

    await expect(page.locator('.field-error'))
      .toContainText('Please select tool condition');
  });

  test('should complete return successfully', async ({ page }) => {
    await page.click(\`[data-testid="return-btn-\${loanId}"]\`);

    await page.selectOption('[data-testid="condition-select"]', 'good');
    await page.click('[data-testid="dropoff-slot"]:first-child');
    await page.click('[data-testid="confirm-return"]');

    await expect(page.locator('.toast-success'))
      .toContainText('Return confirmed');
    await expect(
      page.locator(\`[data-testid="loan-\${loanId}"] .loan-status\`)
    ).toHaveText('Returned');
  });
});`
  },
  {
    id: 'overdue-tracking',
    title: 'Overdue Item Notification & Tracking',
    desc: 'System automatically detects overdue loans, sends email notifications to borrowers, and surfaces overdue items in the admin dashboard with escalation indicators.',
    tags: ['Notifications', 'Admin', 'Overdue'],
    story: [
      { keyword: 'Given', text: 'a loan has passed its due date' },
      { keyword: 'When', text: 'an admin views the Overdue Items section' },
      { keyword: 'And', text: 'clicks "Send Reminder" on an overdue item' },
      { keyword: 'Then', text: 'an email reminder is sent to the borrower' },
      { keyword: 'And', text: 'the overdue status updates to "Reminder Sent"' },
    ],
    steps: [
      { action: 'Open Admin Dashboard', detail: 'Admin logs in and opens the main admin dashboard', url: 'https://tooldonate.com/admin' },
      { action: 'View Overdue Section', detail: 'Scrolls to the "Overdue Items" section showing flagged loans', url: 'https://tooldonate.com/admin#overdue' },
      { action: 'Send Reminder', detail: 'Clicks "Send Reminder" on an overdue item — confirmation prompt appears', url: 'https://tooldonate.com/admin#overdue' },
      { action: 'Verify Notification Sent', detail: 'Email notification is sent, status updates to "Reminder Sent" with timestamp', url: 'https://tooldonate.com/admin#overdue' },
    ],
    code: `import { test, expect } from '@playwright/test';
import { loginAsAdmin, createOverdueLoan } from '../helpers/auth';
import { getLastEmail } from '../helpers/email';

test.describe('Overdue Item Notification & Tracking', () => {
  test.beforeAll(async () => {
    await createOverdueLoan('borrower@example.com', 'circular-saw');
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('should display overdue items section', async ({ page }) => {
    const overdueSection = page.locator('[data-testid="overdue-section"]');
    await expect(overdueSection).toBeVisible();

    const overdueItems = overdueSection.locator('.overdue-item');
    await expect(overdueItems).toHaveCount({ minimum: 1 });
  });

  test('should show overdue badge with days count', async ({ page }) => {
    const badge = page.locator('.overdue-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/\\d+ days? overdue/);
  });

  test('should send reminder notification', async ({ page }) => {
    await page.click('[data-testid="send-reminder"]:first-child');

    // Confirm the reminder dialog
    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await page.click('[data-testid="confirm-send"]');

    await expect(page.locator('.toast-success'))
      .toContainText('Reminder sent');

    // Verify status update
    await expect(
      page.locator('.overdue-item:first-child .reminder-status')
    ).toContainText('Reminder Sent');
  });

  test('should verify email was delivered', async () => {
    const email = await getLastEmail('borrower@example.com');
    expect(email.subject).toContain('Overdue');
    expect(email.body).toContain('circular-saw');
  });
});`
  }
];

// ─── VERSION HISTORY ───
const VERSIONS = [
  {
    hash: 'a1b0e7d', label: 'v1.0 — Initial Generation', date: 'Feb 6, 10:33 AM',
    changes: [],
    widgetChanges: [],
    flowChanges: [],
    description: 'Initial site generation from prompt. All flows baseline.',
  },
  {
    hash: 'c3d8f12', label: 'v1.1 — Removed "Sign Up" CTA', date: 'Feb 6, 2:15 PM',
    changes: [
      { nodeId: 'uf-auth', type: 'modified', desc: 'Registration entry point changed' },
      { nodeId: 'uf-cta', type: 'modified', desc: 'Homepage CTAs updated' },
    ],
    widgetChanges: [
      { widgetId: 'navigation', type: 'modified', desc: 'Sign Up button removed from nav' },
      { widgetId: 'hero-banner', type: 'modified', desc: 'Hero CTA now primary registration entry' },
    ],
    flowChanges: [
      { flowId: 'user-registration', type: 'modified', desc: 'Registration entry point changed from nav to hero CTA', changedStoryIndices: [0], changedStepIndices: [0] },
    ],
    diffs: [
      {
        id: 'signup-btn-removed',
        title: '"Sign Up Free" Button Removed from Nav',
        type: 'removed',
        description: 'The "Sign Up Free" button was removed from the top navigation bar. Users now access registration through the "Get Started" hero button instead.',
        url: 'https://tooldonate.com/',
        mockup: 'nav-signup-removed',
      },
    ],
    description: 'Removed duplicate Sign Up button from navigation. Registration now funneled through hero CTA.',
  },
  {
    hash: '8f2a4b9', label: 'v1.2 — Search Bar Redesign', date: 'Feb 7, 9:45 AM',
    changes: [
      { nodeId: 'uf-nav-catalog', type: 'modified', desc: 'Search component restructured' },
      { nodeId: 'uf-nav-home', type: 'modified', desc: 'Search moved from catalog to global header' },
    ],
    widgetChanges: [
      { widgetId: 'search-filter', type: 'modified', desc: 'Search input moved to global header' },
      { widgetId: 'navigation', type: 'modified', desc: 'Search bar integrated into nav' },
    ],
    flowChanges: [
      { flowId: 'browse-catalog', type: 'modified', desc: 'Search step now starts from header instead of catalog page', changedStoryIndices: [2], changedStepIndices: [2] },
    ],
    diffs: [
      {
        id: 'search-moved',
        title: 'Search Bar Moved to Global Header',
        type: 'moved',
        description: 'The search bar was moved from the Catalog page into the global Header component, making it accessible from every page. The old search location in the catalog is now empty.',
        url: 'https://tooldonate.com/',
        mockup: 'search-moved',
      },
    ],
    description: 'Moved search bar from Catalog page to global header for better discoverability.',
  },
  {
    hash: 'e5c1d03', label: 'v1.3 — New Quick Borrow Flow', date: 'Feb 7, 3:20 PM',
    changes: [
      { nodeId: 'uf-cta', type: 'modified', desc: 'New CTA added to homepage' },
      { nodeId: 'uf-nav-catalog-detail', type: 'modified', desc: 'Borrow modal updated' },
    ],
    widgetChanges: [
      { widgetId: 'hero-banner', type: 'modified', desc: 'Quick Borrow card added below hero' },
      { widgetId: 'booking-modal', type: 'modified', desc: 'Simplified booking form with fewer fields' },
      { widgetId: 'tool-card', type: 'added', desc: 'New featured tool card variant for quick borrow' },
    ],
    flowChanges: [
      { flowId: 'request-tool-loan', type: 'modified', desc: 'New quick borrow shortcut from homepage' },
      { flowId: 'browse-catalog', type: 'modified', desc: 'Featured tool card links directly to borrow modal', changedStoryIndices: [4], changedStepIndices: [3] },
    ],
    diffs: [
      {
        id: 'quick-borrow-added',
        title: '"Quick Borrow" Card Added to Homepage',
        type: 'added',
        description: 'A new "Quick Borrow" featured tool card was added below the hero section, allowing users to request the most popular tool directly from the homepage without visiting the catalog first.',
        url: 'https://tooldonate.com/',
        mockup: 'quick-borrow-added',
      },
    ],
    description: 'Added Quick Borrow card to homepage + simplified borrow modal with fewer required fields.',
  },
  {
    hash: '4a3f2c1', label: 'v1.4 — Admin Overdue Redesign', date: 'Feb 8, 10:12 AM',
    changes: [
      { nodeId: 'uf-nav-dashboard', type: 'modified', desc: 'Dashboard notifications revamped' },
    ],
    widgetChanges: [
      { widgetId: 'hero-banner', type: 'modified', desc: 'Admin Access button removed from hero' },
      { widgetId: 'navigation', type: 'modified', desc: 'Admin link moved to account dropdown' },
    ],
    flowChanges: [
      { flowId: 'admin-manage-inventory', type: 'modified', desc: 'Admin access moved to account menu' },
      { flowId: 'admin-approve', type: 'modified', desc: 'Admin access now via account menu instead of hero button', changedStoryIndices: [0], changedStepIndices: [0, 1] },
      { flowId: 'return-tool', type: 'modified', desc: 'Overdue alert banner replaces badge notification', changedStoryIndices: [0], changedStepIndices: [0] },
    ],
    diffs: [
      {
        id: 'overdue-banner',
        title: 'Overdue Alert Banner Added to Dashboard',
        type: 'added',
        description: 'A persistent alert banner now appears at the top of the user dashboard when they have overdue items, replacing the previous subtle badge indicator.',
        url: 'https://tooldonate.com/my-loans',
        mockup: 'overdue-banner',
      },
      {
        id: 'admin-btn-moved',
        title: '"Admin Access" Button Moved to Account Menu',
        type: 'moved',
        description: 'The "Admin Access" button was moved from the homepage hero section into the account dropdown menu in the header, decluttering the hero for non-admin users.',
        url: 'https://tooldonate.com/',
        mockup: 'admin-moved',
      },
    ],
    description: 'Redesigned overdue notifications + moved Admin Access button to account menu.',
  },
];

// ─── FLOW CODE VERSION HISTORY ───
// Maps flow ID to historical code snapshots for diff display between versions.
// Each entry: { upToVersion: <versionIdx>, code: <string> }
// Lookup: for version V, use the first entry where upToVersion >= V. Else use FLOWS[].code.
const FLOW_CODE_HISTORY = {
  'browse-catalog': [
    { upToVersion: 1, code: `import { test, expect } from '@playwright/test';

test.describe('Browse & Search Tool Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog');
  });

  test('should display catalog with tools', async ({ page }) => {
    const toolCards = page.locator('[data-testid="tool-card"]');
    await expect(toolCards).toHaveCount({ minimum: 1 });
  });

  test('should filter by category', async ({ page }) => {
    await page.click('[data-testid="filter-power-tools"]');

    const toolCards = page.locator('[data-testid="tool-card"]');
    for (const card of await toolCards.all()) {
      await expect(card.locator('.tool-category'))
        .toHaveText('Power Tools');
    }
  });

  test('should search tools on catalog page', async ({ page }) => {
    // Search bar is located on the catalog page
    const searchSection = page.locator('.catalog-search-section');
    await searchSection.locator('input[placeholder="Search tools..."]').fill('drill');
    await page.waitForTimeout(300); // debounce

    const results = page.locator('[data-testid="tool-card"]');
    await expect(results.first()).toContainText(/drill/i);
  });

  test('should open tool detail page', async ({ page }) => {
    await page.click('[data-testid="tool-card"]:first-child');

    await expect(page.locator('h1.tool-title')).toBeVisible();
    await expect(page.locator('.availability-badge')).toBeVisible();
    await expect(page.locator('.tool-description')).not.toBeEmpty();
  });
});` }
  ],
  'user-registration': [
    { upToVersion: 0, code: `import { test, expect } from '@playwright/test';
import { generateTestEmail } from '../helpers/utils';

test.describe('User Registration & Login', () => {
  const testEmail = generateTestEmail();

  test('should navigate to signup from nav button', async ({ page }) => {
    await page.goto('/');
    // Click "Sign Up Free" button in the navigation bar
    await page.click('[data-testid="nav-signup-btn"]');
    await expect(page).toHaveURL(/\\/signup/);
    await expect(page.locator('form[data-testid="signup-form"]'))
      .toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('.field-error'))
      .toContainText('valid email');
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[data-testid="password-input"]', '123');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('.password-strength'))
      .toHaveClass(/weak/);
  });

  test('should register new user via nav signup', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="nav-signup-btn"]');

    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', 'SecureP@ss123');
    await page.fill('[data-testid="confirm-password"]', 'SecureP@ss123');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('.verification-sent'))
      .toContainText('Check your email');
  });

  test('should login after registration', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', 'SecureP@ss123');
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL(/\\/dashboard/);
    await expect(page.locator('.welcome-message'))
      .toContainText('Welcome');
  });
});` }
  ],
  'admin-approve': [
    { upToVersion: 3, code: `import { test, expect } from '@playwright/test';
import { loginAsAdmin, createTestLoanRequest } from '../helpers/auth';

test.describe('Admin Approve / Reject Loan', () => {
  let requestId: string;

  test.beforeAll(async () => {
    requestId = await createTestLoanRequest();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to admin via hero button on homepage
    await page.goto('/');
    await page.click('[data-testid="hero-admin-btn"]');
    await expect(page).toHaveURL(/\\/admin/);
  });

  test('should display pending requests', async ({ page }) => {
    const pendingList = page.locator('[data-testid="pending-requests"]');
    await expect(pendingList).toBeVisible();

    const requests = pendingList.locator('.request-row');
    await expect(requests).toHaveCount({ minimum: 1 });
  });

  test('should show request details', async ({ page }) => {
    await page.click(\`[data-testid="request-\${requestId}"]\`);

    await expect(page.locator('.request-detail')).toBeVisible();
    await expect(page.locator('.requester-name')).not.toBeEmpty();
    await expect(page.locator('.requested-tool')).not.toBeEmpty();
    await expect(page.locator('.pickup-date')).not.toBeEmpty();
  });

  test('should approve request with note', async ({ page }) => {
    await page.click(\`[data-testid="request-\${requestId}"]\`);
    await page.fill('[data-testid="admin-note"]', 'Pickup after 3 PM');
    await page.click('[data-testid="approve-btn"]');

    await expect(page.locator('.toast-success'))
      .toContainText('approved');
    await expect(page.locator('.request-status'))
      .toHaveText('Approved');
  });

  test('should reject request with reason', async ({ page }) => {
    const rejectId = await createTestLoanRequest();
    await page.click(\`[data-testid="request-\${rejectId}"]\`);
    await page.fill('[data-testid="admin-note"]', 'Tool under maintenance');
    await page.click('[data-testid="reject-btn"]');

    await expect(page.locator('.request-status'))
      .toHaveText('Rejected');
  });
});` }
  ]
};

// ─── WIDGET LIBRARY ───
const WIDGETS = [
  {
    id: 'hero-banner',
    name: 'Hero Banner',
    category: 'Layout',
    icon: '🎯',
    description: 'Full-width hero section with headline, sub-text, CTA buttons and a decorative image area. Supports customizable badge text.',
    props: [
      { name: 'badge', type: 'text', default: 'SYSTEM ONLINE V2.0' },
      { name: 'title', type: 'text', default: 'SHARE TOOLS. BUILD FUTURE.' },
      { name: 'subtitle', type: 'text', default: 'Access professional-grade equipment without the overhead.' },
      { name: 'primaryCta', type: 'text', default: 'BROWSE CATALOG' },
      { name: 'secondaryCta', type: 'text', default: 'ADMIN ACCESS' },
      { name: 'accentColor', type: 'color', default: '#f97316' },
    ],
    render(p) {
      return `<div style="background:linear-gradient(135deg,#0a0a15 60%,#1a1030);padding:32px;border-radius:12px;color:#fff;font-family:system-ui">
        <div style="font-size:9px;letter-spacing:2px;color:${p.accentColor};margin-bottom:12px;font-weight:700">${p.badge}</div>
        <div style="font-size:22px;font-weight:900;line-height:1.15;margin-bottom:10px">${p.title.replace(/\.\s*/,'.<br>')}</div>
        <div style="font-size:11px;color:#999;margin-bottom:16px;max-width:280px">${p.subtitle}</div>
        <div style="display:flex;gap:8px">
          <button style="background:${p.accentColor};color:#000;border:none;padding:8px 16px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">${p.primaryCta} →</button>
          <button style="background:transparent;color:#fff;border:1px solid #333;padding:8px 16px;border-radius:6px;font-size:11px;cursor:pointer">${p.secondaryCta}</button>
        </div>
      </div>`;
    }
  },
  {
    id: 'navigation',
    name: 'Navigation Bar',
    category: 'Layout',
    icon: '🧭',
    description: 'Responsive top navigation with logo, page links and a sign-in button. Sticky positioning with backdrop blur.',
    props: [
      { name: 'logo', type: 'text', default: 'ToolShare' },
      { name: 'ctaLabel', type: 'text', default: 'Sign In' },
      { name: 'ctaColor', type: 'color', default: '#7c3aed' },
    ],
    render(p) {
      return `<div style="background:#0a0a15;padding:14px 20px;border-radius:10px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#fff;font-size:14px">🔧 ${p.logo}</div>
        <div style="display:flex;gap:16px;align-items:center">
          <a style="color:#fff;font-size:12px;text-decoration:none">Home</a>
          <a style="color:#888;font-size:12px;text-decoration:none">Catalog</a>
          <a style="color:#888;font-size:12px;text-decoration:none">Admin</a>
          <button style="background:${p.ctaColor};color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">${p.ctaLabel}</button>
        </div>
      </div>`;
    }
  },
  {
    id: 'tool-card',
    name: 'Tool Card',
    category: 'Components',
    icon: '🃏',
    description: 'Catalog item card with image placeholder, status badge, name, category tag and description. Supports Available, On Loan, High Risk and Maintenance states.',
    props: [
      { name: 'name', type: 'text', default: 'Cordless Drill' },
      { name: 'category', type: 'text', default: 'POWER TOOLS' },
      { name: 'description', type: 'text', default: '20V MAX cordless drill driver with brushless motor.' },
      { name: 'status', type: 'select', default: 'Available', options: ['Available', 'On Loan', 'High Risk', 'Maintenance'] },
    ],
    render(p) {
      const colors = { 'Available':'#22c55e', 'On Loan':'#f59e0b', 'High Risk':'#ef4444', 'Maintenance':'#6b7280' };
      return `<div style="background:#12121e;border-radius:12px;overflow:hidden;width:220px;font-family:system-ui;border:1px solid #1e1e33">
        <div style="background:#1a1a2e;height:120px;display:flex;align-items:center;justify-content:center;font-size:40px;position:relative">🔩
          <span style="position:absolute;top:8px;right:8px;background:${colors[p.status]||'#22c55e'};color:#000;font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px">${p.status}</span>
        </div>
        <div style="padding:14px">
          <div style="font-weight:700;color:#fff;font-size:13px;margin-bottom:4px">${p.name}</div>
          <span style="font-size:9px;font-weight:700;color:#f97316;letter-spacing:1px">${p.category}</span>
          <div style="font-size:11px;color:#888;margin-top:6px;line-height:1.4">${p.description}</div>
        </div>
      </div>`;
    }
  },
  {
    id: 'search-filter',
    name: 'Search & Filter Bar',
    category: 'Components',
    icon: '🔍',
    description: 'Combined search input with category filter dropdown. Real-time search with icon prefix and responsive layout.',
    props: [
      { name: 'placeholder', type: 'text', default: 'Search tools...' },
      { name: 'filterLabel', type: 'text', default: 'All Categories' },
    ],
    render(p) {
      return `<div style="display:flex;gap:10px;padding:16px;background:#0f0f1a;border-radius:10px;font-family:system-ui">
        <div style="flex:1;display:flex;align-items:center;gap:8px;background:#1a1a2e;border:1px solid #2a2a40;border-radius:8px;padding:10px 14px">
          <span style="color:#666">🔍</span>
          <span style="color:#555;font-size:13px">${p.placeholder}</span>
        </div>
        <button style="background:#1a1a2e;color:#ccc;border:1px solid #2a2a40;padding:10px 16px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer">☰ ${p.filterLabel}</button>
      </div>`;
    }
  },
  {
    id: 'stats-counter',
    name: 'Stats Counter',
    category: 'Components',
    icon: '📊',
    description: 'Animated statistics display card with large number, label and descriptive sub-text. Features subtle gear decoration.',
    props: [
      { name: 'value', type: 'text', default: '150+' },
      { name: 'label', type: 'text', default: 'Tools' },
      { name: 'subtext', type: 'text', default: 'PROFESSIONAL GRADE' },
    ],
    render(p) {
      return `<div style="display:flex;gap:12px;font-family:system-ui">
        <div style="background:#12121e;border:1px solid #1e1e33;border-radius:12px;padding:20px;text-align:center;flex:1">
          <div style="font-size:10px;color:#444;margin-bottom:4px">⚙</div>
          <div style="font-size:28px;font-weight:900;color:#fff">${p.value}</div>
          <div style="font-size:12px;color:#ccc;margin-top:2px">${p.label}</div>
          <div style="font-size:9px;color:#555;letter-spacing:1px;margin-top:4px">${p.subtext}</div>
        </div>
      </div>`;
    }
  },
  {
    id: 'workflow-steps',
    name: 'Workflow Steps',
    category: 'Layout',
    icon: '📋',
    description: 'Numbered step-by-step workflow display with icons, titles and descriptions. Used to explain the tool borrowing process.',
    props: [
      { name: 'step1Title', type: 'text', default: 'Browse Tools' },
      { name: 'step2Title', type: 'text', default: 'Easy Booking' },
      { name: 'step3Title', type: 'text', default: 'Safety First' },
    ],
    render(p) {
      const steps = [
        { num: '01', icon: '🔍', title: p.step1Title, desc: 'Explore our extensive catalog' },
        { num: '02', icon: '📅', title: p.step2Title, desc: 'Reserve with our simple system' },
        { num: '03', icon: '🛡️', title: p.step3Title, desc: 'Automatic safety restrictions' },
      ];
      return `<div style="background:#0f0f1a;padding:20px;border-radius:12px;font-family:system-ui;display:flex;flex-direction:column;gap:14px">
        ${steps.map(s => `<div style="display:flex;align-items:center;gap:12px;background:#12121e;padding:14px;border-radius:10px;border:1px solid #1e1e33">
          <div style="color:#f97316;font-weight:900;font-size:16px;min-width:24px">${s.num}</div>
          <div style="font-size:20px">${s.icon}</div>
          <div><div style="color:#fff;font-size:12px;font-weight:700">${s.title}</div><div style="color:#888;font-size:10px;margin-top:2px">${s.desc}</div></div>
        </div>`).join('')}
      </div>`;
    }
  },
  {
    id: 'marquee',
    name: 'Marquee Ticker',
    category: 'Layout',
    icon: '📰',
    description: 'Infinite-scrolling horizontal ticker with decorative items. CSS-only animation with configurable speed.',
    props: [
      { name: 'item1', type: 'text', default: 'HIGH PRECISION TOOLS' },
      { name: 'item2', type: 'text', default: 'COMMUNITY DRIVEN' },
      { name: 'item3', type: 'text', default: 'SMART INVENTORY' },
    ],
    render(p) {
      const items = [p.item1, p.item2, p.item3];
      return `<div style="background:#0a0a15;padding:14px 0;border-radius:10px;overflow:hidden;font-family:system-ui">
        <div style="display:flex;gap:24px;white-space:nowrap;padding:0 16px">
          ${items.map(i => `<span style="color:#888;font-size:11px;font-weight:600">✦ ${i} <span style="color:#333">●</span></span>`).join('')}
        </div>
      </div>`;
    }
  },
  {
    id: 'cta-section',
    name: 'CTA Section',
    category: 'Layout',
    icon: '📢',
    description: 'Call-to-action section with badge, headline, description and dual action buttons. Centered layout with gradient background.',
    props: [
      { name: 'badge', type: 'text', default: 'SYSTEM READY' },
      { name: 'headline', type: 'text', default: 'INITIALIZE YOUR PROJECT' },
      { name: 'description', type: 'text', default: 'Join the collective. Access professional tools.' },
      { name: 'primaryCta', type: 'text', default: 'BROWSE CATALOG' },
      { name: 'secondaryCta', type: 'text', default: 'AUTHENTICATE' },
    ],
    render(p) {
      return `<div style="background:linear-gradient(135deg,#0f0f1a,#1a1030);padding:32px;border-radius:12px;text-align:center;font-family:system-ui">
        <div style="font-size:9px;letter-spacing:2px;color:#7c3aed;font-weight:700;margin-bottom:10px">${p.badge}</div>
        <div style="font-size:18px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:10px">${p.headline}</div>
        <div style="font-size:11px;color:#888;margin-bottom:16px;max-width:300px;margin-left:auto;margin-right:auto">${p.description}</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button style="background:#f97316;color:#000;border:none;padding:8px 16px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">${p.primaryCta}</button>
          <button style="background:#1a1a1a;color:#fff;border:1px solid #333;padding:8px 16px;border-radius:6px;font-size:11px;cursor:pointer">${p.secondaryCta}</button>
        </div>
      </div>`;
    }
  },
  {
    id: 'footer',
    name: 'Footer',
    category: 'Layout',
    icon: '🏷️',
    description: 'Multi-column footer with brand section, link columns, contact info and copyright bar. Responsive grid layout.',
    props: [
      { name: 'brand', type: 'text', default: 'ToolShare' },
      { name: 'tagline', type: 'text', default: 'Building community through shared resources.' },
      { name: 'copyright', type: 'text', default: '2026 ToolShare' },
    ],
    render(p) {
      return `<div style="background:#080810;padding:24px;border-radius:12px;font-family:system-ui;border:1px solid #1e1e33">
        <div style="display:flex;gap:24px;margin-bottom:16px">
          <div style="flex:1.5"><div style="color:#fff;font-weight:700;font-size:13px;margin-bottom:6px">🔧 ${p.brand}</div><div style="color:#666;font-size:10px;line-height:1.4">${p.tagline}</div></div>
          <div style="flex:1"><div style="color:#888;font-size:10px;font-weight:700;margin-bottom:6px">Quick Links</div><div style="color:#555;font-size:10px;line-height:1.8">Browse Catalog<br>My Dashboard<br>My Profile</div></div>
          <div style="flex:1"><div style="color:#888;font-size:10px;font-weight:700;margin-bottom:6px">Contact</div><div style="color:#555;font-size:10px;line-height:1.8">✉ hello@toolshare.com<br>📞 (555) 123-4567</div></div>
        </div>
        <div style="border-top:1px solid #1e1e33;padding-top:10px;display:flex;justify-content:space-between;color:#444;font-size:9px">
          <span>© ${p.copyright}</span><span>Privacy · Terms</span>
        </div>
      </div>`;
    }
  },
  {
    id: 'booking-modal',
    name: 'Booking Modal',
    category: 'Components',
    icon: '📅',
    description: 'Date picker modal for scheduling tool pickup. Features calendar view, time slots and confirmation button.',
    props: [
      { name: 'toolName', type: 'text', default: 'Cordless Drill' },
      { name: 'status', type: 'text', default: 'Available' },
      { name: 'confirmLabel', type: 'text', default: 'Confirm Booking' },
      { name: 'accentColor', type: 'color', default: '#7c3aed' },
    ],
    render(p) {
      return `<div style="background:#12121e;border-radius:12px;padding:24px;font-family:system-ui;border:1px solid #2a2a40;max-width:280px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:700;color:#fff;font-size:14px">📅 Book Tool</div>
          <span style="color:#666;cursor:pointer;font-size:16px">✕</span>
        </div>
        <div style="color:#888;font-size:11px;margin-bottom:12px">${p.toolName} · ${p.status}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px;text-align:center">
          <div style="color:#555;font-size:9px;font-weight:700">Mo</div><div style="color:#555;font-size:9px;font-weight:700">Tu</div><div style="color:#555;font-size:9px;font-weight:700">We</div><div style="color:#555;font-size:9px;font-weight:700">Th</div><div style="color:#555;font-size:9px;font-weight:700">Fr</div><div style="color:#555;font-size:9px;font-weight:700">Sa</div><div style="color:#555;font-size:9px;font-weight:700">Su</div>
          <div style="color:#444;font-size:10px;padding:4px">1</div><div style="color:#444;font-size:10px;padding:4px">2</div><div style="color:#fff;font-size:10px;padding:4px;background:${p.accentColor};border-radius:4px">3</div><div style="color:#ccc;font-size:10px;padding:4px">4</div><div style="color:#ccc;font-size:10px;padding:4px">5</div><div style="color:#444;font-size:10px;padding:4px">6</div><div style="color:#444;font-size:10px;padding:4px">7</div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px">
          <span style="padding:5px 10px;border-radius:6px;font-size:10px;background:#1e1e33;color:#ccc">9:00 AM</span>
          <span style="padding:5px 10px;border-radius:6px;font-size:10px;background:${p.accentColor};color:#fff">11:00 AM</span>
          <span style="padding:5px 10px;border-radius:6px;font-size:10px;background:#1e1e33;color:#ccc">2:00 PM</span>
        </div>
        <button style="width:100%;background:${p.accentColor};color:#fff;border:none;padding:10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">${p.confirmLabel}</button>
      </div>`;
    }
  },
  {
    id: 'listing-wizard',
    name: 'Listing Wizard',
    category: 'Components',
    icon: '🧙',
    description: 'Multi-step wizard modal for listing a new tool. Navigate between Details, Availability, Photos and Review steps using the in-preview buttons or the Step control.',
    props: [
      { name: 'step', type: 'select', default: 'Details', options: ['Details', 'Availability', 'Photos', 'Review'] },
      { name: 'title', type: 'text', default: 'List Your Tool' },
      { name: 'toolName', type: 'text', default: 'Cordless Drill Pro' },
      { name: 'accentColor', type: 'color', default: '#7c3aed' },
      { name: 'showProgress', type: 'boolean', default: true },
    ],
    render(p) {
      const steps = ['Details', 'Availability', 'Photos', 'Review'];
      const ci = Math.max(0, steps.indexOf(p.step));

      /* ── Progress indicator ── */
      const progressBar = p.showProgress ? `
        <div style="display:flex;align-items:flex-start;margin-bottom:18px;position:relative">
          <div style="position:absolute;top:11px;left:12%;right:12%;height:2px;background:#2a2a40"></div>
          <div style="position:absolute;top:11px;left:12%;height:2px;background:${ci > 0 ? p.accentColor : 'transparent'};width:${(ci / (steps.length - 1)) * 76}%"></div>
          ${steps.map((s, i) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;z-index:1">
              <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;background:${i < ci ? '#22C55E' : i === ci ? p.accentColor : '#2a2a40'}">${i < ci ? '✓' : i + 1}</div>
              <div style="font-size:8px;margin-top:4px;color:${i === ci ? '#fff' : '#555'};white-space:nowrap">${s}</div>
            </div>
          `).join('')}
        </div>` : '';

      /* ── Reusable inline styles ── */
      const inputSt = 'width:100%;padding:8px 10px;border-radius:6px;border:1px solid #2a2a40;background:#1a1a2e;color:#ccc;font-size:11px;font-family:system-ui';
      const labelSt = 'font-size:10px;color:#888;margin-bottom:4px;display:block';
      const gap = 'margin-bottom:10px';

      /* ── Step content ── */
      let content;
      if (ci === 0) {
        content = `
          <div style="${gap}"><label style="${labelSt}">Tool Name</label><input style="${inputSt}" value="${p.toolName}" readonly></div>
          <div style="${gap}"><label style="${labelSt}">Category</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${['Power Tools', 'Hand Tools', 'Garden', 'Safety'].map((c, i) =>
                `<span style="padding:5px 10px;border-radius:14px;font-size:10px;cursor:pointer;${i === 0 ? `background:${p.accentColor};color:#fff` : 'background:#1e1e33;color:#888'}">${c}</span>`
              ).join('')}
            </div>
          </div>
          <div><label style="${labelSt}">Condition</label>
            <div style="display:flex;gap:6px">
              ${['New', 'Like New', 'Good', 'Fair'].map((c, i) =>
                `<span style="padding:5px 10px;border-radius:14px;font-size:10px;cursor:pointer;${i === 1 ? `background:${p.accentColor}33;color:${p.accentColor};border:1px solid ${p.accentColor}` : 'background:#1e1e33;color:#888;border:1px solid transparent'}">${c}</span>`
              ).join('')}
            </div>
          </div>`;
      } else if (ci === 1) {
        content = `
          <div style="display:flex;gap:8px;${gap}">
            <div style="flex:1"><label style="${labelSt}">Available From</label><input type="text" style="${inputSt}" value="Feb 10, 2026" readonly></div>
            <div style="flex:1"><label style="${labelSt}">Until</label><input type="text" style="${inputSt}" value="Mar 15, 2026" readonly></div>
          </div>
          <div style="${gap}"><label style="${labelSt}">Rental Price (per day)</label><input style="${inputSt}" value="$12.00" readonly></div>
          <div style="${gap}"><label style="${labelSt}">Security Deposit</label><input style="${inputSt}" value="$50.00" readonly></div>
          <div style="background:#1a1a2e;border-radius:8px;padding:10px;border:1px solid #2a2a40">
            <div style="font-size:10px;color:#888;margin-bottom:4px">Pickup Location</div>
            <div style="font-size:11px;color:#ccc">📍 Community Center — 123 Main St</div>
          </div>`;
      } else if (ci === 2) {
        content = `
          <div style="border:2px dashed #2a2a40;border-radius:10px;padding:20px;text-align:center;${gap}">
            <div style="font-size:24px;margin-bottom:6px">📷</div>
            <div style="font-size:11px;color:#888;margin-bottom:4px">Drag photos here or click to upload</div>
            <div style="font-size:9px;color:#555">JPG, PNG up to 5MB each</div>
          </div>
          <div style="display:flex;gap:6px;${gap}">
            <div style="width:48px;height:48px;border-radius:6px;background:#1e1e33;display:flex;align-items:center;justify-content:center;font-size:18px">🔧</div>
            <div style="width:48px;height:48px;border-radius:6px;background:#1e1e33;display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>
            <div style="width:48px;height:48px;border-radius:6px;background:#1e1e33;border:1px dashed #2a2a40;display:flex;align-items:center;justify-content:center;font-size:14px;color:#555">+</div>
          </div>
          <div><label style="${labelSt}">Description</label>
            <div style="${inputSt};min-height:48px;line-height:1.5">Professional-grade cordless drill with two batteries and carrying case. Well maintained.</div>
          </div>`;
      } else {
        content = `
          <div style="background:#1a1a2e;border-radius:8px;padding:12px;border:1px solid #2a2a40;${gap}">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:13px;font-weight:700;color:#fff">${p.toolName}</span>
              <span style="font-size:10px;color:#22C55E;background:#22C55E22;padding:2px 8px;border-radius:10px">Ready</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">
              <div><span style="color:#666">Category:</span> <span style="color:#ccc">Power Tools</span></div>
              <div><span style="color:#666">Condition:</span> <span style="color:#ccc">Like New</span></div>
              <div><span style="color:#666">Price:</span> <span style="color:#ccc">$12.00/day</span></div>
              <div><span style="color:#666">Deposit:</span> <span style="color:#ccc">$50.00</span></div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;background:${p.accentColor}15;border:1px solid ${p.accentColor}33;border-radius:8px;padding:10px">
            <input type="checkbox" checked style="margin-top:2px;accent-color:${p.accentColor}">
            <span style="font-size:10px;color:#999;line-height:1.4">I confirm this tool is in working condition and available for the listed dates.</span>
          </div>`;
      }

      /* ── Navigation buttons ── */
      const prevStep = ci > 0 ? steps[ci - 1] : null;
      const nextStep = ci < steps.length - 1 ? steps[ci + 1] : null;
      const btnBase = 'padding:7px 14px;border-radius:6px;font-size:11px;cursor:pointer;font-family:system-ui';
      const nav = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid #2a2a40">
          ${prevStep
            ? `<button onclick="wizardGoToStep('${prevStep}')" style="background:transparent;color:#999;border:1px solid #2a2a40;${btnBase}">← Back</button>`
            : '<div></div>'}
          <div style="font-size:10px;color:#555">${ci + 1} of ${steps.length}</div>
          ${nextStep
            ? `<button onclick="wizardGoToStep('${nextStep}')" style="background:${p.accentColor};color:#fff;border:none;font-weight:600;${btnBase}">Next →</button>`
            : `<button style="background:#22C55E;color:#fff;border:none;font-weight:600;${btnBase}">Submit ✓</button>`}
        </div>`;

      return `<div style="background:#12121e;border-radius:12px;padding:20px;font-family:system-ui;border:1px solid #2a2a40;max-width:300px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:700;color:#fff;font-size:14px">🧙 ${p.title}</div>
          <span style="color:#666;cursor:pointer;font-size:16px">✕</span>
        </div>
        ${progressBar}
        <div style="font-size:12px;font-weight:600;color:#fff;margin-bottom:12px">${steps[ci]}</div>
        ${content}
        ${nav}
      </div>`;
    }
  }
];

let currentVersionIdx = VERSIONS.length - 1;

// ─── STATE ───
let currentScreen = 'landing';
let currentPage = 'Home';
let flowStates = FLOWS.map(() => ({ status: 'idle', duration: null, result: null }));
let visFlowIdx = 0, visStepIdx = 0;
let autoplayTimer = null;

// ─── SCREEN TRANSITIONS ───
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  currentScreen = name;
}

// ─── LANDING → GENERATION ───
function startGeneration() {
  const ta = document.getElementById('promptInput');
  if (!ta.value.trim()) {
    ta.value = PROMPT_TEXT;
    return;
  }
  showScreen('editor');
  document.getElementById('genOverlay').classList.add('active');
  animateGenSteps();
}

// Auto-type prompt on load
window.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('promptInput');
  let i = 0;
  const typeInterval = setInterval(() => {
    if (i < PROMPT_TEXT.length) {
      ta.value = PROMPT_TEXT.slice(0, ++i);
      ta.scrollTop = ta.scrollHeight;
    } else {
      clearInterval(typeInterval);
    }
  }, 12);
});

function animateGenSteps() {
  const steps = document.querySelectorAll('#genSteps .gen-step-item');
  let idx = 0;
  const interval = setInterval(() => {
    if (idx > 0) {
      steps[idx - 1].classList.remove('active');
      steps[idx - 1].classList.add('done');
    }
    if (idx < steps.length) {
      steps[idx].classList.add('active');
      idx++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        document.getElementById('genOverlay').classList.remove('active');
        buildChatPanel();
      }, 600);
    }
  }, 700);
}

// ─── CHAT PANEL ───
function buildChatPanel() {
  const panel = document.getElementById('chatPanel');
  const messages = [
    { type: 'step', title: 'Generating your site', time: 'Today, 10:33 AM', done: true },
    { type: 'msg', text: `I've built a complete Community Tool Library application with all the requested features. The app includes a public catalog with search and filtering, a loan request system with custom validation rules, and a comprehensive admin dashboard for managing inventory and loans.` },
    { type: 'step', title: 'Building trust layer', time: 'Today, 10:34 AM', done: true },
    { type: 'msg', html: `I've analyzed your prompt and generated code to build the <strong style="color:#fff">Insights</strong> layer:<br><br>• <strong style="color:#fff">User Flows</strong> — interactive site map with navigation paths<br>• <strong style="color:#fff">Widget Library</strong> — ${WIDGETS.length} detected UI components with live preview<br>• <strong style="color:#fff">User Stories</strong> — ${FLOWS.length} curated flows with auto-generated E2E tests<br><br><span class="new-feature-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Insights page is ready</span>` },
  ];

  let delay = 0;
  messages.forEach((m, i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'fade-in';
      if (m.type === 'step') {
        div.className += ' chat-step';
        div.innerHTML = `
          <div class="chat-step-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
          <div class="chat-step-info">
            <div class="chat-step-title">${m.title}</div>
            <div class="chat-step-time">${m.time}</div>
          </div>
          ${m.done ? '<span class="check">✓</span>' : '<div class="spinner"></div>'}
        `;
      } else {
        div.className += ' chat-msg';
        div.innerHTML = m.html || m.text;
      }
      panel.appendChild(div);
      panel.scrollTop = panel.scrollHeight;
    }, delay);
    delay += 600;
  });

  // Add chat input
  setTimeout(() => {
    const inputDiv = document.createElement('div');
    inputDiv.className = 'chat-input-area fade-in';
    inputDiv.innerHTML = `
      <span style="font-size:16px;color:var(--text-muted)">+</span>
      <input placeholder="What's next?" />
      <button class="chat-input-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </button>
    `;
    panel.appendChild(inputDiv);
  }, delay + 200);
}

// ─── PAGE SWITCHING ───
function togglePageDropdown() {
  const dd = document.getElementById('pageDropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function selectPage(page) {
  currentPage = page;
  document.getElementById('currentPageName').textContent = page;
  document.getElementById('pageDropdown').style.display = 'none';

  const preview = document.getElementById('sitePreview');
  const siteHome = document.getElementById('siteHome');
  const siteCatalog = document.getElementById('siteCatalog');

  if (page === 'Catalog') {
    preview.style.display = 'block';
    siteHome.style.display = 'none';
    siteCatalog.classList.add('active');
    preview.scrollTop = 0;
  } else {
    // Home / Admin / any other page → show home
    preview.style.display = 'block';
    siteHome.style.display = 'block';
    siteCatalog.classList.remove('active');
    if (page === 'Home') preview.scrollTop = 0;
  }
}

/* ─── CANVAS FLOW DATA ─── */
const FLOW_NODES = [
  // Top-level entry
  { id:'uf-auth', type:'rect', label:'User log-in', icon:'👤', x:460, y:30, w:150, file:'src/pages/Login.tsx', editor:'Dev_TeamLead (2 days ago)', color:'', expandable:false },
  { id:'uf-auth-flow', type:'rect', label:'Authentication flow', icon:'🔐', x:440, y:110, w:180, file:'src/auth/AuthProvider.tsx', editor:'Dev_TeamLead (3 days ago)', color:'', expandable:false },
  // Decision diamond
  { id:'uf-decision', type:'diamond', label:'Logged in?', x:490, y:205, file:'src/auth/AuthGuard.tsx', editor:'Dev_TeamLead (3 days ago)' },
  // Auth failure
  { id:'uf-auth-fail', type:'rect', label:'Auth failure flow', icon:'⚠️', x:740, y:285, w:160, file:'src/pages/AuthError.tsx', editor:'Dev_FrontEnd (5 days ago)', color:'', expandable:false },
  // Authenticated guard bounding box
  { id:'uf-guard-group', type:'group', label:'Authenticated Guard', x:120, y:295, w:550, h:250 },
  // Pages inside guard
  { id:'uf-nav-home', type:'rect', label:'Home', icon:'🏠', x:175, y:370, w:120, file:'src/pages/Home.tsx', editor:'Dev_TeamLead (1 day ago)', color:'green', expandable:true,
    children:[
      { id:'uf-home-hero', type:'rect', label:'Hero Section', icon:'🎯', x:60, y:520, w:130, file:'HomePage.tsx:87', editor:'Dev_FrontEnd (2 days ago)', color:'', expandable:false },
      { id:'uf-home-features', type:'rect', label:'Features Grid', icon:'📊', x:210, y:520, w:140, file:'HomePage.tsx:142', editor:'Dev_FrontEnd (2 days ago)', color:'', expandable:false },
      { id:'uf-home-stats', type:'rect', label:'Community Stats', icon:'📈', x:370, y:520, w:155, file:'HomePage.tsx:198', editor:'Dev_FrontEnd (3 days ago)', color:'', expandable:false },
    ]
  },
  { id:'uf-nav-catalog', type:'rect', label:'Catalog', icon:'😊', x:355, y:370, w:120, file:'src/pages/Catalog.tsx', editor:'Dev_FrontEnd (1 day ago)', color:'yellow', expandable:true,
    children:[
      { id:'uf-cat-search', type:'square', label:'searchTools()', icon:'🔍', x:305, y:520, w:130, file:'CatalogPage.tsx:34', editor:'Dev_FrontEnd (1 day ago)' },
      { id:'uf-cat-filter', type:'square', label:'filterByCategory()', icon:'📂', x:455, y:520, w:155, file:'CatalogPage.tsx:52', editor:'Dev_FrontEnd (2 days ago)' },
      { id:'uf-cat-api', type:'square', label:'fetchTools()', icon:'⚡', x:380, y:575, w:120, file:'GET /api/tools', editor:'Dev_Backend (3 days ago)' },
    ]
  },
  { id:'uf-nav-admin', type:'rect', label:'Admin', icon:'🛡️', x:535, y:370, w:110, file:'src/pages/Admin.tsx', editor:'Dev_TeamLead (4 days ago)', color:'cyan', expandable:true,
    children:[
      { id:'uf-admin-catalog', type:'rect', label:'Admin Catalog', icon:'📋', x:680, y:350, w:150, file:'src/pages/AdminCatalog.tsx', editor:'Dev_Backend (2 days ago)', color:'', expandable:false },
      { id:'uf-admin-api', type:'square', label:'API Call: /admin-panel', icon:'🔗', x:870, y:350, w:180, file:'GET /api/admin/panel', editor:'Dev_Backend (2 days ago)' },
      { id:'uf-admin-access', type:'rect', label:'Admin Access flow', icon:'🔑', x:700, y:420, w:160, file:'src/auth/AdminGuard.tsx', editor:'Dev_TeamLead (5 days ago)', color:'', expandable:false },
    ]
  },
  // CTAs
  { id:'uf-cta', type:'square', label:'CTAs', icon:'☐', x:385, y:460, w:70, file:'HomePage.tsx:90', editor:'Dev_FrontEnd (1 day ago)' },
  // CTA targets
  { id:'uf-cta-browse', type:'rect', label:'Browse Catalog', icon:'🔍', x:220, y:460, w:145, file:'HomePage.tsx:95', editor:'Dev_FrontEnd (1 day ago)', color:'', expandable:false },
  { id:'uf-cta-admin', type:'rect', label:'Admin Access', icon:'🛡️', x:220, y:510, w:140, file:'HomePage.tsx:102', editor:'Dev_TeamLead (3 days ago)', color:'', expandable:false },
];

/* Connection definitions: [fromId, toId, type] */
const FLOW_EDGES = [
  ['uf-auth', 'uf-auth-flow', 'straight'],
  ['uf-auth-flow', 'uf-decision', 'straight'],
  ['uf-decision', 'uf-nav-home', 'yes'],
  ['uf-decision', 'uf-nav-catalog', 'yes'],
  ['uf-decision', 'uf-nav-admin', 'yes'],
  ['uf-decision', 'uf-auth-fail', 'no'],
  ['uf-nav-home', 'uf-cta', 'child'],
  ['uf-cta', 'uf-cta-browse', 'child'],
  ['uf-cta', 'uf-cta-admin', 'child'],
  ['uf-nav-admin', 'uf-admin-catalog', 'child'],
  ['uf-admin-catalog', 'uf-admin-api', 'child'],
  ['uf-nav-admin', 'uf-admin-access', 'child'],
];
