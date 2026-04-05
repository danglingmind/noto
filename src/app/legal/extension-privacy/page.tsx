'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import type { LucideIcon } from 'lucide-react'
import {
	Shield,
	Database,
	Eye,
	Mail,
	Clock,
	ShieldCheck,
	Lock,
	RefreshCw,
	ArrowLeft,
	Cpu,
	FileText,
	AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
	return (
		<section className="mb-8">
			<h2
				className="text-lg mb-4 flex items-center"
				style={{
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.heading,
					fontSize: '18px',
					fontWeight: 'normal',
				}}
			>
				<Icon className="h-5 w-5 mr-2" />
				{title}
			</h2>
			{children}
		</section>
	)
}

function Bullet({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2 text-sm">
			<span
				className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
				style={{ backgroundColor: 'var(--text-muted)' }}
			/>
			<span style={{ color: 'var(--text-primary)' }}>{children}</span>
		</li>
	)
}

function P({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
			{children}
		</p>
	)
}

function Table({ rows }: { rows: [string, string, string][] }) {
	return (
		<div className="overflow-x-auto mt-2">
			<table className="w-full text-sm border-collapse">
				<thead>
					<tr style={{ borderBottom: '1px solid var(--accent-border)' }}>
						{['Permission', 'Why it is required', 'Scope'].map((h) => (
							<th
								key={h}
								className="text-left py-2 pr-4 font-normal"
								style={{ color: 'var(--text-tertiary)' }}
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map(([perm, why, scope], i) => (
						<tr
							key={i}
							style={{ borderBottom: '1px solid var(--accent-border)' }}
						>
							<td className="py-2 pr-4 font-mono" style={{ color: 'var(--text-primary)', fontSize: '12px' }}>
								{perm}
							</td>
							<td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
								{why}
							</td>
							<td className="py-2" style={{ color: 'var(--text-tertiary)' }}>
								{scope}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export default function ExtensionPrivacyPage() {
	return (
		<>
			<style jsx global>{`
				:root {
					--text-primary: ${theme.colors.text.primary};
					--text-secondary: ${theme.colors.text.secondary};
					--text-tertiary: ${theme.colors.text.tertiary};
					--text-muted: ${theme.colors.text.muted};
					--accent: ${theme.colors.accent.primary};
					--accent-border: ${theme.colors.accent.border};
				}
			`}</style>
			<div
				className={`min-h-screen ${montserrat.variable}`}
				style={{
					backgroundColor: '#ffffff',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body,
				}}
			>
				<SupportHeader />

				<main className="container mx-auto px-4 pt-20 pb-12 max-w-4xl relative">
					<Link
						href="/legal/privacy"
						className="absolute top-4 right-0 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
						style={{ color: 'var(--text-primary)' }}
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</Link>

					<div className="mb-8">
						<h1
							className="text-2xl mb-4"
							style={{
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading,
								fontSize: '24px',
								fontWeight: 'normal',
							}}
						>
							Vynl Browser Extension — Privacy Policy
						</h1>
						<div className="space-y-1">
							<p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
								Effective Date: April 5, 2026
							</p>
							<p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
								Applies to: Vynl Chrome Extension · Vynl Firefox Add-on
							</p>
							<p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
								Entity: <em>VYNL by The Studio Meraki</em>
							</p>
							<p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
								Contact: team@vynl.in
							</p>
						</div>
					</div>

					<div className="space-y-2">

						{/* 1 - Single Purpose */}
						<Section icon={Shield} title="1. Single Purpose">
							<P>
								The Vynl browser extension does one thing: it captures an HTML snapshot of the web page
								currently open in your active tab and uploads that snapshot to your Vynl project. Nothing
								else is collected, monitored, or transmitted.
							</P>
							<P>
								The extension never runs in the background, never monitors your browsing activity, and
								never accesses any tab other than the one you are actively viewing at the moment you
								click Capture.
							</P>
						</Section>

						{/* 2 - Permissions */}
						<Section icon={Cpu} title="2. Permissions Requested and Why">
							<P>
								The table below lists every permission the extension requests. No permission is
								requested beyond what is strictly required for the single capture workflow.
							</P>
							<Table
								rows={[
									[
										'activeTab',
										'Grants temporary access to the tab you are currently viewing, only while the extension popup is open. Used to read the page URL, title, and rendered HTML.',
										'Active tab only · User-initiated',
									],
									[
										'scripting',
										'Required to inject the capture function into the active tab to serialize the live DOM (including shadow DOM) and assign vynl-id attributes before upload.',
										'Active tab only · User-initiated',
									],
									[
										'storage',
										'Stores your selected default project and a short-lived authentication token locally on your device so you do not have to re-select them on every capture.',
										'Local device only',
									],
									[
										'host_permissions\n(app.vynl.in)',
										'Required to read the Clerk session token from the Vynl web app tab (if open) so the extension can authenticate API calls on your behalf. No data is read from any other origin.',
										'vynl.in domain only',
									],
								]}
							/>
						</Section>

						{/* 3 - Data collected */}
						<Section icon={Database} title="3. Data Collected">
							<P>
								The extension collects only what is needed to perform the capture you explicitly
								trigger. The following data is transmitted to Vynl servers:
							</P>
							<ul className="space-y-2 mb-4">
								<Bullet>
									<strong>Page HTML</strong> — the fully rendered HTML of the active tab at the moment
									you click Capture. This is the snapshot that is saved to your project.
								</Bullet>
								<Bullet>
									<strong>Page title</strong> — used as the default file name. You may override this
									before submitting.
								</Bullet>
								<Bullet>
									<strong>Page URL</strong> — recorded in the file metadata so collaborators know the
									origin of the snapshot. If the URL is a local address (localhost, 127.0.0.1,
									file://, or a private IP range), a synthetic URL derived from the title is stored
									instead; the real local URL is never sent.
								</Bullet>
								<Bullet>
									<strong>Your Vynl user identity</strong> — a short-lived JWT issued by Clerk,
									read from your active Vynl session. Used only to authenticate the upload API call.
									No password or credential is ever read or stored.
								</Bullet>
							</ul>
							<P>The following data is stored locally on your device only (via chrome.storage.local):</P>
							<ul className="space-y-2">
								<Bullet>
									Your last selected Vynl project ID (so it pre-fills on the next capture).
								</Bullet>
								<Bullet>
									A cached authentication token (expires automatically; refreshed from your Vynl
									session when needed).
								</Bullet>
							</ul>
						</Section>

						{/* 4 - Data NOT collected */}
						<Section icon={AlertCircle} title="4. Data We Do Not Collect">
							<ul className="space-y-2">
								<Bullet>Browsing history or any URLs you visit.</Bullet>
								<Bullet>Content of any tab other than the one you explicitly capture.</Bullet>
								<Bullet>Keystrokes, form inputs, or passwords.</Bullet>
								<Bullet>
									Persistent cookies, fingerprinting data, or device identifiers beyond what Clerk&apos;s
									standard session mechanism uses.
								</Bullet>
								<Bullet>Any data while the popup is closed. The extension is entirely dormant between captures.</Bullet>
							</ul>
						</Section>

						{/* 5 - How data is used */}
						<Section icon={Eye} title="5. How Data Is Used">
							<ul className="space-y-2">
								<Bullet>
									The captured HTML is stored in your Vynl project in Supabase Storage so you and
									your collaborators can view and annotate it inside the Vynl app.
								</Bullet>
								<Bullet>
									The page title and URL are stored as file metadata in the Vynl database (PostgreSQL
									via Prisma/Supabase).
								</Bullet>
								<Bullet>
									The JWT is used for a single authenticated API call and is never logged, shared, or
									stored on Vynl servers.
								</Bullet>
								<Bullet>
									Locally cached data (project ID, token) is used solely to make subsequent captures
									faster and is never transmitted to any third party.
								</Bullet>
							</ul>
						</Section>

						{/* 6 - Data sharing */}
						<Section icon={FileText} title="6. Data Sharing">
							<P>
								Captured HTML and metadata are stored on infrastructure operated by the following
								sub-processors, each bound by a Data Processing Agreement:
							</P>
							<ul className="space-y-2 mb-4">
								<Bullet>
									<strong>Supabase</strong> — file storage and relational database.
								</Bullet>
								<Bullet>
									<strong>Clerk</strong> — authentication; issues the JWT the extension reads.
								</Bullet>
								<Bullet>
									<strong>Vercel</strong> — hosts the Vynl API that receives the upload request.
								</Bullet>
							</ul>
							<P>
								No captured page content is ever sold, rented, shared with advertisers, or used to
								train machine-learning models.
							</P>
						</Section>

						{/* 7 - Data retention */}
						<Section icon={Clock} title="7. Data Retention">
							<ul className="space-y-2">
								<Bullet>
									Captured snapshots are retained as long as the corresponding Vynl project exists
									or until you delete the file from within the Vynl app.
								</Bullet>
								<Bullet>
									Locally stored data (chrome.storage.local) is cleared when you sign out of the
									extension or uninstall it.
								</Bullet>
								<Bullet>
									Authentication tokens expire automatically and are never persisted beyond a single
									browser session on the Vynl server side.
								</Bullet>
							</ul>
						</Section>

						{/* 8 - Security */}
						<Section icon={Lock} title="8. Security">
							<ul className="space-y-2">
								<Bullet>
									All data transmitted from the extension to Vynl servers travels over HTTPS/TLS.
								</Bullet>
								<Bullet>
									The extension does not execute any remotely hosted code. All logic ships with the
									extension package itself.
								</Bullet>
								<Bullet>
									The extension&apos;s host permission is scoped strictly to app.vynl.in. It cannot read
									data from any other domain.
								</Bullet>
							</ul>
						</Section>

						{/* 9 - User rights */}
						<Section icon={ShieldCheck} title="9. Your Rights">
							<P>
								Because the extension uploads data to your Vynl account, your rights under GDPR,
								CCPA, and applicable data protection laws apply to that data. You may:
							</P>
							<ul className="space-y-2 mb-4">
								<Bullet>Delete individual captured files at any time from within the Vynl app.</Bullet>
								<Bullet>
									Request full account deletion and erasure of all associated data by emailing
									team@vynl.in.
								</Bullet>
								<Bullet>
									Clear locally cached data at any time via your browser&apos;s extension management
									page (Clear data / Remove extension).
								</Bullet>
							</ul>
						</Section>

						{/* 10 - Updates */}
						<Section icon={RefreshCw} title="10. Changes to This Policy">
							<P>
								We may update this policy when the extension&apos;s functionality changes. The effective
								date at the top of this page will reflect the latest revision. Continued use of the
								extension after an update constitutes acceptance of the revised policy.
							</P>
						</Section>

						{/* 11 - Contact */}
						<Section icon={Mail} title="11. Contact">
							<P>
								For any privacy questions related to the extension, contact us at{' '}
								<a
									href="mailto:team@vynl.in"
									style={{ color: 'var(--accent)' }}
								>
									team@vynl.in
								</a>
								.
							</P>
						</Section>

					</div>

					<div className="mt-12 flex justify-end">
						<Link
							href="/legal/privacy"
							className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
							style={{ color: 'var(--text-primary)' }}
						>
							<ArrowLeft className="h-4 w-4" />
							Back
						</Link>
					</div>
				</main>

				<SupportFooter />
			</div>
		</>
	)
}
