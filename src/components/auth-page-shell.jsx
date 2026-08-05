import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/logo'

const DEFAULT_POINTS = [
  'Secure account access',
  'Fast, distraction-free sign in',
  'Email verification and recovery',
]

export function AuthPageShell({
  children,
  eyebrow = 'BazarHQ Commerce OS',
  title,
  description,
  audience = 'merchant',
  points = DEFAULT_POINTS,
  backTo = '/',
  backLabel = 'Back to home',
}) {
  const accent = audience === 'customer'
    ? 'from-cyan-500 via-sky-500 to-indigo-500'
    : 'from-emerald-500 via-teal-500 to-cyan-500'

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_88%_16%,rgba(59,130,246,0.13),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.10),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-stretch lg:grid-cols-[1.02fr_0.98fr]">
        <section className="hidden min-h-screen flex-col justify-between px-12 py-10 lg:flex xl:px-16">
          <div className="flex items-center justify-between">
            <Logo size="lg" />
            <Link
              to={backTo}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="max-w-xl pb-10"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              {eyebrow}
            </div>
            <h2 className="text-5xl font-black leading-[1.06] tracking-[-0.045em] text-slate-950 xl:text-6xl">
              {title}
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">{description}</p>

            <div className="mt-9 grid gap-3">
              {points.map((point) => (
                <div key={point} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  {point}
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Protected by Supabase Auth and BazarHQ role security
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center p-4 sm:p-7 lg:p-10">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="w-full max-w-[31rem]"
          >
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Logo size="lg" />
              <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950">
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/90 bg-white/92 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
              <div className="p-6 sm:p-8">{children}</div>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              By continuing, you agree to BazarHQ&apos;s Terms of Service and Privacy Policy.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  )
}
