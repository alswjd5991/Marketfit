import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getMyProducts, getMyStore } from "@/features/store/data";
import { addProduct, createStore, deleteProduct, updateStore } from "@/features/store/actions";
import { STORE_CATEGORIES } from "@/features/store/constants";

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
    <div className="min-h-screen bg-fixed bg-[linear-gradient(135deg,#FFF3DC_0%,#F6FAFD_30%,#E3F2FC_68%,#F8FBFD_100%)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-bold text-neutral-950">내 가게</h1>

          <p className="mt-1 text-sm text-neutral-500">
            행사 참가 추천과 데이터 기록에 쓰일 가게·상품 정보입니다.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!store ? (
            <CreateStoreForm />
          ) : (
            <>
              <StoreCard store={store} />
              <ProductsSection
                storeId={store.id}
                products={await getMyProducts(store.id)}
              />
            </>
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
        <form action={createStore} className="flex flex-col gap-3">
          <Field name="name" label="가게 이름 *" required />
          <CategorySelect />
          <Field name="nickname" label="닉네임 (선택)" />
          <Field name="flagship_product" label="대표 상품 (선택)" />
          <Field name="active_region" label="주요 활동 지역 (선택)" placeholder="예: 서울 마포구" />
          <Field name="contact" label="연락처 (선택)" />
          <Field name="email" label="이메일 (선택)" type="email" />
          <Button type="submit" className="mt-2">
            등록하기
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StoreCard({
  store,
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
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>가게 정보</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateStore} className="flex flex-col gap-3">
          <input type="hidden" name="store_id" value={store.id} />
          <Field name="name" label="가게 이름 *" required defaultValue={store.name} />
          <CategorySelect defaultValue={store.category} />
          <Field name="nickname" label="닉네임" defaultValue={store.nickname ?? ""} />
          <Field name="flagship_product" label="대표 상품" defaultValue={store.flagship_product ?? ""} />
          <Field name="active_region" label="주요 활동 지역" defaultValue={store.active_region ?? ""} />
          <Field name="contact" label="연락처" defaultValue={store.contact ?? ""} />
          <Field name="email" label="이메일" type="email" defaultValue={store.email ?? ""} />
          <Button type="submit" variant="secondary" className="mt-2">
            정보 저장
          </Button>
        </form>
      </CardContent>
    </Card>
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
