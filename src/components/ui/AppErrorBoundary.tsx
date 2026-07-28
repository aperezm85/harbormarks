import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowClockwiseIcon, HouseIcon } from "@phosphor-icons/react"
import { Component, type ErrorInfo, type ReactNode } from "react"

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We could not render this screen. You can retry or go back home.
            </p>
            <div className="flex gap-2">
              <Button type="button" onClick={this.reset}>
                <ArrowClockwiseIcon
                  className="size-4"
                  data-icon="inline-start"
                />
                Retry
              </Button>
              <Button asChild type="button" variant="outline">
                <a href="/">
                  <HouseIcon className="size-4" data-icon="inline-start" />
                  Home
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
