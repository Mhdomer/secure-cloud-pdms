import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render errors anywhere below it in the tree.
 *
 * Deliberately does NOT use react-i18next or any design-system component —
 * if something has broken badly enough to trip this boundary, i18next
 * initialization, the auth store, or even Tailwind's class pipeline are
 * exactly the kinds of things that might be the cause. Strings are
 * hardcoded in both languages so the fallback always renders.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info)
  }

  handleReload = () => {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Plain Tailwind utility classes (already compiled into the app's CSS
    // bundle at build time, so this doesn't depend on anything that could
    // itself be broken at runtime) — no inline hex colors, no i18next.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-6 text-center text-foreground">
        <div>
          <p className="text-lg font-semibold">Something went wrong.</p>
          <p dir="rtl" lang="ar" className="text-lg font-semibold">
            حدث خطأ ما.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Please reload the page. If the problem continues, contact your administrator.</p>
          <p dir="rtl" lang="ar">
            الرجاء إعادة تحميل الصفحة. إذا استمرت المشكلة، تواصل مع المسؤول.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-primary-700 active:scale-[0.98]"
        >
          Reload / إعادة التحميل
        </button>
      </div>
    )
  }
}
