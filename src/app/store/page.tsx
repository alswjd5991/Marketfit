import { CenteredNotice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getMyProducts, getMyStore } from "@/features/store/data";
import { addProduct, createStore, deleteProduct, updateStore } from "@/features/store/actions";
import { STORE_CATEGORIES, PAYMENT_METHODS } from "@/features/store/constants";
import type { Store } from "@/types/database";

export default async function StorePage(props: PageProps<"/store">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const user = await getCurrentUser();

  if (!user) {
    return (
      <CenteredNotice title="내 가게" text="로그인 후 이용할 수 있어요." href="/login" cta="로그인" />
    );
  }

  const store = await getMyStore();

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#FFF3DC_0%,#F6FAFD_30%,#E3F2FC_68%,#F8FBFD_100%)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeader title="내 가게" />

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!store ? (
            <CreateStoreForm />
          ) : (
            <StoreProfile
              store={store}
              products={await getMyProducts(store.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CreateStoreForm() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>가게 등록하기</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createStore} encType="multipart/form-data" className="flex flex-col gap-3">
          <Field name="name" label="가게 이름 *" required />
          <CategorySelect />
          <Field name="nickname" label="닉네임 (선택)" />
          <Field name="flagship_product" label="대표 상품 (선택)" />
          <Field name="active_region" label="주요 활동 지역 (선택)" placeholder="예: 서울 마포구" />
          <Field name="contact" label="연락처 (선택)" />
          <Field name="email" label="이메일 (선택)" type="email" />
          <Field
            name="business_registration_number"
            label="사업자등록번호 (선택)"
            placeholder="없으면 비워두세요 — 비사업자/부업 판매도 괜찮아요"
          />
          <Field name="sns_url" label="SNS/인스타그램 링크 (선택)" placeholder="https://instagram.com/..." />
          <PaymentMethodsField />
          <HygieneCertifiedField />
          <ImageField name="logo" label="대표 사진/로고 (선택)" />
          <Button type="submit" className="mt-2">
            등록하기
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StoreCard({ store }: { store: Store }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>가게 정보</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateStore} encType="multipart/form-data" className="flex flex-col gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <Field name="name" label="가게 이름 *" required defaultValue={store.name} />
          <CategorySelect defaultValue={store.category} />
          <Field name="nickname" label="닉네임" defaultValue={store.nickname ?? ""} />
          <Field name="flagship_product" label="대표 상품" defaultValue={store.flagship_product ?? ""} />
          <Field name="active_region" label="주요 활동 지역" defaultValue={store.active_region ?? ""} />
          <Field name="contact" label="연락처" defaultValue={store.contact ?? ""} />
          <Field name="email" label="이메일" type="email" defaultValue={store.email ?? ""} />
          <Field
            name="business_registration_number"
            label="사업자등록번호"
            defaultValue={store.business_registration_number ?? ""}
            placeholder="없으면 비워두세요"
          />
          <Field name="sns_url" label="SNS/인스타그램 링크" defaultValue={store.sns_url ?? ""} />
          <PaymentMethodsField defaultValue={store.payment_methods ?? []} />
          <HygieneCertifiedField defaultValue={store.hygiene_certified} />
          <ImageField name="logo" label="대표 사진/로고" currentUrl={store.logo_url} />
          <Button type="submit" variant="secondary" className="mt-2">
            정보 저장
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentMethodsField({ defaultValue = [] }: { defaultValue?: string[] }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="text-neutral-600">지원 결제수단 (선택)</legend>
      <div className="flex flex-wrap gap-3 pt-1">
        {PAYMENT_METHODS.map((m) => (
          <label key={m} className="flex items-center gap-1.5 text-neutral-700">
            <input
              type="checkbox"
              name="payment_methods"
              value={m}
              defaultChecked={defaultValue.includes(m)}
              className="size-4 rounded border-neutral-300 accent-brand"
            />
            {m}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 식품위생법상 음식류 판매자에게 실제로 요구되는 항목이라, 값이 없어도
 * "선택 안 함"으로 지어내지 않고 그대로 둔다(65번 원칙) — 대신 카테고리가
 * 음식/디저트/농산물일 때만 스토어 카드 상단에서 안내 문구를 보여준다. */
function HygieneCertifiedField({ defaultValue }: { defaultValue?: boolean | null }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">위생교육 이수 여부 (음식류 판매 시, 선택)</span>
      <select
        name="hygiene_certified"
        defaultValue={defaultValue == null ? "" : String(defaultValue)}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">선택 안 함</option>
        <option value="true">이수함</option>
        <option value="false">아직 안 함</option>
      </select>
    </label>
  );
}

function ImageField({
  name,
  label,
  currentUrl,
}: {
  name: string;
  label: string;
  currentUrl?: string | null;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-600">{label}</span>
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 URL, next/image 최적화 불필요
        <img
          src={currentUrl}
          alt=""
          className="h-20 w-20 rounded-xl border border-neutral-200 object-cover"
        />
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

function ProductsSection({
  storeId,
  products,
}: {
  storeId: string;
  products: {
    id: string;
    name: string;
    category: string | null;
    price: number | null;
    cost: number | null;
    description: string | null;
  }[];
}) {
  return (
    <details className="group rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">

      {/* 접혀 있을 때 보이는 제목 */}
      <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5">
        <div>
          <p className="font-semibold text-neutral-900">
            판매 상품 관리
          </p>

          <p className="mt-1 text-sm font-normal text-neutral-500">
            등록된 상품 {products.length}개
          </p>
        </div>

        <span className="text-neutral-400 transition-transform duration-200 group-open:rotate-180">
          ↓
        </span>
      </summary>


      {/* 펼쳤을 때 보이는 영역 */}
      <div className="border-t border-neutral-100 px-6 pb-6 pt-5">

        {products.length === 0 ? (
          <p className="text-sm text-neutral-400">
            아직 등록된 상품이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      {p.name}
                    </p>

                    {p.category && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                        {p.category}
                      </span>
                    )}
                  </div>

                  {p.price != null && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {p.price.toLocaleString()}원
                    </p>
                  )}
                </div>

                <form action={deleteProduct}>
                  <input
                    type="hidden"
                    name="product_id"
                    value={p.id}
                  />

                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-neutral-400 hover:text-red-500"
                  >
                    삭제
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}


        {/* 상품 추가 */}
        <form
          action={addProduct}
          noValidate
          className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-5"
        >
          <input
            type="hidden"
            name="store_id"
            value={storeId}
          />

          <p className="mb-1 font-medium text-neutral-900">
            새 상품 추가
          </p>

          <Field
            name="name"
            label="상품명 *"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              name="price"
              label="판매가 (원) *"
              required
              type="number"
              step={100}
              min={0}
            />

            <Field
              name="cost"
              label="원가 (원) *"
              required
              type="number"
              step={100}
              min={0}
            />
          </div>

          <Field
            name="category"
            label="카테고리 (선택)"
          />

          <Field
            name="description"
            label="설명 (선택)"
          />

          <Button
            type="submit"
            variant="outline"
            className="mt-1"
          >
            상품 추가
          </Button>
        </form>

      </div>
    </details>
  );
}

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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        min={min}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
      />
    </label>
  );
}

function CategorySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">카테고리 *</span>
      <select
        name="category"
        required
        defaultValue={defaultValue ?? ""}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      >
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
function StoreProfile({
  store,
  products,
}: {
  store: {
    id: string;
    name: string;
    nickname: string | null;
    category: string;
    flagship_product: string | null;
    active_region: string | null;
    contact: string | null;
    email: string | null;
  };
  products: {
    id: string;
    name: string;
    category: string | null;
    price: number | null;
    cost: number | null;
    description: string | null;
  }[];
}) {
  return (
    <div className="mt-6 space-y-5">

      {/* 프로필 카드 */}
      <Card className="overflow-hidden border-white/70 bg-white/90 shadow-sm">
        <CardContent className="p-0">

          {/* 상단 프로필 */}
          <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-center">

            {/* 프로필 이미지 임시 */}
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#D6EEFF,#EEF8FD)] text-3xl font-bold text-[#3C78B4] shadow-sm">
              {store.name.slice(0, 1)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
                  {store.name}
                </h2>

                {store.nickname && (
                  <span className="text-sm text-neutral-400">
                    @{store.nickname}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {store.category}
                </span>

                {store.active_region && (
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                    {store.active_region}
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm leading-6 text-neutral-500">
                {store.flagship_product
                  ? `${store.flagship_product}을(를) 중심으로 판매하는 ${store.category} 브랜드입니다.`
                  : `${store.category} 카테고리의 상품을 판매하고 있어요.`}
              </p>
            </div>
          </div>

          {/* 간단한 가게 정보 */}
          <div className="grid border-t border-neutral-100 sm:grid-cols-3">
            <ProfileInfo
              label="대표 상품"
              value={store.flagship_product ?? "아직 등록되지 않았어요"}
            />

            <ProfileInfo
              label="주요 활동 지역"
              value={store.active_region ?? "아직 등록되지 않았어요"}
            />

            <ProfileInfo
              label="등록 상품"
              value={`${products.length}개`}
            />
          </div>
        </CardContent>
      </Card>


      {/* 주력 상품 */}
      <Card className="border-white/70 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>주력 상품</CardTitle>
            <p className="mt-1 text-sm font-normal text-neutral-500">
              등록한 상품을 한눈에 확인해보세요.
            </p>
          </div>

          <span className="text-sm text-neutral-400">
            {products.length}개
          </span>
        </CardHeader>

        <CardContent>
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 px-6 py-10 text-center">
              <p className="text-sm text-neutral-400">
                아직 등록한 상품이 없어요.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* 상품 이미지 임시 */}
                  <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#F3F9FF,#E5F3FF)]">
                    <span className="text-3xl">🛍️</span>
                  </div>

                  <div className="p-4">
                    {product.category && (
                      <span className="text-xs font-medium text-brand">
                        {product.category}
                      </span>
                    )}

                    <h3 className="mt-1 font-semibold text-neutral-950">
                      {product.name}
                    </h3>

                    {product.price != null && (
                      <p className="mt-2 font-medium text-neutral-900">
                        {product.price.toLocaleString()}원
                      </p>
                    )}

                    {product.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* 수정 영역 */}
      <details className="group rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 font-semibold text-neutral-900">
          가게 정보 수정

          <span className="text-neutral-400 transition-transform group-open:rotate-180">
            ↓
          </span>
        </summary>

        <div className="border-t border-neutral-100 p-6">
          <form action={updateStore} className="flex flex-col gap-3">
            <input type="hidden" name="store_id" value={store.id} />

            <Field
              name="name"
              label="가게 이름 *"
              required
              defaultValue={store.name}
            />

            <CategorySelect defaultValue={store.category} />

            <Field
              name="nickname"
              label="닉네임"
              defaultValue={store.nickname ?? ""}
            />

            <Field
              name="flagship_product"
              label="대표 상품"
              defaultValue={store.flagship_product ?? ""}
            />

            <Field
              name="active_region"
              label="주요 활동 지역"
              defaultValue={store.active_region ?? ""}
            />

            <Field
              name="contact"
              label="연락처"
              defaultValue={store.contact ?? ""}
            />

            <Field
              name="email"
              label="이메일"
              type="email"
              defaultValue={store.email ?? ""}
            />

            <Button type="submit" className="mt-2">
              정보 저장
            </Button>
          </form>
        </div>
      </details>


      {/* 기존 상품 등록 기능 */}
      <ProductsSection
        storeId={store.id}
        products={products}
      />

    </div>
  );
}

function ProfileInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-t border-neutral-100 px-6 py-4 sm:border-r sm:border-t-0 last:border-r-0">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">
        {value}
      </p>
    </div>
  );
}