import Link from "next/link";
import { CenteredNotice } from "@/components/page-header";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getParticipationDetail } from "@/features/participations/data";
import {
  addChecklistItem,
  addProductSale,
  deleteChecklistItem,
  deleteProductSale,
  toggleChecklistItem,
  updateParticipationPrep,
  updateParticipationResult,
  updateParticipationStatus,
  updateProductSale,
} from "@/features/participations/actions";
import { STATUS_LABEL, STATUS_ORDER } from "@/features/participations/status-labels";
import { BOOTH_PROVIDED_OPTIONS, PAYMENT_METHODS } from "@/features/store/constants";

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
      <CenteredNotice title="내 행사" text="로그인 후 이용할 수 있어요." href="/login" cta="로그인" />
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
          <form action={updateParticipationPrep} noValidate className="flex flex-col gap-3">
            <input type="hidden" name="participation_id" value={p.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field name="fee" label="참가비(원)" type="number" step={100} min={0} defaultValue={p.fee ?? ""} />
              <Field
                name="expected_revenue"
                label="예상 매출(원)"
                type="number"
                step={100}
                min={0}
                defaultValue={p.expected_revenue ?? ""}
              />
              <Field
                name="target_revenue"
                label="목표 매출(원)"
                type="number"
                step={100}
                min={0}
                defaultValue={p.target_revenue ?? ""}
              />
            </div>
            {/* 2026-09-24 추가: 부스 로지스틱스(다른 마켓 신청서 조사 반영) —
                신청 단계에서 미리 확인해두면 좋은 항목들이라 "참가 전 정보"에 둔다. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">부스/매대 제공</span>
                <select
                  name="booth_provided"
                  defaultValue={p.booth_provided ?? ""}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">미정</option>
                  {BOOTH_PROVIDED_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                name="booth_size"
                label="부스 크기"
                defaultValue={p.booth_size ?? ""}
                placeholder="예: 2m x 2m"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TriStateField name="power_available" label="전기 사용 가능 여부" defaultValue={p.power_available} />
              <TriStateField
                name="vehicle_access"
                label="차량 출입/주차 가능 여부"
                defaultValue={p.vehicle_access}
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
          <form
            action={updateParticipationResult}
            noValidate
            encType="multipart/form-data"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="participation_id" value={p.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                name="total_revenue"
                label="총 매출(원)"
                type="number"
                step={100}
                min={0}
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
              <Field name="transport_cost" label="교통비" type="number" step={100} min={0} defaultValue={p.transport_cost} />
              <Field name="parking_cost" label="주차비" type="number" step={100} min={0} defaultValue={p.parking_cost} />
              <Field name="lodging_cost" label="숙박비" type="number" step={100} min={0} defaultValue={p.lodging_cost} />
              <Field name="other_cost" label="기타 비용" type="number" step={100} min={0} defaultValue={p.other_cost} />
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
            {/* 2026-09-24 추가: 참가 후 기록되는 부스 정보(다른 마켓 신청서 조사 반영) —
                전체 만족도(satisfaction)와 별개로 부스 위치만 따로 평가하는 건 조사에서
                자주 보인 구분점이라, 위치가 나빴는데 전체 만족도만 보면 원인을 놓치기 쉽다. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                name="booth_number"
                label="부스 위치/번호"
                defaultValue={p.booth_number ?? ""}
                placeholder="예: A-12"
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">부스 위치 만족도(1~5)</span>
                <select
                  name="booth_location_rating"
                  defaultValue={p.booth_location_rating ?? ""}
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
            </div>
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="text-neutral-600">현장에서 실제 쓴 결제수단</legend>
              <div className="flex flex-wrap gap-3 pt-1">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-neutral-700">
                    <input
                      type="checkbox"
                      name="payment_methods_used"
                      value={m}
                      defaultChecked={(p.payment_methods_used ?? []).includes(m)}
                      className="size-4 rounded border-neutral-300 accent-brand"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-600">부스 사진</span>
              {p.booth_photo_url && (
                // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 URL
                <img
                  src={p.booth_photo_url}
                  alt=""
                  className="h-24 w-32 rounded-xl border border-neutral-200 object-cover"
                />
              )}
              <input
                name="booth_photo"
                type="file"
                accept="image/*"
                className="text-sm text-neutral-500 file:mr-3 file:rounded-full file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand"
              />
            </label>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>상품별 판매 실적</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {detail.productSales.length === 0 ? (
            <p className="text-sm text-neutral-400">아직 등록된 판매 실적이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.productSales.map((sale) => (
                <li key={sale.id} className="rounded-lg border border-neutral-100 px-3 py-2">
                  <form action={updateProductSale} noValidate className="flex flex-col gap-2">
                    <input type="hidden" name="participation_id" value={p.id} />
                    <input type="hidden" name="sale_id" value={sale.id} />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-900">{sale.product_name}</span>
                      <span className="text-sm text-neutral-500">
                        매출 {sale.revenue.toLocaleString()}원
                        {sale.sell_through_rate != null && ` · 판매율 ${sale.sell_through_rate}%`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      <Field name="prepared" label="준비" type="number" defaultValue={sale.prepared} />
                      <Field name="sold" label="판매" type="number" defaultValue={sale.sold} />
                      <Field name="price" label="단가(원)" type="number" step={100} min={0} defaultValue={sale.price} />
                      <div className="flex items-end gap-1">
                        <Button type="submit" variant="secondary" size="sm" className="flex-1">
                          저장
                        </Button>
                      </div>
                    </div>
                  </form>
                  <form action={deleteProductSale} className="mt-1 text-right">
                    <input type="hidden" name="participation_id" value={p.id} />
                    <input type="hidden" name="sale_id" value={sale.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      삭제
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={addProductSale} noValidate className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-200 p-3">
            <input type="hidden" name="participation_id" value={p.id} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">내 상품에서 선택</span>
                <select
                  name="product_id"
                  defaultValue=""
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">직접 입력</option>
                  {detail.myProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field name="product_name_custom" label="직접 입력 시 상품명" placeholder="예: 수제 비누" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field name="prepared" label="준비 수량" type="number" placeholder="0" />
              <Field name="sold" label="판매 수량" type="number" placeholder="0" />
              <Field name="price" label="단가(원)" type="number" step={100} min={0} placeholder="선택 상품 단가 자동 적용" />
            </div>
            <Button type="submit" variant="outline" size="sm" className="self-start">
              판매 실적 추가
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
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        min={min}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
      />
    </label>
  );
}

/** "잘 모름/선택 안 함" 상태가 있는 boolean 선택 — 부스 전기/차량 접근성처럼
 * 신청 단계엔 확정 안 될 수 있는 값용(0/1 강제 대신 null 허용, 65번 원칙). */
function TriStateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: boolean | null;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue == null ? "" : String(defaultValue)}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">잘 모름</option>
        <option value="true">가능</option>
        <option value="false">불가능</option>
      </select>
    </label>
  );
}
