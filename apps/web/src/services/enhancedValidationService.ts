/**
 * 增强合规校验服务
 * 提供必填字段校验、违规内容检测、价格异常检测等能力
 */

import {
  loadSkill,
  validateCompliance,
  type ComplianceResult,
  type PlatformRuleSkill,
} from '../skills';

/**
 * 极限词库（广告法违禁词）
 */
const LIMIT_WORDS = [
  '第一', '唯一', '顶级', '最高', '最低', '最佳', '最便宜', '最流行',
  '最受欢迎', '销量第一', '冠军', '独家', '绝无仅有', '史无前例',
  '万能', '领先', '首选', '极致', '完美', '极品', '驰名',
];

/**
 * 抖店敏感词库
 */
const DOUYIN_SENSITIVE_WORDS = [
  '微商', '代购', '私单', '微信', 'QQ', '外链', '加V', '加微信',
  '私信', '私聊', '转账', '线下交易',
];

/**
 * 增强合规校验选项
 */
export interface EnhancedValidationOptions {
  checkLimitWords?: boolean;
  checkSensitiveWords?: boolean;
  checkPriceAnomaly?: boolean;
  checkSKUPriceTrap?: boolean;
}

/**
 * 增强合规校验结果
 */
export interface EnhancedComplianceResult extends ComplianceResult {
  limitWordMatches?: string[];
  sensitiveWordMatches?: string[];
  priceAnomalyDetected?: boolean;
  skuTrapDetected?: boolean;
}

/**
 * 执行增强合规校验
 */
export function enhancedValidate(
  platform: string,
  data: Record<string, string>,
  skuData?: Array<{ name: string; price?: number }>,
  options: EnhancedValidationOptions = {}
): EnhancedComplianceResult {
  const opts = {
    checkLimitWords: true,
    checkSensitiveWords: true,
    checkPriceAnomaly: true,
    checkSKUPriceTrap: true,
    ...options,
  };

  // 先执行基础合规校验
  const baseResult = validateCompliance(platform, data);

  const additionalViolations: ComplianceResult['violations'] = [];
  const additionalWarnings: string[] = [];
  const additionalPassedChecks: string[] = [];

  // 合并所有文本内容进行关键词检测
  const allText = Object.values(data).join(' ');

  // 极限词检测
  let limitWordMatches: string[] = [];
  if (opts.checkLimitWords) {
    limitWordMatches = LIMIT_WORDS.filter(word => allText.includes(word));
    if (limitWordMatches.length > 0) {
      additionalViolations.push({
        ruleId: 'LIMIT_WORDS',
        ruleName: '极限词检测',
        severity: 'critical',
        field: '标题/描述',
        value: limitWordMatches.join(', '),
        message: `检测到极限词: ${limitWordMatches.join('、')}`,
        suggestion: '请删除极限词，改用客观描述',
      });
    } else {
      additionalPassedChecks.push('极限词检测通过');
    }
  }

  // 抖店敏感词检测
  let sensitiveWordMatches: string[] = [];
  if (opts.checkSensitiveWords && platform === 'douyin') {
    sensitiveWordMatches = DOUYIN_SENSITIVE_WORDS.filter(word => allText.includes(word));
    if (sensitiveWordMatches.length > 0) {
      additionalViolations.push({
        ruleId: 'DOUYIN_SENSITIVE',
        ruleName: '抖店敏感词',
        severity: 'critical',
        field: '标题/描述',
        value: sensitiveWordMatches.join(', '),
        message: `检测到抖店敏感词: ${sensitiveWordMatches.join('、')}`,
        suggestion: '请删除敏感词',
      });
    } else {
      additionalPassedChecks.push('敏感词检测通过');
    }
  }

  // 价格异常检测
  let priceAnomalyDetected = false;
  if (opts.checkPriceAnomaly) {
    const priceStr = data['售价'] || data['价格'] || data['price'];
    if (priceStr) {
      const price = parseFloat(priceStr);
      const skill = loadSkill(platform);
      if (!isNaN(price) && skill) {
        const minPrice = skill.platformRules.priceMinValue ?? 0.01;
        if (price < minPrice) {
          priceAnomalyDetected = true;
          additionalViolations.push({
            ruleId: 'PRICE_TOO_LOW',
            ruleName: '价格过低',
            severity: 'critical',
            field: '售价',
            value: priceStr,
            message: `价格低于平台最低价${minPrice}`,
            suggestion: '请调整价格',
          });
        } else {
          additionalPassedChecks.push('价格范围合规');
        }
      }
    }
  }

  // SKU低价引流检测
  let skuTrapDetected = false;
  if (opts.checkSKUPriceTrap && skuData && skuData.length >= 2) {
    const sortedByPrice = [...skuData]
      .filter(s => s.price !== undefined)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

    if (sortedByPrice.length >= 2) {
      const lowest = sortedByPrice[0];
      const accessoryKeywords = ['配件', '赠品', '样品', '试用'];
      if (accessoryKeywords.some(kw => lowest.name.includes(kw))) {
        skuTrapDetected = true;
        additionalViolations.push({
          ruleId: 'SKU_PRICE_TRAP',
          ruleName: 'SKU低价引流',
          severity: 'critical',
          field: 'SKU',
          value: lowest.name,
          message: `${lowest.name}可能为低价引流SKU`,
          suggestion: '确保低价SKU为有效商品规格',
        });
      } else {
        additionalPassedChecks.push('SKU价格检测通过');
      }
    }
  }

  return {
    isValid: baseResult.isValid && additionalViolations.filter(v => v.severity === 'critical').length === 0,
    violations: [...baseResult.violations, ...additionalViolations],
    warnings: [...baseResult.warnings, ...additionalWarnings],
    passedChecks: [...baseResult.passedChecks, ...additionalPassedChecks],
    limitWordMatches,
    sensitiveWordMatches,
    priceAnomalyDetected,
    skuTrapDetected,
  };
}

/**
 * 快速极限词检测
 */
export function quickCheckLimitWords(text: string): { hasLimitWords: boolean; matches: string[] } {
  const matches = LIMIT_WORDS.filter(word => text.includes(word));
  return {
    hasLimitWords: matches.length > 0,
    matches,
  };
}

/**
 * 检测标题长度是否符合平台要求
 */
export function checkTitleLength(platform: string, title: string): {
  isValid: boolean;
  currentLength: number;
  maxLength: number;
  minLength: number;
  suggestion: string;
} {
  const skill = loadSkill(platform);
  if (!skill) {
    return {
      isValid: false,
      currentLength: title.length,
      maxLength: 60,
      minLength: 5,
      suggestion: `未知平台: ${platform}`,
    };
  }

  const { titleMaxLength, titleMinLength } = skill.platformRules;
  const isValid = title.length <= titleMaxLength && title.length >= titleMinLength;
  let suggestion = '';

  if (title.length > titleMaxLength) {
    suggestion = `标题过长，需精简至${titleMaxLength}字符以内`;
  } else if (title.length < titleMinLength) {
    suggestion = `标题过短，需补充至${titleMinLength}字符以上`;
  }

  return {
    isValid,
    currentLength: title.length,
    maxLength: titleMaxLength,
    minLength: titleMinLength,
    suggestion,
  };
}

/**
 * 获取平台限制摘要
 */
export function getPlatformLimitsSummary(platform: string): string {
  const skill = loadSkill(platform);
  if (!skill) return `未知平台: ${platform}`;

  const { platformRules, skuRules } = skill;
  return `${skill.meta.platformName}规则摘要:
- 标题长度: ${platformRules.titleMinLength}-${platformRules.titleMaxLength}字符
- 价格范围: ${(platformRules.priceMinValue ?? 0.01).toFixed(2)} - ${(platformRules.priceMaxValue ?? 99999999).toFixed(2)}
- SKU上限: ${skuRules.maxSKUCount}个
- SKU属性上限: ${skuRules.maxAttributeCount}个`;
}