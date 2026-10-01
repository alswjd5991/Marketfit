import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageContent } from "./message-content";

test("답변의 강조·제목·행사 번호·표를 의미 있는 HTML로 표시한다", () => {
  const html = renderToStaticMarkup(<MessageContent content={'**결론**\n\n### 행사\n\n3. **봄 마켓**\n   2026-04-01 · 서울\n\n| 항목 | 금액 |\n| --- | --- |\n| 매출 | 10,000원 |'} />);
  assert.match(html, /<strong[^>]*>결론<\/strong>/);
  assert.match(html, /<h3[^>]*>행사<\/h3>/);
  assert.match(html, /<ol start="3"/);
  assert.match(html, /<table/);
  assert.match(html, /2026-04-01 · 서울/);
});

test("모델이 반환한 HTML·위험한 링크·원격 이미지를 실행하지 않는다", () => {
  const html = renderToStaticMarkup(<MessageContent content={'<script>alert(1)</script>\n\n[위험](javascript:alert)\n\n![사진](https://example.com/tracker.png)'} />);
  assert.doesNotMatch(html, /<script|javascript:|<img|tracker\.png/);
  assert.match(html, /사진/);
});

test("일반 텍스트의 줄바꿈과 정상 출처 링크를 유지한다", () => {
  const html = renderToStaticMarkup(<MessageContent content={'첫 문장\n둘째 문장\n\n[공고](https://example.com/notice)'} />);
  assert.match(html, /첫 문장\n둘째 문장/);
  assert.match(html, /href="https:\/\/example.com\/notice"/);
  assert.match(html, /rel="noopener noreferrer"/);
});
