import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, ErrorUtils, ErrorSeverity } from '../utils/AppError';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const appError = this.state.error instanceof AppError 
        ? this.state.error 
        : new AppError('UNKNOWN_ERROR', this.state.error?.message || '未知错误');
      
      const userMessage = ErrorUtils.getUserFriendlyMessage(appError);
      const isRecoverable = ErrorUtils.isRecoverable(appError);
      const retryStrategy = ErrorUtils.getRetryStrategy(appError);

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '24px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>出错了</h2>
          <p style={{ color: '#7f1d1d', marginBottom: '24px', textAlign: 'center' }}>
            {userMessage}
          </p>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {isRecoverable && retryStrategy.shouldRetry && (
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                重试
              </button>
            )}
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              刷新页面
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              返回首页
            </button>
          </div>

          {this.state.error && (
            <details style={{ marginTop: '24px', width: '100%', maxWidth: '600px' }}>
              <summary style={{ cursor: 'pointer', color: '#7f1d1d' }}>技术详情</summary>
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#fff',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflow: 'auto'
              }}>
                <p><strong>错误代码:</strong> {(appError as any).code}</p>
                <p><strong>严重程度:</strong> {appError.severity}</p>
                <p><strong>消息:</strong> {appError.message}</p>
                {this.state.errorInfo && (
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.errorInfo.componentStack}</pre>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
