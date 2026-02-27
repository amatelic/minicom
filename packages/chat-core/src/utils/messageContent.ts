export const MESSAGE_MAX_LENGTH = 500;

export type MessageValidationReason = "empty" | "too_long" | "sql_injection";

export interface MessageValidationResult {
  isValid: boolean;
  reason: MessageValidationReason | null;
  value: string;
}

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /'\s*(or|and)\s+[^=]+=\s*[^-]+/i,
  /\bunion\s+all?\s+select\b/i,
  /;\s*(select|insert|update|delete|drop|alter|create|truncate|exec(?:ute)?)\b/i,
  /\b(drop|alter|truncate)\s+table\b/i,
  /--\s*$/,
  /\/\*[\s\S]*\*\//,
];

const isPotentialSqlInjection = (value: string): boolean => {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
};

export const validateMessageBody = (value: string): MessageValidationResult => {
  const normalized = value.trim();
  if (!normalized) {
    return {
      isValid: false,
      reason: "empty",
      value: "",
    };
  }

  if (normalized.length > MESSAGE_MAX_LENGTH) {
    return {
      isValid: false,
      reason: "too_long",
      value: normalized,
    };
  }

  if (isPotentialSqlInjection(normalized)) {
    return {
      isValid: false,
      reason: "sql_injection",
      value: normalized,
    };
  }

  return {
    isValid: true,
    reason: null,
    value: normalized,
  };
};
