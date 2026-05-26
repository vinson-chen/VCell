/**
 * 合规报告组件
 * 展示合规校验结果、违规详情、修复建议
 */

import { useMemo } from 'react';
import { Space, Typography, vcTokens } from '@vinson.hx/vc-design';
import type { ComplianceResult } from '../skills';

const { Text, Title } = Typography;

interface ComplianceReportProps {
  result: ComplianceResult | null;
  platformName?: string;
  compact?: boolean;
}

export function ComplianceReport({ result, platformName, compact = false }: ComplianceReportProps) {
  const summary = useMemo(() => {
    if (!result) return null;

    const criticalCount = result.violations.filter(v => v.severity === 'critical').length;
    const warningCount = result.violations.filter(v => v.severity === 'warning').length;
    const infoCount = result.violations.filter(v => v.severity === 'info').length;

    return {
      status: result.isValid ? 'pass' : 'fail',
      criticalCount,
      warningCount,
      infoCount,
      passedCount: result.passedChecks.length,
    };
  }, [result]);

  if (!result) {
    return (
      <div style={{ padding: 12, textAlign: 'center', color: vcTokens.color.neutral.text.sub }}>
        <Text>尚未执行合规校验</Text>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{ padding: 8 }}>
        <Space>
          <Text style={{ color: result.isValid ? vcTokens.color.success.default : vcTokens.color.danger.default }}>
            {result.isValid ? '✅ 合规' : '❌ 不合规'}
          </Text>
          {summary && summary.criticalCount > 0 && (
            <Text type="danger">严重问题: {summary.criticalCount}</Text>
          )}
          {summary && summary.warningCount > 0 && (
            <Text type="warning">警告: {summary.warningCount}</Text>
          )}
        </Space>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        background: vcTokens.color.neutral.background.container,
        borderRadius: 8,
      }}
    >
      {/* 标题 */}
      {platformName && (
        <Title level={5} style={{ marginBottom: 12 }}>
          {platformName}合规报告
        </Title>
      )}

      {/* 状态概览 */}
      <div
        style={{
          padding: 12,
          background: result.isValid
            ? vcTokens.color.success.background
            : vcTokens.color.danger.background,
          borderRadius: 4,
          marginBottom: 12,
        }}
      >
        <Space direction="vertical" size="small">
          <Text
            strong
            style={{ color: result.isValid ? vcTokens.color.success.default : vcTokens.color.danger.default }}
          >
            {result.isValid ? '✅ 合规校验通过' : '❌ 合规校验未通过'}
          </Text>
          {summary && (
            <Space>
              {summary.criticalCount > 0 && (
                <Text style={{ color: vcTokens.color.danger.default }}>
                  严重问题: {summary.criticalCount}
                </Text>
              )}
              {summary.warningCount > 0 && (
                <Text style={{ color: vcTokens.color.warning.default }}>
                  警告: {summary.warningCount}
                </Text>
              )}
              {summary.infoCount > 0 && (
                <Text type="secondary">提示: {summary.infoCount}</Text>
              )}
              {summary.passedCount > 0 && (
                <Text style={{ color: vcTokens.color.success.default }}>
                  通过: {summary.passedCount}
                </Text>
              )}
            </Space>
          )}
        </Space>
      </div>

      {/* 违规详情 */}
      {result.violations.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            违规详情
          </Text>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {result.violations.map((v, index) => (
              <div
                key={index}
                style={{
                  padding: 8,
                  background: vcTokens.color.neutral.background.layout,
                  borderRadius: 4,
                  borderLeft: `3px solid ${
                    v.severity === 'critical'
                      ? vcTokens.color.danger.default
                      : v.severity === 'warning'
                      ? vcTokens.color.warning.default
                      : vcTokens.color.neutral.border.default
                  }`,
                }}
              >
                <Space direction="vertical" size="small">
                  <Space>
                    <Text
                      strong
                      style={{
                        color:
                          v.severity === 'critical'
                            ? vcTokens.color.danger.default
                            : v.severity === 'warning'
                            ? vcTokens.color.warning.default
                            : vcTokens.color.neutral.text.default,
                      }}
                    >
                      {v.severity === 'critical' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵'} {v.ruleName}
                    </Text>
                    <Text type="secondary">| {v.field}</Text>
                  </Space>
                  <Text>{v.message}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    建议: {v.suggestion}
                  </Text>
                </Space>
              </div>
            ))}
          </Space>
        </div>
      )}

      {/* 通过检查 */}
      {result.passedChecks.length > 0 && (
        <div>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            通过检查 ({result.passedChecks.length})
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {result.passedChecks.map((check, index) => (
              <Text
                key={index}
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  background: vcTokens.color.success.background,
                  borderRadius: 4,
                  color: vcTokens.color.success.default,
                }}
              >
                ✅ {check}
              </Text>
            ))}
          </div>
        </div>
      )}

      {/* 警告 */}
      {result.warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            其他警告
          </Text>
          <Space direction="vertical" size="small">
            {result.warnings.map((w, index) => (
              <Text key={index} type="warning">🟡 {w}</Text>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
}

/**
 * 违规项计数徽章
 */
export function ViolationBadge({ count, severity }: { count: number; severity: 'critical' | 'warning' | 'info' }) {
  if (count === 0) return null;

  const color =
    severity === 'critical'
      ? vcTokens.color.danger.default
      : severity === 'warning'
      ? vcTokens.color.warning.default
      : vcTokens.color.neutral.text.sub;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 6px',
        background: color,
        color: '#fff',
        borderRadius: 9,
        fontSize: 12,
        fontWeight: 'bold',
      }}
    >
      {count}
    </span>
  );
}