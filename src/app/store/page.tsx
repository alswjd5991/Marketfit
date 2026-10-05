import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getMyProducts, getMyStore } from "@/features/store/data";
import { addProduct, createStore, deleteProduct, updateStore } from "@/features/store/actions";
import { STORE_CATEGORIES, PAYMENT_METHODS } from "@/features/store/constants";
import { seededUnit } from "@/features/events/poster-theme";

// 상품 가격표 그림의 색 조합(바탕, 잉크) — 사이트 팔레트(민트·레몬·자몽·시안·햇살)
const TAG_PALETTES = [
  { bg: "#E0EFE8", ink: "#3F7A64" },
  { bg: "#FFF6BF", ink: "#A88B00" },
  { bg: "#FFE4DE", ink: "#BE3A2A" },
  { bg: "#E3F3FA", ink: "#0A78AE" },
  { bg: "#FFEEDD", ink: "#B4530A" },
];

/**
 * 상품 사진 대신 쓰는 손그림 느낌의 가격표. 끈 달린 크림색 태그를 상품마다 다른 색·각도로
 * 놓아서, 모든 상품이 같은 그림으로 보이지 않게 한다(글자는 넣지 않는다).
 */
function ProductTagArt({ seed }: { seed: string }) {
  const rand = (key: string) => seededUnit(`${seed}:${key}`);
  const palette = TAG_PALETTES[Math.floor(rand("color") * TAG_PALETTES.length)];
  const tilt = (rand("tilt") - 0.5) * 28; // -14° ~ 14°
  const flip = rand("flip") > 0.5;

  return (
    <div className="aspect-[4/3] overflow-hidden" style={{ backgroundColor: palette.bg }}>
      <svg viewBox="0 0 160 120" width="100%" height="100%" role="img" aria-label="상품 그림" className="block">
        <g transform={`translate(84 62) rotate(${tilt}) scale(${flip ? -1 : 1} 1) translate(-48 -28)`}>
          {/* 그림자 */}
          <path d="M0 28 L18 0 H90 a6 6 0 0 1 6 6 V50 a6 6 0 0 1 -6 6 H18 Z" transform="translate(3 4)" fill={palette.ink} opacity={0.15} />
          {/* 태그 본체 */}
          <path d="M0 28 L18 0 H90 a6 6 0 0 1 6 6 V50 a6 6 0 0 1 -6 6 H18 Z" fill="#FFFDF8" />
          {/* 구멍 + 끈 */}
          <circle cx={20} cy={28} r={4.5} fill={palette.bg} stroke={palette.ink} strokeWidth={1.2} />
          <path d="M20 28 C 4 12, -14 40, -34 18" fill="none" stroke={palette.ink} strokeWidth={1.6} strokeLinecap="round" />
          {/* 인쇄된 줄 */}
          <rect x={36} y={17} width={44} height={4} rx={2} fill={palette.ink} opacity={0.6} />
          <rect x={36} y={27} width={30 + rand("l1") * 14} height={2.5} rx={1.25} fill={palette.ink} opacity={0.3} />
          <rect x={36} y={35} width={18 + rand("l2") * 16} height={2.5} rx={1.25} fill={palette.ink} opacity={0.3} />
          {/* 테두리 점선 */}
          <path d="M6 28 L21 5 H88 a3 3 0 0 1 3 3 V48 a3 3 0 0 1 -3 3 H21 Z" fill="none" stroke={palette.ink} strokeWidth={0.8} strokeDasharray="2 3" opacity={0.45} />
        </g>
      </svg>
    </div>
  );
}

export default async function StorePage(props: PageProps<"/store">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">내 가게</h1>
        <p className="mt-3 text-sm text-neutral-500">
          로그인 후 이용 가능
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
      </div>
    );
  }

  const store = await getMyStore();

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#FFF3DC_0%,#F6FAFD_30%,#E3F2FC_68%,#F8FBFD_100%)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold text-neutral-950">내 가게</h1>
            <p className="text-sm text-neutral-500">행사 참가 추천과 데이터 기록에 쓰일 가게·상품 정보</p>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-[#FFE4DE] px-3 py-2 text-sm text-[#BE3A2A]">
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
            placeholder="없으면 비워두기 — 비사업자/부업 판매도 가능"
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
            등록된 상품 없음
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
                    className="text-neutral-400 hover:text-[#BE3A2A]"
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
          선택
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
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#D3ECF7,#F1F9FC)] text-3xl font-bold text-brand-dark shadow-sm">
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
                <span className="rounded-full bg-[#FFF6BF] px-3 py-1 text-xs font-medium text-[#776100]">
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
                  ? `${store.flagship_product}을(를) 중심으로 판매하는 ${store.category} 브랜드`
                  : `${store.category} 카테고리 상품 판매`}
              </p>
            </div>
          </div>

          {/* 간단한 가게 정보 */}
          <div className="grid border-t border-neutral-100 sm:grid-cols-3">
            <ProfileInfo
              label="대표 상품"
              value={store.flagship_product ?? "미등록"}
            />

            <ProfileInfo
              label="주요 활동 지역"
              value={store.active_region ?? "미등록"}
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
              등록한 상품 한눈에 보기
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
                등록한 상품 없음
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* 상품 사진이 없어서 가격표 그림으로 대신한다 */}
                  <ProductTagArt seed={product.id} />

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