import Link from "next/link";
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
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">내 가게</h1>
        <p className="mt-3 text-sm text-neutral-500">
          가게 정보와 상품을 등록하려면 먼저 로그인해 주세요.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  const store = await getMyStore();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-neutral-950">내 가게</h1>
      <p className="mt-1 text-sm text-neutral-500">
        행사 참가 추천과 데이터 기록에 쓰일 가게·상품 정보입니다.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!store ? (
        <CreateStoreForm />
      ) : (
        <>
          <StoreCard store={store} />
          <ProductsSection storeId={store.id} products={await getMyProducts(store.id)} />
        </>
      )}
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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>판매 상품 ({products.length})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {products.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 등록된 상품이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {p.name}
                    {p.category && (
                      <span className="ml-2 text-xs text-neutral-400">{p.category}</span>
                    )}
                  </p>
                  {p.price != null && (
                    <p className="text-xs text-neutral-500">{p.price.toLocaleString()}원</p>
                  )}
                </div>
                <form action={deleteProduct}>
                  <input type="hidden" name="product_id" value={p.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    삭제
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addProduct} className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
          <input type="hidden" name="store_id" value={storeId} />
          <Field name="name" label="상품명 *" required />
          <div className="grid grid-cols-2 gap-3">
            <Field name="price" label="판매가 (원)" type="number" />
            <Field name="cost" label="원가 (원)" type="number" />
          </div>
          <Field name="category" label="카테고리 (선택)" />
          <Field name="description" label="설명 (선택)" />
          <Button type="submit" variant="outline" className="mt-1">
            상품 추가
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
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
