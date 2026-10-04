import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERIES_COLORS } from "@/components/ui/chart-colors";
import { addProduct, deleteProduct, updateStore } from "@/features/store/actions";
import { STORE_CATEGORIES, PAYMENT_METHODS } from "@/features/store/constants";
import type { DashboardStats } from "@/features/dashboard/data";
import type { Product, Store } from "@/types/database";

const FOOD_CATEGORIES = ["음식", "디저트", "농산물"];
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export function StoreView({
  store,
  products,
  stats,
  edit,
}: {
  store: Store;
  products: Product[];
  stats: DashboardStats | null;
  edit: "store" | "products" | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Panel title="가게 정보" action={edit === "store" ? <CancelLink /> : <EditLink edit="store" />}>
          {edit === "store" ? (
            <StoreForm action={updateStore} store={store} submitLabel="저장" />
          ) : (
            <StoreProfile store={store} />
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        {stats && stats.totalParticipations > 0 && <ActivitySummary stats={stats} />}

        <Panel
          title={`판매 상품 ${products.length}개`}
          action={edit === "products" ? <CancelLink /> : <EditLink edit="products" />}
        >
          {edit === "products" ? (
            <ProductEditor storeId={store.id} products={products} />
          ) : products.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              아직 등록한 상품이 없어요. <EditLink edit="products" label="상품 추가" />
            </p>
          ) : (
            <ProductGrid products={products} stats={stats} />
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 보기 모드
// ---------------------------------------------------------------------------

function StoreProfile({ store }: { store: Store }) {
  const rows: [string, ReactNode][] = [
    ["대표 상품", store.flagship_product],
    ["활동 지역", store.active_region],
    ["결제수단", store.payment_methods?.length ? store.payment_methods.join(", ") : null],
    [
      "위생교육",
      FOOD_CATEGORIES.includes(store.category) ? (store.hygiene_certified == null ? null : store.hygiene_certified ? "이수" : "미이수") : null,
    ],
    ["연락처", store.contact],
    ["이메일", store.email],
    [
      "SNS",
      store.sns_url && (
        <a href={store.sns_url} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
          {store.sns_url.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      ),
    ],
    ["사업자번호", store.business_registration_number],
  ];

  return (
    <div>
      <div className="flex items-center gap-4">
        {store.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 URL
          <img src={store.logo_url} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-3xl font-bold text-brand">
            {store.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold tracking-tight text-neutral-950">{store.name}</h2>
          {store.nickname && <p className="text-sm text-neutral-400">@{store.nickname}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark">{store.category}</span>
            {store.active_region && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">{store.active_region}</span>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-6 divide-y divide-neutral-100 border-t border-neutral-100">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="grid grid-cols-[6rem_1fr] gap-3 py-3 text-sm">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="min-w-0 break-words font-medium text-neutral-900">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

function ActivitySummary({ stats }: { stats: DashboardStats }) {
  const items: [string, string][] = [
    ["참가 완료", `${stats.statusCounts.attended}회`],
    ["누적 매출", stats.totalRevenue != null ? won(stats.totalRevenue) : "-"],
    ["누적 순이익", stats.totalNetProfit != null ? won(stats.totalNetProfit) : "-"],
    ["평균 만족도", stats.averageSatisfaction != null ? `${stats.averageSatisfaction.toFixed(1)} / 5` : "-"],
  ];
  return (
    <Panel
      title="활동 요약"
      action={
        <Link href="/dashboard" aria-label="대시보드" className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900">
          <ChevronRight className="size-5" />
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] text-neutral-500">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums tracking-tight text-neutral-950">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ProductGrid({ products, stats }: { products: Product[]; stats: DashboardStats | null }) {
  const sales = new Map((stats?.popularProducts ?? []).map((p) => [p.productName, p]));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product, i) => {
        const margin = product.price && product.cost != null ? (product.price - product.cost) / product.price : null;
        const sale = sales.get(product.name);
        return (
          <div key={product.id} className="rounded-2xl border border-neutral-200/80 p-4">
            <div className="flex items-start gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
              >
                {product.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-neutral-950">{product.name}</h3>
                {product.price != null && <p className="mt-0.5 text-[15px] font-bold tabular-nums text-neutral-900">{won(product.price)}</p>}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Stat label="원가" value={product.cost != null ? won(product.cost) : "-"} />
              <Stat label="마진율" value={margin != null ? `${Math.round(margin * 100)}%` : "-"} />
              <Stat label="누적 판매" value={sale ? `${sale.totalSold.toLocaleString()}개` : "-"} />
              <Stat label="판매율" value={sale?.sellThrough != null ? `${Math.round(sale.sellThrough * 100)}%` : "-"} />
            </dl>
            {product.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-neutral-500">{product.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-2.5 py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 수정 모드
// ---------------------------------------------------------------------------

export function StoreForm({ action, store, submitLabel }: { action: (fd: FormData) => Promise<void>; store?: Store; submitLabel: string }) {
  return (
    <form action={action} encType="multipart/form-data" className="flex flex-col gap-3">
      {store && <input type="hidden" name="store_id" value={store.id} />}
      <Field name="name" label="가게 이름 *" required defaultValue={store?.name} />
      <CategorySelect defaultValue={store?.category} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field name="nickname" label="닉네임" defaultValue={store?.nickname ?? ""} />
        <Field name="flagship_product" label="대표 상품" defaultValue={store?.flagship_product ?? ""} />
        <Field name="active_region" label="주요 활동 지역" defaultValue={store?.active_region ?? ""} placeholder="예: 서울 마포구" />
        <Field name="contact" label="연락처" defaultValue={store?.contact ?? ""} />
        <Field name="email" label="이메일" type="email" defaultValue={store?.email ?? ""} />
        <Field name="business_registration_number" label="사업자등록번호" defaultValue={store?.business_registration_number ?? ""} />
      </div>
      <Field name="sns_url" label="SNS 링크" defaultValue={store?.sns_url ?? ""} placeholder="https://instagram.com/..." />
      <PaymentMethodsField defaultValue={store?.payment_methods ?? []} />
      <HygieneCertifiedField defaultValue={store?.hygiene_certified} />
      <ImageField name="logo" label="대표 사진·로고" currentUrl={store?.logo_url} />
      <Button type="submit" className="mt-2 h-11">
        {submitLabel}
      </Button>
    </form>
  );
}

function ProductEditor({ storeId, products }: { storeId: string; products: Product[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {products.length === 0 ? (
          <p className="py-6 text-sm text-neutral-400">아직 등록한 상품이 없어요.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{p.name}</p>
                  <p className="text-xs text-neutral-500">
                    판매가 {p.price != null ? won(p.price) : "-"} · 원가 {p.cost != null ? won(p.cost) : "-"}
                  </p>
                </div>
                <form action={deleteProduct}>
                  <input type="hidden" name="product_id" value={p.id} />
                  <button
                    type="submit"
                    aria-label={`${p.name} 삭제`}
                    className="flex size-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={addProduct} noValidate className="flex flex-col gap-3 rounded-2xl bg-neutral-50 p-4">
        <input type="hidden" name="store_id" value={storeId} />
        <p className="font-semibold text-neutral-900">새 상품</p>
        <Field name="name" label="상품명 *" required />
        <div className="grid grid-cols-2 gap-3">
          <Field name="price" label="판매가(원) *" required type="number" step={100} min={0} />
          <Field name="cost" label="원가(원) *" required type="number" step={100} min={0} />
        </div>
        <Field name="category" label="상품 분류" />
        <Field name="description" label="설명" />
        <Button type="submit" className="mt-1 h-11">
          추가
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 공통 조각
// ---------------------------------------------------------------------------

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold text-neutral-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditLink({ edit, label = "수정" }: { edit: "store" | "products"; label?: string }) {
  return (
    <Link
      href={`/store?edit=${edit}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
    >
      <Pencil className="size-3.5" />
      {label}
    </Link>
  );
}

function CancelLink() {
  return (
    <Link href="/store" className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900">
      취소
    </Link>
  );
}

const INPUT = "h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  placeholder,
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-600">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} step={step} min={min} className={INPUT} />
    </label>
  );
}

function CategorySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-600">카테고리 *</span>
      <select name="category" required defaultValue={defaultValue ?? ""} className={INPUT}>
        <option value="" disabled>
          선택해 주세요
        </option>
        {STORE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaymentMethodsField({ defaultValue = [] }: { defaultValue?: string[] }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="font-medium text-neutral-600">결제수단</legend>
      <div className="flex flex-wrap gap-3 pt-1">
        {PAYMENT_METHODS.map((m) => (
          <label key={m} className="flex items-center gap-1.5 text-neutral-700">
            <input type="checkbox" name="payment_methods" value={m} defaultChecked={defaultValue.includes(m)} className="size-4 rounded border-neutral-300 accent-brand" />
            {m}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 식품위생법상 음식류 판매자에게 요구되는 항목. 값이 없으면 지어내지 않고 비워 둔다(65번 원칙). */
function HygieneCertifiedField({ defaultValue }: { defaultValue?: boolean | null }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-600">위생교육 이수 (음식류 판매 시)</span>
      <select name="hygiene_certified" defaultValue={defaultValue == null ? "" : String(defaultValue)} className={INPUT}>
        <option value="">선택 안 함</option>
        <option value="true">이수함</option>
        <option value="false">아직 안 함</option>
      </select>
    </label>
  );
}

function ImageField({ name, label, currentUrl }: { name: string; label: string; currentUrl?: string | null }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-600">{label}</span>
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 URL, next/image 최적화 불필요
        <img src={currentUrl} alt="" className="h-20 w-20 rounded-xl border border-neutral-200 object-cover" />
      )}
      <input
        name={name}
        type="file"
        accept="image/*"
        className="text-sm text-neutral-500 file:mr-3 file:rounded-full file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand"
      />
    </label>
  );
}
