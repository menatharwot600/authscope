import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BookOpen,
  Boxes, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Download, FileJson2, FileText, Fingerprint, Gauge,
  History, KeyRound, LoaderCircle, LockKeyhole, LogOut, Menu, PanelLeftClose, Play,
  Plus, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal,
  TerminalSquare, Trash2, X, XCircle,
} from 'lucide-react';
import {
  getDownloadTestRunPdfQueryKey, getGetDashboardSummaryQueryKey, getGetDemoResourceQueryKey,
  getGetFindingQueryKey, getGetLabConfigurationQueryKey, getGetTestRunQueryKey,
  getGetTestRunReportQueryKey, getListDemoResourcesQueryKey,
  getListFindingsQueryKey, getListTestRunsQueryKey, useCreateDemoResource,
  useDeleteDemoResource, useDownloadTestRunPdf, useGetCurrentAccount,
  useGetDashboardSummary, useGetDemoResource, useGetFinding, useGetLabConfiguration,
  useGetTestRun, useGetTestRunReport, useHealthCheck, useListAuditEvents, useListDemoResources,
  useListFindings, useListTestRuns, useRunPolicyComparison, useRunSecurityTests,
  useUpdateDemoResource, useUpdateFindingStatus, useUpdateLabMode,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useRoute } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#41b8d0', colorForeground: '#e5edf3', colorMutedForeground: '#93a5b6',
    colorDanger: '#e57970', colorBackground: '#17212d', colorInput: '#101923',
    colorInputForeground: '#e5edf3', colorNeutral: '#344351', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#17212d] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#344351]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#e5edf3] font-bold', headerSubtitle: 'text-[#a7b5c2]',
    socialButtonsBlockButtonText: 'text-[#e5edf3]', formFieldLabel: 'text-[#c9d4de]',
    footerActionLink: 'text-[#54c1d4]', footerActionText: 'text-[#a7b5c2]',
    dividerText: 'text-[#93a5b6]', identityPreviewEditButton: 'text-[#54c1d4]',
    formFieldSuccessText: 'text-[#70cfb0]', alertText: 'text-[#e5edf3]',
    logoBox: 'mb-2', logoImage: 'max-h-10', socialButtonsBlockButton: 'border-[#344351] bg-[#101923]',
    formButtonPrimary: 'bg-[#41b8d0] text-[#101923] hover:bg-[#63c8dc]',
    formFieldInput: 'bg-[#101923] border-[#344351] text-[#e5edf3]', footerAction: 'border-[#344351]',
    dividerLine: 'bg-[#344351]', alert: 'border-[#344351]', otpCodeFieldInput: 'bg-[#101923] border-[#344351]',
    formFieldRow: 'text-[#c9d4de]', main: 'text-[#e5edf3]',
  },
};

const sections = [
  { label: 'Workspace', links: [
    { href: '/dashboard', label: 'Dashboard', icon: Gauge },
    { href: '/lab', label: 'Lab policy', icon: SlidersHorizontal },
    { href: '/api-explorer', label: 'API explorer', icon: TerminalSquare },
    { href: '/comparison', label: 'Policy comparison', icon: Activity },
  ] },
  { label: 'Review', links: [
    { href: '/findings', label: 'Findings', icon: ShieldAlert },
    { href: '/history', label: 'Test history', icon: History },
    { href: '/audit', label: 'Audit log', icon: ClipboardList },
  ] },
  { label: 'Reference', links: [
    { href: '/docs', label: 'Lab guide', icon: BookOpen },
    { href: '/resources', label: 'Demo resources', icon: Boxes },
  ] },
];

function Logo({ large = false }: { large?: boolean }) {
  return <span className={`brand-lockup ${large ? 'brand-large' : ''}`}><img src={`${basePath}/logo.svg`} alt="" /><span>Auth<span className="brand-scope">Scope</span></span></span>;
}

function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="focus-ring"><Logo /></Link><div><a href="#learning" className="landing-link">Lab guide</a><Link href="/sign-in" className="landing-link">Sign in</Link><Link href="/sign-up" className="button button-primary">Create account <ArrowRight size={15} /></Link></div></header>
    <section className="landing-hero surface-grid">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> CONTROLLED AUTHORIZATION LAB</div>
        <h1>See the boundary.<br /><span>Test the policy.</span></h1>
        <p className="hero-lede">A hands-on API authorization lab for learning how object access controls succeed — and where they fail.</p>
        <div className="hero-actions"><Link href="/sign-up" className="button button-primary button-lg">Enter the lab <ArrowRight size={17} /></Link><a href="#learning" className="button button-ghost button-lg">Explore the guide</a></div>
        <div className="hero-footnote"><LockKeyhole size={14} /> Requests stay inside this synthetic environment.</div>
      </div>
      <div className="hero-visual" aria-label="Illustration of a protected API resource">
        <div className="orbit orbit-a" /><div className="orbit orbit-b" />
        <div className="diagram-card card-actor"><div className="avatar-chip">A</div><div><b>Alice</b><small>authenticated actor</small></div><span className="mini-status">SESSION</span></div>
        <div className="diagram-link"><span>GET /resources/42</span><i /></div>
        <div className="diagram-card card-resource"><div className="resource-symbol"><KeyRound size={21} /></div><div><b>Resource 42</b><small>owner: Bob</small></div><span className="resource-lock"><LockKeyhole size={17} /></span></div>
        <div className="policy-seal"><ShieldCheck size={22} /><span>POLICY<br /><b>ENFORCED</b></span></div>
        <div className="visual-caption mono">CONCEPT DIAGRAM · SYNTHETIC ONLY</div>
      </div>
    </section>
    <section className="landing-proof"><div className="proof-lead"><span className="eyebrow">LEARN BY COMPARISON</span><h2>One request.<br />Two policies.</h2><p>Observe the same controlled request under two object-level authorization policies. No external targets. No guesswork.</p></div>
      <article className="policy-tile vulnerable-tile"><div className="tile-label"><AlertTriangle size={16} /> Vulnerable policy</div><div className="tile-outcome"><span>Expected demonstration</span><strong>ALLOW</strong></div><p>Conceptual behavior: Alice requests Bob’s synthetic object and the vulnerable policy permits the read.</p></article>
      <article className="policy-tile secure-tile"><div className="tile-label"><ShieldCheck size={16} /> Secure policy</div><div className="tile-outcome"><span>Expected demonstration</span><strong>BLOCK</strong></div><p>Conceptual behavior: the same request is denied when the policy enforces ownership.</p></article>
    </section>
    <section className="landing-steps" id="learning"><div className="eyebrow">A SAFE, REPEATABLE EXERCISE</div><h2>Learn the control, not the exploit.</h2><div className="step-row">
      {[['01', 'Select a policy', 'Choose the active lab mode. A confirmation keeps policy changes deliberate.'], ['02', 'Run the request', 'Use fixed demo endpoints and synthetic Alice/Bob-owned resources.'], ['03', 'Compare evidence', 'Review actual responses, expected outcomes, findings, and remediation.']].map(([n, title, text]) => <article className="step-item" key={n}><span className="step-number mono">{n}</span><h3>{title}</h3><p>{text}</p></article>)}
    </div></section>
    <section className="landing-callout"><div><span className="eyebrow">BUILT FOR UNIVERSITY LABS</span><h2>Authorization you can inspect.</h2><p>Keep experiments isolated, repeatable, and grounded in server-reported evidence.</p></div><Link href="/sign-up" className="button button-primary">Start learning <ArrowRight size={16} /></Link></section>
    <footer className="landing-footer"><Logo /><span>Educational environment · Synthetic data only</span><a href="#learning">Read limitations <ArrowRight size={14} /></a></footer>
  </main>;
}

function ClerkCacheClear() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const nextId = user?.id ?? null;
    if (lastUserId.current !== undefined && lastUserId.current !== nextId) client.clear();
    lastUserId.current = nextId;
  }), [addListener, client]);
  return null;
}

function AuthPage({ signup = false }: { signup?: boolean }) {
  return <div className="auth-screen"><div className="auth-return"><Link href="/" className="focus-ring"><Logo /></Link><span>Controlled learning environment</span></div>
    <div className="auth-backdrop surface-grid"><div className="auth-aside"><span className="eyebrow">AUTHORIZATION, MADE VISIBLE</span><h1>Practice with purpose.</h1><p>Explore object-level authorization using a contained, synthetic API lab.</p><div className="auth-assurance"><ShieldCheck size={17} /> No arbitrary target URLs. Ever.</div></div>
      <div className="auth-widget">{signup ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /> : <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}</div>
    </div></div>;
}

function SignedInGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="loading-screen"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-panel" /></div>;
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in" />;
}

function Shell({ children, title, description, actions }: { children: ReactNode; title: string; description?: string; actions?: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const account = useGetCurrentAccount();
  const health = useHealthCheck();
  const active = sections.flatMap(s => s.links).find(link => location === link.href || (link.href === '/findings' && location.startsWith('/findings/')) || (link.href === '/history' && location.startsWith('/history/')));
  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand"><Link href="/dashboard" aria-label="AuthScope dashboard"><Logo /></Link><button className="icon-button collapse-button" aria-label="Collapse navigation" onClick={() => setCollapsed(v => !v)} data-testid="button-collapse-nav"><PanelLeftClose size={17} /></button></div>
      <div className="workspace-chip"><span className="workspace-icon"><Shield size={15} /></span><span><b>Authorization Lab</b><small>University workspace</small></span><ChevronDown size={13} /></div>
      <nav className="side-nav" aria-label="Main navigation">{sections.map(section => <div className="nav-section" key={section.label}><div className="nav-heading">{section.label}</div>{section.links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link focus-ring ${active?.href === href ? 'nav-active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{label}</span>{label === 'Findings' && <span className="nav-dot" />}</Link>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="safe-note"><LockKeyhole size={15} /><span><b>Isolated by design</b><small>Only local synthetic resources</small></span></div><div className="account-row"><div className="account-avatar">{(user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase()}</div><div className="account-info"><b>{user?.fullName || user?.username || 'Lab account'}</b><small title={account.data?.userId}>{account.data ? `${account.data.userId} · ${account.data.authProvider}` : 'Loading account…'}</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={16} /></button></div></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <main className="main-column"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>AuthScope</span><span>/</span><b>{active?.label || title}</b></div><div className="topbar-right"><span className={`env-indicator ${health.isError ? 'health-error' : ''}`}><i /> {health.isLoading ? 'CONNECTING' : health.isError ? 'API UNAVAILABLE' : 'API CONNECTED'}</span><div className="topbar-avatar">{(user?.firstName?.[0] || 'U').toUpperCase()}</div></div></header>
      <div className="content-area page-enter"><div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>{children}</div>
    </main>
  </div>;
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
function PanelTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) { return <div className="panel-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>; }
function Button({ children, onClick, variant = 'primary', disabled, type = 'button', testId, className = '' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'quiet' | 'danger' | 'outline'; disabled?: boolean; type?: 'button' | 'submit'; testId?: string; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`button button-${variant} ${className}`}>{children}</button>;
}
function ErrorState({ message = 'We could not load this data.' , retry }: { message?: string; retry?: () => void }) { return <div className="state-box state-error"><AlertTriangle size={19} /><div><b>Something went wrong</b><p>{message}</p>{retry && <button className="text-action" onClick={retry}>Try again</button>}</div></div>; }
function LoadingState({ rows = 3 }: { rows?: number }) { return <div className="loading-stack" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div className="skeleton skeleton-row" key={i} />)}</div>; }
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Shield size={21} /></span><b>{title}</b><p>{detail}</p>{action}</div>; }
function Stat({ label, value, caption, icon: Icon, tone = '' }: { label: string; value: ReactNode; caption?: string; icon: typeof Gauge; tone?: string }) { return <div className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={17} /></span></div><div className="stat-value">{value}</div>{caption && <div className="stat-caption">{caption}</div>}</div>; }
function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`status-pill status-${tone}`}>{children}</span>; }
function dateLabel(value?: string) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(d); }
function ErrorMessage({ error }: { error: unknown }) { const msg = error instanceof Error ? error.message : 'Request failed. Try again.'; return <ErrorState message={msg} />; }

function Dashboard() {
  const summary = useGetDashboardSummary();
  const lab = useGetLabConfiguration();
  const run = useRunSecurityTests();
  const client = useQueryClient();
  const start = () => run.mutate(undefined, { onSuccess: () => { client.invalidateQueries({ queryKey: getListTestRunsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); client.invalidateQueries({ queryKey: getListFindingsQueryKey() }); } });
  const data = summary.data;
  return <Shell title="Dashboard" description="A clear view of your authorization lab." actions={<Button onClick={start} disabled={run.isPending} testId="button-run-security-tests">{run.isPending ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />} Run security checks</Button>}>
    {summary.isLoading ? <LoadingState rows={4} /> : summary.isError ? <ErrorState retry={() => summary.refetch()} /> : <>
      <div className="dashboard-banner"><div className="banner-symbol"><ShieldCheck size={23} /></div><div><span className="eyebrow">ACTIVE POLICY</span><h2>{data?.mode === 'vulnerable' ? 'Vulnerable mode' : 'Secure mode'}</h2><p>{data?.mode === 'vulnerable' ? 'Cross-owner access is intentionally allowed for this controlled lesson.' : 'Object ownership is enforced for every protected resource.'}</p></div><Link href="/lab" className="button button-outline">Review policy <ArrowRight size={15} /></Link></div>
      <div className="stats-grid"><Stat label="Tests executed" value={data?.testsExecuted ?? '—'} caption="Persisted lab executions" icon={Activity} /><Stat label="Passed checks" value={data?.testsPassed ?? '—'} caption="Expected behavior observed" icon={CheckCircle2} tone="stat-good" /><Stat label="Failed checks" value={data?.testsFailed ?? '—'} caption="Unexpected behavior" icon={XCircle} tone="stat-warn" /><Stat label="Open vulnerabilities" value={data?.vulnerabilitiesDetected ?? '—'} caption={`${data?.vulnerabilitiesFixed ?? 0} fixed`} icon={ShieldAlert} tone="stat-danger" /></div>
      <div className="dashboard-grid"><Panel><PanelTitle title="Run activity" detail="Recent server-recorded checks" action={<Link href="/history" className="text-action">All runs <ArrowRight size={14} /></Link>} />
        {data?.trend?.length ? <div className="trend-chart" role="img" aria-label="Recent passed and failed test run trend">{data.trend.map((d, i) => <div className="trend-column" key={`${d.date}-${i}`}><div className="bar-pair"><span className="bar bar-passed" style={{ height: `${Math.max(5, Math.min(100, d.passed * 9))}%` }} /><span className="bar bar-failed" style={{ height: `${Math.max(4, Math.min(100, d.failed * 10))}%` }} /></div><small>{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</small></div>)}</div> : <EmptyState title="No activity yet" detail="Run your first security check to begin building lab history." action={<Button onClick={start} disabled={run.isPending}><Play size={14} /> Run checks</Button>} />}
        {data?.trend?.length ? <div className="chart-legend"><span><i className="legend-pass" /> Passed</span><span><i className="legend-fail" /> Failed</span></div> : null}
      </Panel><Panel><PanelTitle title="Findings by severity" detail="Current persisted finding inventory" />
        {data?.findingsBySeverity?.length ? <div className="severity-list">{data.findingsBySeverity.map(x => <div className="severity-row" key={x.severity}><span className={`severity-dot severity-${x.severity}`} /> <span className="severity-name">{x.severity}</span><b>{x.count}</b><div className="severity-track"><i style={{ width: `${Math.min(100, x.count * 12)}%` }} /></div></div>)}</div> : <EmptyState title="No findings recorded" detail="Findings appear here after backend test runs identify a policy issue." />}
      </Panel></div>
      <Panel className="table-panel"><PanelTitle title="Recent test runs" detail="Newest test executions from your account" action={<Link href="/history" className="text-action">View history <ArrowRight size={14} /></Link>} />
        {data?.recentRuns?.length ? <div className="table-wrap"><table><thead><tr><th>Run</th><th>Policy</th><th>Checks</th><th>Findings</th><th>Duration</th><th>Created</th><th /></tr></thead><tbody>{data.recentRuns.map(r => <tr key={r.id}><td className="mono">RUN-{r.id}</td><td><StatusPill tone={r.mode === 'secure' ? 'good' : r.mode === 'vulnerable' ? 'danger' : 'neutral'}>{r.mode}</StatusPill></td><td><span className="good-text">{r.passed} passed</span><span className="table-sub">{r.failed} failed</span></td><td>{r.findings}</td><td>{r.durationMs} ms</td><td>{dateLabel(r.createdAt)}</td><td><Link className="icon-button" href={`/history/${r.id}`} aria-label={`Open run ${r.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="No test runs" detail="When you run the lab checks, persisted results will appear here." action={<Button onClick={start} disabled={run.isPending}><Play size={14} /> Run checks</Button>} />}
      </Panel>
    </>}
  </Shell>;
}

function LabPolicy() {
  const lab = useGetLabConfiguration();
  const mutation = useUpdateLabMode();
  const client = useQueryClient();
  const choose = (mode: 'vulnerable' | 'secure') => {
    if (lab.data?.mode === mode) return;
    const copy = mode === 'vulnerable'
      ? 'Switch to Vulnerable mode? The controlled cross-owner read may be allowed by the demo policy.'
      : 'Switch to Secure mode? The same cross-owner request should be blocked.';
    if (window.confirm(copy)) mutation.mutate({ data: { mode } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetLabConfigurationQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); } });
  };
  return <Shell title="Lab policy" description="Choose how the synthetic API evaluates object ownership.">
    <div className="policy-alert"><LockKeyhole size={18} /><div><b>Contained exercise</b><span>Policy changes affect only the app’s own synthetic Alice and Bob resources.</span></div></div>
    {lab.isLoading ? <LoadingState rows={2} /> : lab.isError ? <ErrorState retry={() => lab.refetch()} /> : <>
      <div className="mode-grid"><button className={`mode-card ${lab.data?.mode === 'vulnerable' ? 'mode-selected mode-vuln' : ''}`} onClick={() => choose('vulnerable')} data-testid="button-mode-vulnerable"><div className="mode-icon warning"><AlertTriangle size={20} /></div><div className="mode-title"><h2>Vulnerable mode</h2>{lab.data?.mode === 'vulnerable' && <StatusPill tone="danger">ACTIVE</StatusPill>}</div><p>Demonstrates a controlled Broken Object Level Authorization (BOLA) condition. A cross-owner read can succeed.</p><div className="mode-foot"><span>Expected lesson</span><b>Unauthorized access may be allowed</b></div></button>
        <button className={`mode-card ${lab.data?.mode === 'secure' ? 'mode-selected mode-secure' : ''}`} onClick={() => choose('secure')} data-testid="button-mode-secure"><div className="mode-icon safe"><ShieldCheck size={20} /></div><div className="mode-title"><h2>Secure mode</h2>{lab.data?.mode === 'secure' && <StatusPill tone="good">ACTIVE</StatusPill>}</div><p>Enforces object ownership. The same cross-owner read should be rejected by the API.</p><div className="mode-foot"><span>Expected lesson</span><b>Unauthorized access is denied</b></div></button></div>
      {mutation.isPending && <div className="inline-notice"><LoaderCircle size={15} className="spin" /> Updating policy…</div>}
      {mutation.isError && <ErrorMessage error={mutation.error} />}
      <Panel className="policy-meta"><div className="meta-pair"><span>Current mode</span><StatusPill tone={lab.data?.mode === 'secure' ? 'good' : 'danger'}>{lab.data?.mode}</StatusPill></div><div className="meta-pair"><span>Last updated</span><b>{dateLabel(lab.data?.updatedAt)}</b></div><div className="meta-pair"><span>Policy scope</span><b>Demo API only</b></div></Panel>
    </>}
  </Shell>;
}

function ApiExplorer() {
  const resources = useListDemoResources();
  const [resourceId, setResourceId] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const resource = useGetDemoResource(resourceId, { query: { enabled: submitted && resourceId > 0, queryKey: getGetDemoResourceQueryKey(resourceId) } });
  const submit = (e: FormEvent) => { e.preventDefault(); setSubmitted(true); resource.refetch(); };
  return <Shell title="API explorer" description="Make real requests against the fixed, synthetic demo API.">
    <div className="explorer-warning"><Shield size={17} /><span><b>Scoped to this lab.</b> Hosts, arbitrary URLs, and external targets are not accepted.</span></div>
    <div className="explorer-grid"><Panel className="request-panel"><PanelTitle title="Read a demo resource" detail="GET /api/demo/resources/{resourceId}" />
      {resources.isLoading ? <LoadingState rows={2} /> : <form onSubmit={submit} className="request-form"><label htmlFor="resource-id">Synthetic resource ID</label><div className="request-control"><input id="resource-id" type="number" min="1" step="1" list="synthetic-resource-ids" value={resourceId || ''} onChange={e => { setResourceId(Number(e.target.value)); setSubmitted(false); }} placeholder="Enter an ID from this lab" required data-testid="input-resource-id" /><datalist id="synthetic-resource-ids">{resources.data?.map(item => <option key={item.id} value={item.id}>{item.name} · {item.ownerName} ({item.ownerId})</option>)}</datalist><Button type="submit" disabled={!resourceId || resource.isFetching}><Play size={14} /> Send request</Button></div><small>Fixed endpoint only: GET /api/demo/resources/{'{resourceId}'}. Requests use the active policy.</small>{resources.isError && <small className="api-list-warning">Resource list unavailable. You can still enter a known synthetic resource ID to call the fixed endpoint.</small>}{resources.data?.length ? <div className="resource-shortcuts"><span>Listed resources</span>{resources.data.map(item => <button type="button" key={item.id} onClick={() => { setResourceId(item.id); setSubmitted(false); }}><b>#{item.id}</b> {item.name} <i>{item.ownerId}</i></button>)}</div> : <Link className="text-action" href="/resources">Create synthetic resources <ArrowRight size={14} /></Link>}</form>}
    </Panel><Panel className="response-panel"><PanelTitle title="Response" detail="Actual backend response" action={submitted && <button className="icon-button" aria-label="Retry request" onClick={() => resource.refetch()}><RefreshCw size={15} /></button>} />
      {!submitted && <div className="response-empty"><TerminalSquare size={23} /><b>Awaiting request</b><span>Select one of the listed demo resources and send a request.</span></div>}
      {submitted && resource.isFetching && <LoadingState rows={2} />}
      {submitted && resource.isError && <div className="response-error"><div className="response-code"><XCircle size={16} /> REQUEST DENIED / ERROR</div><ErrorMessage error={resource.error} /><p>This status reflects the API response. No result has been synthesized.</p></div>}
      {submitted && resource.isSuccess && <div className="response-success"><div className="response-code"><CheckCircle2 size={16} /> 200 · OK</div><pre>{JSON.stringify(resource.data, null, 2)}</pre><div className="response-note"><Check size={15} /> Response received from the demo API.</div></div>}
    </Panel></div>
    <div className="callout-note"><Fingerprint size={18} /><div><b>Authorization is evaluated server-side.</b><span>The selected resource is sent to the application’s own API endpoint with your signed-in session.</span></div></div>
  </Shell>;
}

function Comparison() {
  const comparison = useRunPolicyComparison();
  const client = useQueryClient();
  const start = () => comparison.mutate(undefined, { onSuccess: () => {
    client.invalidateQueries({ queryKey: getListTestRunsQueryKey() });
    client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    client.invalidateQueries({ queryKey: getListFindingsQueryKey() });
  } });
  const run = comparison.data;
  return <Shell title="Policy comparison" description="Evaluate the same test cases against both backend policies." actions={<Button onClick={start} disabled={comparison.isPending} testId="button-run-comparison">{comparison.isPending ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />} Run comparison</Button>}>
    <div className="comparison-intro"><div className="comparison-icon"><Activity size={19} /></div><div><b>Same case. Two real policy outcomes.</b><span>The comparison endpoint executes against the app’s controlled demo policy variants.</span></div></div>
    {comparison.isPending ? <Panel><LoadingState rows={4} /></Panel> : comparison.isError ? <ErrorMessage error={comparison.error} /> : !run ? <EmptyState title="No comparison run yet" detail="Run a comparison to request actual vulnerable and secure policy results from the backend." action={<Button onClick={start}><Play size={14} /> Run comparison</Button>} /> : <>
      <div className="comparison-summary"><div><span className="eyebrow">COMPARISON RUN</span><b className="mono">CMP-{run.id}</b><small>{dateLabel(run.createdAt)}</small></div><p>{run.summary}</p></div>
      <div className="comparison-table">{run.cases.map((c, i) => <Panel className="compare-case" key={`${c.caseKey}-${i}`}><div className="case-head"><span className="case-index mono">CASE {String(i + 1).padStart(2, '0')} · {c.caseKey}</span><b>{c.name}</b><p>{c.description}</p><p className="expected-behavior"><b>Expected behavior:</b> {c.expectedBehavior}</p></div><div className="case-columns"><div className="case-side side-vulnerable"><span className="eyebrow">VULNERABLE POLICY</span><Outcome outcome={c.vulnerable.outcome} status={c.vulnerable.status} passed={c.vulnerable.passed} /><p>{c.vulnerable.evidence}</p></div><div className="case-side side-secure"><span className="eyebrow">SECURE POLICY</span><Outcome outcome={c.secure.outcome} status={c.secure.status} passed={c.secure.passed} /><p>{c.secure.evidence}</p></div></div><div className="case-improvement"><ShieldCheck size={15} /><span>{c.improvement}</span></div></Panel>)}</div>
    </>}
  </Shell>;
}
function Outcome({ outcome, status, passed }: { outcome: string; status: number; passed: boolean }) { return <div className="outcome-row"><StatusPill tone={outcome === 'allowed' ? 'danger' : outcome === 'blocked' || outcome === 'denied' ? 'good' : 'neutral'}>{outcome}</StatusPill><span className="mono">HTTP {status}</span><span className={`outcome-check ${passed ? 'good-text' : 'bad-text'}`}>{passed ? 'Expected' : 'Unexpected'}</span></div>; }

function Findings() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'open' | 'fixed' | 'accepted'>('');
  const [severity, setSeverity] = useState<'' | 'critical' | 'high' | 'medium' | 'low' | 'informational'>('');
  const [page, setPage] = useState(1);
  const params = { search: search || undefined, status: status || undefined, severity: severity || undefined, page, pageSize: 10 };
  const findings = useListFindings(params);
  return <Shell title="Findings" description="Review, prioritize, and update policy issues discovered by real lab runs.">
    <div className="filter-bar"><label className="search-field"><Search size={16} /><input placeholder="Search findings" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="Search findings" data-testid="input-findings-search" /></label><select value={status} onChange={e => { setStatus(e.target.value as '' | 'open' | 'fixed' | 'accepted'); setPage(1); }} aria-label="Filter by status"><option value="">All statuses</option><option value="open">Open</option><option value="fixed">Fixed</option><option value="accepted">Accepted</option></select><select value={severity} onChange={e => { setSeverity(e.target.value as '' | 'critical' | 'high' | 'medium' | 'low' | 'informational'); setPage(1); }} aria-label="Filter by severity"><option value="">All severities</option>{['critical', 'high', 'medium', 'low', 'informational'].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
    {findings.isLoading ? <LoadingState rows={5} /> : findings.isError ? <ErrorState retry={() => findings.refetch()} /> : !findings.data?.items?.length ? <EmptyState title="No findings match these filters" detail="Try a different search, status, or severity. Findings are never generated by the interface." /> : <><Panel className="table-panel"><div className="table-wrap"><table><thead><tr><th>Finding</th><th>Severity</th><th>Category</th><th>Resource</th><th>Status</th><th>Discovered</th><th /></tr></thead><tbody>{findings.data.items.map(f => <tr key={f.id}><td><Link className="table-primary-link" href={`/findings/${f.id}`}>{f.title}</Link><span className="table-sub mono">{f.endpoint}</span></td><td><StatusPill tone={f.severity === 'critical' || f.severity === 'high' ? 'danger' : 'warn'}>{f.severity}</StatusPill></td><td>{f.category}</td><td className="mono">#{f.resourceId}</td><td><StatusPill tone={f.status === 'fixed' ? 'good' : f.status === 'open' ? 'danger' : 'neutral'}>{f.status}</StatusPill></td><td>{dateLabel(f.discoveredAt)}</td><td><Link className="icon-button" href={`/findings/${f.id}`} aria-label={`View finding ${f.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div></Panel><Pagination page={findings.data.page} pageSize={findings.data.pageSize} total={findings.data.total} onPage={setPage} /></>}
  </Shell>;
}

function FindingDetail() {
  const [, params] = useRoute('/findings/:id');
  const id = Number(params?.id);
  const query = useGetFinding(id, { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetFindingQueryKey(id) } });
  const update = useUpdateFindingStatus();
  const client = useQueryClient();
  const finding = query.data;
  return <Shell title="Finding detail" description="Evidence and remediation reported by the lab API." actions={<Link href="/findings" className="button button-quiet"><ArrowLeft size={15} /> All findings</Link>}>
    {query.isLoading ? <LoadingState rows={4} /> : query.isError ? <ErrorState message="The requested finding is unavailable or could not be loaded." retry={() => query.refetch()} /> : finding && <div className="detail-layout"><Panel className="detail-main"><div className="finding-title"><StatusPill tone={finding.severity === 'critical' || finding.severity === 'high' ? 'danger' : 'warn'}>{finding.severity}</StatusPill><h2>{finding.title}</h2><p>{finding.category} · Resource #{finding.resourceId} · Run #{finding.runId}</p></div><InfoBlock title="Evidence" text={finding.evidence} /><InfoBlock title="Business impact" text={finding.businessImpact} /><InfoBlock title="Root cause" text={finding.rootCause} /><InfoBlock title="Recommended remediation" text={finding.remediation} /></Panel><Panel className="detail-side"><PanelTitle title="Finding status" /><StatusPill tone={finding.status === 'fixed' ? 'good' : finding.status === 'open' ? 'danger' : 'neutral'}>{finding.status}</StatusPill><div className="detail-facts"><span>Endpoint</span><b className="mono">{finding.endpoint}</b><span>Resource ID</span><b className="mono">{finding.resourceId}</b><span>Discovered</span><b>{dateLabel(finding.discoveredAt)}</b><span>Updated</span><b>{dateLabel(finding.updatedAt)}</b></div><label className="form-label" htmlFor="finding-status">Update status</label><select id="finding-status" value={finding.status} disabled={update.isPending} onChange={e => update.mutate({ findingId: id, data: { status: e.target.value as 'open' | 'fixed' | 'accepted' } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetFindingQueryKey(id) }); client.invalidateQueries({ queryKey: getListFindingsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); } })}><option value="open">Open</option><option value="fixed">Fixed</option><option value="accepted">Accepted</option></select>{update.isPending && <small>Saving status…</small>}{update.isError && <ErrorMessage error={update.error} />}</Panel></div>}
  </Shell>;
}
function InfoBlock({ title, text }: { title: string; text: string }) { return <div className="info-block"><h3>{title}</h3><p>{text}</p></div>; }

function HistoryPage() {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'' | 'vulnerable' | 'secure' | 'comparison'>('');
  const [result, setResult] = useState<'' | 'passed' | 'failed'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const params = { search: search || undefined, mode: mode || undefined, result: result || undefined, from: from || undefined, to: to || undefined, page, pageSize: 10 };
  const runs = useListTestRuns(params);
  const [, runParams] = useRoute('/history/:id');
  const runId = Number(runParams?.id || 0);
  const detail = useGetTestRun(runId, { query: { enabled: runId > 0, queryKey: getGetTestRunQueryKey(runId) } });
  const report = useGetTestRunReport(runId, { query: { enabled: runId > 0, queryKey: getGetTestRunReportQueryKey(runId) } });
  const [downloadId, setDownloadId] = useState(0);
  const pdf = useDownloadTestRunPdf(downloadId, { query: { enabled: downloadId > 0, queryKey: getDownloadTestRunPdfQueryKey(downloadId) } });
  useEffect(() => {
    if (pdf.data instanceof Blob && downloadId) {
      const url = URL.createObjectURL(pdf.data);
      const a = document.createElement('a'); a.href = url; a.download = `authscope-run-${downloadId}.pdf`; a.click(); URL.revokeObjectURL(url); setDownloadId(0);
    }
  }, [pdf.data, downloadId]);
  const downloadJson = () => { if (!report.data) return; const url = URL.createObjectURL(new Blob([JSON.stringify(report.data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `authscope-run-${runId}.json`; a.click(); URL.revokeObjectURL(url); };
  if (runId > 0) return <Shell title={`Test run · ${runId}`} description="Persisted run details and report downloads." actions={<Link href="/history" className="button button-quiet"><ArrowLeft size={15} /> Back to history</Link>}>
    {detail.isLoading ? <LoadingState rows={5} /> : detail.isError ? <ErrorState message="This test run could not be loaded." retry={() => detail.refetch()} /> : detail.data && <>
      <div className="run-detail-banner"><div><span className="eyebrow">RUN ID</span><b className="mono">RUN-{detail.data.id}</b><small>{dateLabel(detail.data.createdAt)}</small></div><StatusPill tone={detail.data.mode === 'secure' ? 'good' : detail.data.mode === 'vulnerable' ? 'danger' : 'neutral'}>{detail.data.mode}</StatusPill><div className="run-result-count"><b>{detail.data.passed}/{detail.data.total}</b><small>checks passed · {detail.data.failed} failed</small></div><div className="run-result-count"><b>{detail.data.findings}</b><small>findings · {detail.data.durationMs} ms</small></div><div className="run-detail-actions"><Button variant="outline" onClick={downloadJson} disabled={report.isLoading || !report.data}><FileJson2 size={15} /> JSON report</Button><Button variant="outline" onClick={() => setDownloadId(runId)} disabled={pdf.isFetching}><Download size={15} /> {pdf.isFetching ? 'Preparing PDF…' : 'PDF report'}</Button></div></div>
      {report.isError && <ErrorMessage error={report.error} />}{pdf.isError && <ErrorMessage error={pdf.error} />}
      <Panel className="table-panel"><PanelTitle title="Test results" detail="Actual expected and observed outcomes" /><div className="table-wrap"><table><thead><tr><th>Case</th><th>Expected</th><th>Actual</th><th>Result</th><th>Severity</th><th>Evidence and remediation</th><th>Created</th></tr></thead><tbody>{detail.data.results.map(r => <tr key={r.id}><td><b>{r.name}</b><span className="table-sub">{r.description}</span><span className="table-sub mono">{r.caseKey} · {r.variant}</span></td><td><span className="mono">{r.expectedOutcome}</span><span className="table-sub">HTTP {r.expectedStatus}</span></td><td><span className="mono">{r.actualOutcome}</span><span className="table-sub">HTTP {r.actualStatus}</span></td><td><StatusPill tone={r.passed ? 'good' : 'danger'}>{r.passed ? 'passed' : 'failed'}</StatusPill></td><td>{r.severity ? <StatusPill tone="warn">{r.severity}</StatusPill> : '—'}</td><td>{r.evidence}<span className="table-sub">Remediation: {r.remediation}</span></td><td>{dateLabel(r.createdAt)}</td></tr>)}</tbody></table></div></Panel>
    </>}
  </Shell>;
  return <Shell title="Test history" description="Search persisted runs, inspect results, and download server-generated reports.">
    <div className="filter-bar history-filters"><label className="search-field"><Search size={16} /><input placeholder="Search runs" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="Search test runs" /></label><select value={mode} onChange={e => setMode(e.target.value as '' | 'vulnerable' | 'secure' | 'comparison')} aria-label="Filter mode"><option value="">All policies</option><option value="vulnerable">Vulnerable</option><option value="secure">Secure</option><option value="comparison">Comparison</option></select><select value={result} onChange={e => setResult(e.target.value as '' | 'passed' | 'failed')} aria-label="Filter result"><option value="">All results</option><option value="passed">Passed</option><option value="failed">Failed</option></select><input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} /><input aria-label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
    {runs.isLoading ? <LoadingState rows={4} /> : runs.isError ? <ErrorState retry={() => runs.refetch()} /> : !runs.data?.items?.length ? <EmptyState title="No runs found" detail="Run the lab checks or adjust your filters to view persisted history." /> : <><Panel className="table-panel"><div className="table-wrap"><table><thead><tr><th>Run</th><th>Mode</th><th>Results</th><th>Findings</th><th>Duration</th><th>Created</th><th /></tr></thead><tbody>{runs.data.items.map(r => <tr key={r.id}><td><Link className="table-primary-link mono" href={`/history/${r.id}`}>RUN-{r.id}</Link></td><td><StatusPill tone={r.mode === 'secure' ? 'good' : r.mode === 'vulnerable' ? 'danger' : 'neutral'}>{r.mode}</StatusPill></td><td><span className="good-text">{r.passed} passed</span><span className="table-sub">{r.failed} failed of {r.total}</span></td><td>{r.findings}</td><td>{r.durationMs} ms</td><td>{dateLabel(r.createdAt)}</td><td><Link href={`/history/${r.id}`} className="icon-button" aria-label={`Open run ${r.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div></Panel><Pagination page={runs.data.page} pageSize={runs.data.pageSize} total={runs.data.total} onPage={setPage} /></>}
  </Shell>;
}

function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination"><span>Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span><div><button className="icon-button" disabled={page <= 1} aria-label="Previous page" onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button><span className="page-count">Page {page} of {pages}</span><button className="icon-button" disabled={page >= pages} aria-label="Next page" onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button></div></div>;
}

function Audit() {
  const [page, setPage] = useState(1);
  const params = { page, pageSize: 15 };
  const audit = useListAuditEvents(params);
  return <Shell title="Audit log" description="Actor-scoped events recorded by this application.">
    <div className="audit-scope"><Fingerprint size={17} /><span>Events are limited to the authenticated actor and returned by the audit API.</span></div>
    {audit.isLoading ? <LoadingState rows={5} /> : audit.isError ? <ErrorState retry={() => audit.refetch()} /> : !audit.data?.items?.length ? <EmptyState title="No audit events yet" detail="Events are shown when the API records actions for your account." /> : <><Panel className="table-panel"><PanelTitle title="Recorded events" detail={`${audit.data.total} events in your account scope`} /><div className="table-wrap"><table><thead><tr><th>Event</th><th>Actor</th><th>Action</th><th>Detail</th><th>Timestamp</th></tr></thead><tbody>{audit.data.items.map(e => <tr key={e.id}><td className="mono">EVT-{e.id}</td><td className="mono actor-id">{e.actorId}</td><td><StatusPill tone="neutral">{e.action}</StatusPill></td><td>{e.detail}</td><td>{dateLabel(e.createdAt)}</td></tr>)}</tbody></table></div></Panel><Pagination page={audit.data.page} pageSize={audit.data.pageSize} total={audit.data.total} onPage={setPage} /></>}
  </Shell>;
}

function Docs() {
  return <Shell title="Lab guide" description="A practical guide to this controlled authorization exercise.">
    <div className="docs-grid"><Panel className="docs-main"><div className="docs-kicker"><BookOpen size={17} /> FIELD GUIDE · AUTHORIZATION BASICS</div><h2>Understand the object boundary.</h2><p className="docs-intro">Object-level authorization checks whether the signed-in actor is permitted to perform an action on a specific object — not merely whether they are authenticated.</p>
      <InfoBlock title="The controlled scenario" text="The lab uses synthetic resources associated with Alice and Bob. A request for a resource owned by another demo actor is evaluated under the active lab policy." />
      <InfoBlock title="BOLA in Vulnerable mode" text="Broken Object Level Authorization (BOLA) occurs when an API accepts an object identifier but fails to enforce access to that object. The vulnerable policy intentionally demonstrates this issue only inside this app's demo API." />
      <InfoBlock title="Verification in Secure mode" text="Switch to Secure mode and repeat the same controlled request. The server should enforce ownership and deny access to a resource outside the selected actor's authorization scope." />
      <InfoBlock title="How results are produced" text="Every status, finding, comparison, and report shown in AuthScope comes from a real API response. The interface does not manufacture test outcomes." />
      <div className="docs-limit"><LockKeyhole size={18} /><div><b>Strict scope and limitations</b><p>AuthScope is an educational lab, not a general-purpose scanner. It cannot accept arbitrary target URLs, scan external services, or test systems outside this synthetic environment. Do not use it to assess real accounts or third-party systems.</p></div></div>
      <div className="docs-links"><Link href="/lab" className="button button-outline">Choose a policy <ArrowRight size={15} /></Link><Link href="/api-explorer" className="button button-primary">Open API explorer <ArrowRight size={15} /></Link><a href="/api/docs" className="button button-quiet" target="_blank" rel="noreferrer">Swagger API reference <ArrowRight size={15} /></a></div>
    </Panel><div className="docs-aside"><Panel><span className="eyebrow">CORE PRINCIPLE</span><div className="principle-mark"><ShieldCheck size={24} /></div><h3>Authentication is not authorization.</h3><p>A valid session identifies the caller. Object-level policy decides what that caller may access.</p></Panel><Panel><span className="eyebrow">LAB SEQUENCE</span><ol className="sequence-list"><li><b>Set a mode</b><span>Vulnerable or Secure</span></li><li><b>Run a request</b><span>Use a listed demo resource</span></li><li><b>Review evidence</b><span>Inspect actual API outcomes</span></li><li><b>Compare policies</b><span>Repeat under both variants</span></li></ol></Panel></div></div>
  </Shell>;
}

function Resources() {
  const resources = useListDemoResources();
  const create = useCreateDemoResource();
  const update = useUpdateDemoResource();
  const remove = useDeleteDemoResource();
  const client = useQueryClient();
  const [editing, setEditing] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const reset = () => { setEditing(null); setName(''); setDescription(''); setFormOpen(false); };
  const beginEdit = (item: NonNullable<typeof resources.data>[number]) => { setEditing(item.id); setName(item.name); setDescription(item.description); setFormOpen(true); };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editing !== null) update.mutate({ resourceId: editing, data: { name, description } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListDemoResourcesQueryKey() }); reset(); } });
    else create.mutate({ data: { name, description } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListDemoResourcesQueryKey() }); reset(); } });
  };
  const del = (id: number) => { if (window.confirm(`Delete synthetic resource #${id}? This cannot be undone.`)) remove.mutate({ resourceId: id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListDemoResourcesQueryKey() }) }); };
  const pending = create.isPending || update.isPending;
  return <Shell title="Demo resources" description="Manage the synthetic resources used by this lab." actions={<Button onClick={() => { setEditing(null); setName(''); setDescription(''); setFormOpen(v => !v); }}><Plus size={15} /> New resource</Button>}>
    <div className="policy-alert"><Boxes size={18} /><div><b>Synthetic resources only</b><span>Resources are created in this app and remain within the controlled demo API.</span></div></div>
    {formOpen && <Panel className="resource-form-panel"><PanelTitle title={editing !== null ? `Edit resource #${editing}` : 'Create a synthetic resource'} detail="Name and description are sent to the demo API." action={<button className="icon-button" aria-label="Close form" onClick={reset}><X size={17} /></button>} /><form className="resource-form" onSubmit={onSubmit}><label htmlFor="resource-name">Resource name</label><input id="resource-name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alice's research notes" data-testid="input-resource-name" /><label htmlFor="resource-description">Description</label><textarea id="resource-description" required minLength={1} maxLength={500} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this synthetic resource" /><div className="form-actions"><Button variant="quiet" onClick={reset}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <LoaderCircle className="spin" size={14} />}{editing !== null ? 'Save changes' : 'Create resource'}</Button></div>{(create.isError || update.isError) && <ErrorMessage error={create.error || update.error} />}</form></Panel>}
    {(create.isSuccess || update.isSuccess) && <div className="success-notice"><CheckCircle2 size={16} /> Resource saved to the demo API.</div>}
    {remove.isError && <ErrorMessage error={remove.error} />}
    {resources.isLoading ? <LoadingState rows={4} /> : resources.isError ? <ErrorState retry={() => resources.refetch()} /> : !resources.data?.length ? <EmptyState title="No synthetic resources" detail="Create a demo resource to use in the API explorer." action={<Button onClick={() => setFormOpen(true)}><Plus size={14} /> Create resource</Button>} /> : <Panel className="table-panel"><div className="table-wrap"><table><thead><tr><th>Resource</th><th>Owner</th><th>Description</th><th>Created</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{resources.data.map(r => <tr key={r.id}><td><b>{r.name}</b><span className="table-sub mono">RESOURCE-{r.id}</span></td><td><StatusPill tone={r.ownerId === 'alice' ? 'info' : 'warn'}>{r.ownerName} · {r.ownerId}</StatusPill></td><td className="resource-description">{r.description}</td><td>{dateLabel(r.createdAt)}</td><td>{dateLabel(r.updatedAt)}</td><td><div className="table-actions"><button className="icon-button" aria-label={`Edit ${r.name}`} title="Edit resource" onClick={() => beginEdit(r)}><FileText size={15} /></button><button className="icon-button danger-icon" aria-label={`Delete ${r.name}`} title="Delete resource" onClick={() => del(r.id)} disabled={remove.isPending}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></Panel>}
  </Shell>;
}

function ProtectedRoutes() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/dashboard" component={() => <SignedInGate><Dashboard /></SignedInGate>} />
    <Route path="/lab" component={() => <SignedInGate><LabPolicy /></SignedInGate>} />
    <Route path="/api-explorer" component={() => <SignedInGate><ApiExplorer /></SignedInGate>} />
    <Route path="/comparison" component={() => <SignedInGate><Comparison /></SignedInGate>} />
    <Route path="/findings/:id" component={() => <SignedInGate><FindingDetail /></SignedInGate>} />
    <Route path="/findings" component={() => <SignedInGate><Findings /></SignedInGate>} />
    <Route path="/history/:id" component={() => <SignedInGate><HistoryPage /></SignedInGate>} />
    <Route path="/history" component={() => <SignedInGate><HistoryPage /></SignedInGate>} />
    <Route path="/audit" component={() => <SignedInGate><Audit /></SignedInGate>} />
    <Route path="/docs" component={() => <SignedInGate><Docs /></SignedInGate>} />
    <Route path="/resources" component={() => <SignedInGate><Resources /></SignedInGate>} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue to AuthScope' } }, signUp: { start: { title: 'Create your account', subtitle: 'Start learning in a controlled lab' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheClear />
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sign-in/*?" component={() => <AuthPage />} />
      <Route path="/sign-up/*?" component={() => <AuthPage signup />} />
      <Route component={ProtectedRoutes} />
    </Switch>
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ClerkRoutes /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
