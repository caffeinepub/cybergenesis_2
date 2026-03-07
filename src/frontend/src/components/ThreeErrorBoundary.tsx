import type React from "react";
import { Component, type ReactNode } from "react";

interface ThreeErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: string) => void;
}

interface ThreeErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * React Error Boundary для перехвата всех ошибок рендеринга в 3D сцене.
 * Предотвращает краш Canvas и логирует ошибки без пробрасывания дальше.
 */
class ThreeErrorBoundary extends Component<
  ThreeErrorBoundaryProps,
  ThreeErrorBoundaryState
> {
  constructor(props: ThreeErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error: Error): ThreeErrorBoundaryState {
    console.error("[ThreeErrorBoundary] ❌ Caught rendering error:", error);
    console.error("[ThreeErrorBoundary] Stack trace:", error.stack);

    return {
      hasError: true,
      errorMessage: error.message || "Unknown rendering error",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      "[ThreeErrorBoundary] 🚨 Component stack:",
      errorInfo.componentStack,
    );
    console.error("[ThreeErrorBoundary] 🚨 Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // Передаём ошибку в родительский компонент через callback
    if (this.props.onError) {
      this.props.onError(error.message || "Unknown rendering error");
    }

    // Логируем, но НЕ пробрасываем дальше - Canvas остаётся живым
    console.log(
      "[ThreeErrorBoundary] ✅ Error logged, Canvas remains operational",
    );
  }

  render() {
    if (this.state.hasError) {
      // Возвращаем fallback UI вместо краша
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-red-900/20 to-black">
          <div className="text-center p-8 glassmorphism rounded-lg neon-border box-glow-red max-w-md">
            <div className="w-32 h-32 mx-auto mb-4 border-4 border-red-500/50 rounded-lg animate-pulse relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-pink-500/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">⚠️</span>
              </div>
            </div>
            <p className="text-red-400 text-lg font-orbitron font-bold mb-2">
              Ошибка рендеринга 3D
            </p>
            <p className="text-red-300 text-sm font-jetbrains mb-4">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                console.log("[ThreeErrorBoundary] 🔄 Resetting error state");
                this.setState({ hasError: false, errorMessage: "" });
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-orbitron text-sm transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ThreeErrorBoundary;
