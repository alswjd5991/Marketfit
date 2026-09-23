import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getParticipationDetail } from "@/features/participations/data";
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
  updateParticipationPrep,
  updateParticipationResult,
  updateParticipationStatus,
} from "@/features/participations/actions";
import { STATUS_LABEL, STATUS_ORDER } from "@/features/participations/status-labels";

export default async function ParticipationDetailPage(
  props: PageProps<"/my-events/[participationId]">
) {
  const { participationId } = await props.params;
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">내 행사 관리</h1>
        <p className="mt-3 text-sm text-neutral-500">로그인 후 이용할 수 있어요.</p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  const detail = await getParticipationDetail(participationId);
  if (!detail) notFound();

  const p = detail.participation;
  const checkedCount = detail.checklist.filter((c) => c.checked).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/my-events" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 내 행사로 돌아가기
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{STATUS_LABEL[p.status]}</Badge>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-neutral-950">{detail.eventName}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {[detail.region, detail.venue].filter(Boolean).join(" · ") || "지역 미기재"}
        {detail.startDate &&
          ` · ${detail.startDate}${
            detail.endDate && detail.endDate !== detail.startDate ? ` ~ ${detail.endDate}` : ""
          }`}
      </p>
      {detail.detailSeedId && (
        <Link
          href={`/events/${detail.detailSeedId}`}
          className="mt-1 inline-block text-sm underline underline-offset-2"
        >
          원본 행사 정보 보기
        </Link>
      )}

      {notice && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>참가 상태</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateParticipationStatus} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="participation_id" value={p.id} />
            <select
              name="status"
              defaultValue={p.status}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              상태 저장
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>참가 전 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateParticipationPrep} className="flex flex-col gap-3">
            <input type="hidden" name="participation_id" value={p.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field name="fee" label="참가비(원)" type="number" defaultValue={p.fee ?? ""} />
              <Field
                name="expected_revenue"
                label="예상 매출(원)"
                type="number"
                defaultValue={p.expected_revenue ?? ""}
              />
              <Field
                name="target_revenue"
                label="목표 매출(원)"
                type="number"
                defaultValue={p.target_revenue ?? ""}
              />
            </div>
            <Button type="submit" variant="secondary" className="self-start">
              저장
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            준비 체크리스트 ({checkedCount}/{detail.checklist.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {detail.checklist.length === 0 ? (
            <p className="text-sm text-neutral-400">아직 체크리스트 항목이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {detail.checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2"
                >
                  <form action={toggleChecklistItem} className="flex-1">
                    <input type="hidden" name="participation_id" value={p.id} />
                    <input type="hidden" name="checklist_id" value={item.id} />
                    <input type="hidden" name="next_checked" value={String(!item.checked)} />
                    <button
                      type="submit"
                      className={`text-left text-sm ${
                        item.checked ? "text-neutral-400 line-through" : "text-neutral-900"
                      }`}
                    >
                      {item.checked ? "☑" : "☐"} {item.label}
                    </button>
                  </form>
                  <form action={deleteChecklistItem}>
                    <input type="hidden" name="participation_id" value={p.id} />
                    <input type="hidden" name="checklist_id" value={item.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      삭제
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addChecklistItem} className="mt-2 flex gap-2">
            <input type="hidden" name="participation_id" value={p.id} />
            <input
              name="label"
              placeholder="예: 테이블, 명함, 카드 리더기"
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <Button type="submit" variant="outline" size="sm">
              추가
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>참가 후 결과</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateParticipationResult} className="flex flex-col gap-3">
            <input type="hidden" name="participation_id" value={p.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                name="total_revenue"
                label="총 매출(원)"
                type="number"
                defaultValue={p.total_revenue ?? ""}
              />
              <Field
                name="operating_hours"
                label="운영 시간"
                defaultValue={p.operating_hours ?? ""}
                placeholder="예: 10:00~18:00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field name="transport_cost" label="교통비" type="number" defaultValue={p.transport_cost} />
              <Field name="parking_cost" label="주차비" type="number" defaultValue={p.parking_cost} />
              <Field name="lodging_cost" label="숙박비" type="number" defaultValue={p.lodging_cost} />
              <Field name="other_cost" label="기타 비용" type="number" defaultValue={p.other_cost} />
            </div>
            {p.net_profit != null && (
              <p className="text-sm text-neutral-600">
                순이익(자동 계산): <span className="font-semibold">{p.net_profit.toLocaleString()}원</span>
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">전체 만족도(1~5)</span>
                <select
                  name="satisfaction"
                  defaultValue={p.satisfaction ?? ""}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">다음에도 참가하고 싶나요?</span>
                <select
                  name="would_reattend"
                  defaultValue={p.would_reattend == null ? "" : String(p.would_reattend)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">선택 안 함</option>
                  <option value="true">예</option>
                  <option value="false">아니오</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field name="weather" label="날씨" defaultValue={p.weather ?? ""} placeholder="예: 맑음" />
              <Field
                name="indoor_outdoor"
                label="실내/실외"
                defaultValue={p.indoor_outdoor ?? ""}
                placeholder="예: 실외"
              />
              <Field
                name="perceived_crowd"
                label="체감 유동인구"
                defaultValue={p.perceived_crowd ?? ""}
                placeholder="예: 많음"
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-600">메모</span>
              <textarea
                name="memo"
                defaultValue={p.memo ?? ""}
                rows={3}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <Button type="submit" className="self-start">
              결과 저장
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
      />
    </label>
  );
}
