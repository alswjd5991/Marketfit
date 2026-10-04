import { CenteredNotice, PageHeader } from "@/components/page-header";
import { getCurrentUser, getMyProducts, getMyStore } from "@/features/store/data";
import { createStore } from "@/features/store/actions";
import { getDashboardStats } from "@/features/dashboard/data";
import { Panel, StoreForm, StoreView } from "@/features/store/store-view";

export default async function StorePage(props: PageProps<"/store">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const edit = sp.edit === "store" || sp.edit === "products" ? sp.edit : null;

  const user = await getCurrentUser();
  if (!user) {
    return <CenteredNotice title="내 가게" text="로그인 후 이용할 수 있어요." href="/login" cta="로그인" />;
  }

  const store = await getMyStore();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 lg:px-8 lg:py-10">
        <PageHeader title="내 가게" />

        {error && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {!store ? (
          <div className="max-w-2xl">
            <Panel title="가게 등록">
              <StoreForm action={createStore} submitLabel="등록하기" />
            </Panel>
          </div>
        ) : (
          <StoreView
            store={store}
            products={await getMyProducts(store.id)}
            stats={await getDashboardStats()}
            edit={edit}
          />
        )}
      </div>
    </div>
  );
}

