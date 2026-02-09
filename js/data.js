// ─── DATA ───
const PROMPT_TEXT = `Build a community tool library website where neighbors can browse and search a catalog of shared tools, request to borrow items with pickup scheduling, manage their active loans, and return tools. Include user registration, an admin dashboard for managing the tool inventory, approving loan requests, and tracking overdue items.`;

const FLOWS = [
  {
    id: 'browse-catalog',
    title: 'Browse & Search Tool Catalog',
    desc: 'Users can view the full tool catalog, apply category filters, and search tools by name or description. Results update in real-time with pagination.',
    tags: ['Catalog', 'Search', 'Filters'],
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
    description: 'Initial site generation from prompt. All flows baseline.',
  },
  {
    hash: 'c3d8f12', label: 'v1.1 — Removed "Sign Up" CTA', date: 'Feb 6, 2:15 PM',
    changes: [
      { nodeId: 'uf-auth', type: 'modified', desc: 'Registration entry point changed' },
      { nodeId: 'uf-cta', type: 'modified', desc: 'Homepage CTAs updated' },
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
    { type: 'step', title: 'Detecting product flows', time: 'Today, 10:34 AM', done: true },
    { type: 'msg', html: `I've detected <strong style="color:#fff">6 product flows</strong> from your prompt and the generated code architecture. Each flow has an auto-generated E2E test you can run, visualize, and inspect.<br><br><span class="new-feature-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Product Flows page is ready</span>` },
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
  const flows = document.getElementById('flowsPage');
  const codeContent = document.getElementById('codeContent');
  const flowsCode = document.getElementById('flowsPageCode');
  const codeView = document.getElementById('codeEditorView');
  const siteHome = document.getElementById('siteHome');
  const siteCatalog = document.getElementById('siteCatalog');

  // Check if we're currently in code view
  const inCodeView = codeView && codeView.classList.contains('active');

  if (page === 'Product Flows') {
    if (inCodeView) {
      codeContent.style.display = 'none';
      flowsCode.style.display = 'block';
      if (!flowsCode.innerHTML) renderFlowsPage('flowsPageCode');
    } else {
      preview.style.display = 'none';
      flows.classList.add('active');
      if (!flows.innerHTML) renderFlowsPage('flowsPage');
    }
  } else if (page === 'Catalog') {
    // Show catalog page
    preview.style.display = 'block';
    flows.classList.remove('active');
    siteHome.style.display = 'none';
    siteCatalog.classList.add('active');
    if (codeContent) codeContent.style.display = 'flex';
    if (flowsCode) flowsCode.style.display = 'none';
    // Scroll catalog to top
    preview.scrollTop = 0;
  } else {
    // Home / Admin / any other page → show home
    preview.style.display = 'block';
    flows.classList.remove('active');
    siteHome.style.display = 'block';
    siteCatalog.classList.remove('active');
    if (codeContent) codeContent.style.display = 'flex';
    if (flowsCode) flowsCode.style.display = 'none';
    if (page === 'Home') preview.scrollTop = 0;
  }
}

// ─── RENDER FLOWS PAGE ───
function renderFlowsPage(targetId) {
  const container = document.getElementById(targetId || 'flowsPage');
  const totalPassed = flowStates.filter(s => s.result === 'passed').length;
  const totalFailed = flowStates.filter(s => s.result === 'failed').length;
  const totalNotRun = flowStates.filter(s => s.status === 'idle').length;

  let html = `
    <div class="flows-header fade-in">
      <div>
        <div class="flows-title">Product Flows</div>
        <div class="flows-subtitle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Auto-detected from your prompt and code architecture
        </div>
      </div>
    </div>

    <!-- Tab Menu -->
    <div class="flows-tab-menu fade-in">
      <button class="flows-tab active" onclick="switchFlowsTab('testcases', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        Test Cases
        <span class="tab-count">${FLOWS.length}</span>
      </button>
      <button class="flows-tab" onclick="switchFlowsTab('userflows', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        User Flows
        <span class="tab-count">3</span>
      </button>
    </div>

    <!-- Test Cases Tab -->
    <div class="flows-tab-content active" id="tab-testcases">
      <div class="flows-stats fade-in" id="flowStats" style="display:flex;gap:16px;margin-bottom:24px">
        <div class="stat-card"><div class="stat-value">${FLOWS.length}</div><div class="stat-label">Total Flows</div></div>
        <div class="stat-card passed"><div class="stat-value" id="statPassed">${totalPassed}</div><div class="stat-label">Passed</div></div>
        <div class="stat-card failed"><div class="stat-value" id="statFailed">${totalFailed}</div><div class="stat-label">Failed</div></div>
        <div class="stat-card"><div class="stat-value" id="statPending">${totalNotRun}</div><div class="stat-label">Not Run</div></div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn-run-all" onclick="runAllFlows()">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Run All
        </button>
      </div>
  `;

  FLOWS.forEach((flow, idx) => {
    const st = flowStates[idx];
    html += buildFlowCardHTML(flow, idx, st);
  });

  html += `</div><!-- /tab-testcases -->`;

  // User Flows Tab
  html += buildUserFlowsTab();

  container.innerHTML = html;
}

// ─── USER FLOWS TAB ───
function buildUserFlowsTab() {
  return `
    <div class="flows-tab-content" id="tab-userflows">
      <div class="uf-intro">
        <strong>Interactive Site Map</strong> — auto-generated from your code architecture. Click any page node to drill down into its components and CTAs. Drag to pan, scroll to zoom.
      </div>

      <div class="flow-canvas-wrap" id="flowCanvasWrap">
        <div class="canvas-grid"></div>
        <svg class="flow-svg" id="flowSvg">
          <defs>
            <marker id="arrowM" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" class="arrow-head"/>
            </marker>
          </defs>
        </svg>
        <div class="flow-canvas" id="flowCanvas">
          <!-- Nodes are rendered by JS -->
        </div>
        <div class="canvas-controls">
          <button class="canvas-ctrl" onclick="canvasZoom(-.15)" title="Zoom out">−</button>
          <div class="canvas-zoom-label" id="canvasZoomLabel">100%</div>
          <button class="canvas-ctrl" onclick="canvasZoom(.15)" title="Zoom in">+</button>
          <button class="canvas-ctrl" onclick="canvasReset()" title="Reset view">⌂</button>
        </div>
      </div>
    </div><!-- /tab-userflows -->
  `;
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
