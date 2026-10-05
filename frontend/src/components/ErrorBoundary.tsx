import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Bọc vùng workspace để lỗi runtime hiện ra bằng thông báo thay vì trang trắng.
 * Trước đó một lỗi ở bất kỳ giai đoạn nào cũng làm React dừng render toàn bộ app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Giữ lại stack để chẩn đoán trong console khi chạy thật.
    console.error("Ứng dụng gặp lỗi khi hiển thị:", error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-rose-900">
            Đã xảy ra lỗi khi tải màn hình này
          </h2>
          <p className="mt-2 text-sm text-rose-800">{error.message}</p>
          <details className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-rose-700">
            <summary className="cursor-pointer font-medium">
              Xem chi tiết kỹ thuật
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
              {error.stack ?? error.message}
            </pre>
          </details>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
