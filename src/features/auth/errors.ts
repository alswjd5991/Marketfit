const MESSAGES: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호를 확인해 주세요.",
  email_not_confirmed: "가입 확인 이메일의 링크를 누른 뒤 로그인해 주세요. 스팸함도 확인해 주세요.",
  user_already_exists: "이미 가입된 이메일이에요. 로그인해 주세요.",
  email_exists: "이미 가입된 이메일이에요. 로그인해 주세요.",
  email_address_invalid: "사용 가능한 이메일 주소를 입력해 주세요.",
  email_address_not_authorized: "현재 가입 확인 이메일을 보낼 수 없는 주소예요. 관리자에게 이메일 발송 설정을 문의해 주세요.",
  signup_disabled: "현재 회원가입을 받을 수 없어요. 관리자에게 문의해 주세요.",
  email_provider_disabled: "현재 이메일 가입을 사용할 수 없어요. 관리자에게 문의해 주세요.",
  weak_password: "비밀번호가 보안 조건을 충족하지 못했어요. 더 길고 추측하기 어려운 비밀번호를 사용해 주세요.",
  over_email_send_rate_limit: "이메일 발송 요청이 많아요. 잠시 후 다시 시도해 주세요.",
  over_request_rate_limit: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
};

/** 원본 메시지에 포함될 수 있는 내부 정보는 사용자에게 그대로 노출하지 않는다. */
export function authErrorMessage(error: unknown): string {
  const detail = error && typeof error === "object"
    ? error as { code?: string; status?: number; name?: string; message?: string }
    : {};
  if (detail.code && Object.hasOwn(MESSAGES, detail.code)) return MESSAGES[detail.code];
  if (detail.status === 429) return MESSAGES.over_request_rate_limit;
  if (detail.status === 0 || detail.name === "AuthRetryableFetchError"
    || detail.name === "AbortError" || detail.name === "TimeoutError"
    || /fetch failed|failed to fetch|network|load failed/i.test(detail.message ?? "")) {
    return "인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 관리자에게 서버 연결 상태를 문의해 주세요.";
  }
  return "인증 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 관리자에게 문의해 주세요.";
}
