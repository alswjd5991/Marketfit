import assert from "node:assert/strict";
import { test } from "node:test";
import { authErrorMessage } from "./errors";

test("연결 실패를 계정 오류와 구분해 안내한다", () => {
  for (const error of [new TypeError("fetch failed"), { message: "Failed to fetch" }, { name: "AuthRetryableFetchError", status: 0 }]) {
    assert.match(authErrorMessage(error), /인증 서버에 연결하지 못했어요/);
  }
  assert.match(authErrorMessage({ code: "invalid_credentials" }), /이메일 또는 비밀번호/);
});

test("이메일 확인과 발송 제한은 다음 행동을 구체적으로 안내한다", () => {
  assert.match(authErrorMessage({ code: "email_not_confirmed" }), /확인 이메일의 링크/);
  assert.match(authErrorMessage({ code: "email_address_not_authorized" }), /이메일 발송 설정/);
  assert.match(authErrorMessage({ status: 429 }), /요청이 너무 많아요/);
});

test("알 수 없는 오류와 프로토타입 이름을 내부 메시지로 노출하지 않는다", () => {
  for (const error of [null, { message: "private database detail" }, { code: "constructor" }]) {
    assert.equal(typeof authErrorMessage(error), "string");
    assert.match(authErrorMessage(error), /인증 요청을 처리하지 못했어요/);
    assert.doesNotMatch(authErrorMessage(error), /private database detail/);
  }
});
